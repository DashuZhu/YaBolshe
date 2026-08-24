import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { sessions, insights, themes, homework, agreements, tokenUsage } from "@db/schema";
import {
  transcribeAudioFile,
  analyzeTranscript,
  aiEnabled,
  localTranscriptionEnabled,
  PROMPT_TEMPLATE_VERSION,
  type TranscriptSegment,
} from "./openai";
import { logAudit } from "../queries/audit";

// Rough cost estimation (USD). Tune to your tariff.
const COST = {
  whisperPerMin: 0.006,
  inputPer1M: 1.25,
  outputPer1M: 10.0,
};

async function setStatus(sessionId: number, status: typeof sessions.$inferSelect.status, error?: string) {
  await getDb()
    .update(sessions)
    .set({ status, processingError: error ?? null })
    .where(eq(sessions.id, sessionId));
}

async function approvedContextFor(clientId: number): Promise<string> {
  const rows = await getDb()
    .select({ summary: sessions.summaryShort, title: sessions.title })
    .from(sessions)
    .where(and(eq(sessions.clientId, clientId), eq(sessions.status, "sent_to_client")))
    .orderBy(desc(sessions.sessionDate))
    .limit(5);
  return rows.map((r) => `• ${r.title}: ${r.summary ?? ""}`).join("\n");
}

/**
 * Async media → transcript → AI-analysis pipeline.
 * Runs in-process; statuses are visible to the therapist in real time.
 */
export async function processSession(sessionId: number): Promise<void> {
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) return;

  try {
    // 1. transcribe
    await setStatus(sessionId, "transcribing");
    let segments: TranscriptSegment[];
    let durationSec = session.durationMin * 60;
    if (session.hasMedia && session.mediaPath) {
      const result = await transcribeAudioFile(
        session.mediaPath,
        session.mediaPath.split("/").pop() ?? "audio.mp3",
      );
      segments = result.segments;
      durationSec = result.durationSec || durationSec;
      const minutes = durationSec / 60;
      await db.insert(tokenUsage).values({
        sessionId,
        kind: "transcription",
        model: result.model,
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: aiEnabled() && !localTranscriptionEnabled() ? minutes * COST.whisperPerMin : 0,
      });
    } else {
      // manual session without media — nothing to transcribe
      await setStatus(sessionId, "draft_ready");
      return;
    }

    await db
      .update(sessions)
      .set({
        transcriptJson: segments,
        durationMin: Math.max(1, Math.round(durationSec / 60)),
      })
      .where(eq(sessions.id, sessionId));

    // A transcript is still a useful, honest result when text analysis is not
    // configured. Never replace real session content with demo conclusions.
    if (!aiEnabled()) {
      await setStatus(sessionId, "draft_ready");
      await logAudit(null, "system", "transcription.complete_without_analysis", "session", String(sessionId), {
        reason: "ai_not_configured",
      });
      return;
    }

    // 2. analyze
    await setStatus(sessionId, "analyzing");
    const context = await approvedContextFor(session.clientId);
    const { analysis, model, inputTokens, outputTokens } = await analyzeTranscript(segments, context);

    // Reprocessing replaces an earlier draft instead of duplicating its cards.
    await db.delete(insights).where(eq(insights.sessionId, sessionId));
    await db.delete(themes).where(eq(themes.sessionId, sessionId));
    await db.delete(homework).where(eq(homework.sessionId, sessionId));
    await db.delete(agreements).where(eq(agreements.sessionId, sessionId));

    await db
      .update(sessions)
      .set({
        summaryShort: analysis.summary_short,
        clientFriendlySummary: analysis.client_friendly_summary,
        emotionsJson: analysis.emotions,
        needsJson: analysis.needs,
        patternsJson: analysis.patterns.map((p, i) => ({ id: `pat-${i + 1}`, ...p })),
        riskFlagsJson: analysis.risk_flags,
        dynamicsJson: {
          summary: analysis.dynamics_vs_previous.summary,
          improved: analysis.dynamics_vs_previous.improved,
          stable: analysis.dynamics_vs_previous.stable,
          newTopics: analysis.dynamics_vs_previous.new_topics,
        },
        therapistQuestionsJson: analysis.therapist_questions,
        uncertaintiesJson: analysis.uncertainties,
        model,
        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
        inputTokens,
        outputTokens,
      })
      .where(eq(sessions.id, sessionId));

    // 3. draft materials
    for (const t of analysis.themes) {
      await db.insert(themes).values({
        sessionId,
        clientId: session.clientId,
        title: t.title,
        description: t.description,
        confidence: t.confidence,
        evidenceJson: t.evidence,
        approved: false,
      });
    }
    for (const i of analysis.insights) {
      await db.insert(insights).values({
        sessionId,
        clientId: session.clientId,
        title: i.title,
        description: i.description,
        clientAction: i.client_action,
        confidence: i.confidence,
        evidenceJson: i.evidence,
        approved: false,
      });
    }
    for (const h of analysis.homework) {
      await db.insert(homework).values({
        clientId: session.clientId,
        sessionId,
        title: h.title,
        description: h.description,
        purpose: h.purpose,
        frequency: h.frequency,
        dueDate: h.due_date ?? "по договорённости",
        status: "assigned",
        approved: false,
      });
    }
    for (const a of analysis.agreements) {
      await db.insert(agreements).values({
        clientId: session.clientId,
        sessionId,
        text: a.text,
        type: a.type,
        status: "active",
        reviewDate: a.review_date ?? "",
        approved: false,
      });
    }

    await db.insert(tokenUsage).values({
      sessionId,
      kind: "analysis",
      model,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      inputTokens,
      outputTokens,
      costEstimate: aiEnabled()
        ? (inputTokens / 1e6) * COST.inputPer1M + (outputTokens / 1e6) * COST.outputPer1M
        : 0,
    });

    await setStatus(sessionId, "draft_ready");
    await logAudit(null, "system", "ai.analysis_complete", "session", String(sessionId), {
      model,
      inputTokens,
      outputTokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pipeline failed", message);
    await setStatus(sessionId, "failed", message.slice(0, 1000));
    await logAudit(null, "system", "ai.analysis_failed", "session", String(sessionId), {
      error: message.slice(0, 300),
    });
  }
}

const scheduledSessions = new Set<number>();
let queueTail: Promise<void> = Promise.resolve();

/** Keep CPU-heavy transcription sequential and survive duplicate enqueue calls. */
export function enqueueSession(sessionId: number): void {
  if (scheduledSessions.has(sessionId)) return;
  scheduledSessions.add(sessionId);
  queueTail = queueTail
    .then(() => processSession(sessionId))
    .catch((error) => console.error("queued session failed", sessionId, error))
    .finally(() => scheduledSessions.delete(sessionId));
}

/** Resume work that was interrupted by an app/server restart. */
export async function resumePendingSessions(): Promise<void> {
  const pending = await getDb()
    .select({ id: sessions.id, hasMedia: sessions.hasMedia, mediaPath: sessions.mediaPath })
    .from(sessions)
    .where(inArray(sessions.status, ["queued", "transcribing", "analyzing"]));
  for (const session of pending) {
    if (session.hasMedia && session.mediaPath) enqueueSession(session.id);
  }
}
