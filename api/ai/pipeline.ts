import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { sessions, insights, themes, homework, agreements, roadmaps, tokenUsage } from "@db/schema";
import {
  transcribeAudioFile,
  analyzeTranscript,
  buildLocalDraft,
  aiEnabled,
  localTranscriptionEnabled,
  PROMPT_TEMPLATE_VERSION,
  type TranscriptSegment,
} from "./openai";
import { logAudit } from "../queries/audit";
import { unlink } from "node:fs/promises";

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

async function deleteTemporaryMedia(sessionId: number, mediaPath: string | null): Promise<void> {
  if (mediaPath) {
    await unlink(mediaPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.warn("could not delete temporary media", sessionId, error);
    });
  }
  await getDb()
    .update(sessions)
    .set({ hasMedia: false, mediaPath: null, mediaSizeBytes: null })
    .where(eq(sessions.id, sessionId));
  if (mediaPath) {
    await logAudit(null, "system", "media.deleted_after_processing", "session", String(sessionId));
  }
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
    const savedSegments = Array.isArray(session.transcriptJson)
      ? session.transcriptJson as TranscriptSegment[]
      : [];
    let segments: TranscriptSegment[] = savedSegments;
    let durationSec = session.durationMin * 60;
    if (savedSegments.length > 0) {
      // Rebuild drafts directly from the saved transcript. This makes repeat
      // analysis quick and works after the original media has been deleted.
      await setStatus(sessionId, "analyzing");
    } else if (session.hasMedia && session.mediaPath) {
      await setStatus(sessionId, "transcribing");
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

    // The verbatim transcript is needed only in memory while drafts are built.
    // Persist it only when an operator explicitly opts in.
    await db
      .update(sessions)
      .set({
        transcriptJson: process.env.STORE_TRANSCRIPT === "true" ? segments : null,
        durationMin: Math.max(1, Math.round(durationSec / 60)),
      })
      .where(eq(sessions.id, sessionId));

    // 2. analyze
    await setStatus(sessionId, "analyzing");
    const analysisResult = aiEnabled()
      ? await analyzeTranscript(segments, await approvedContextFor(session.clientId))
      : { analysis: buildLocalDraft(segments), model: "local-structured-draft-v1", inputTokens: 0, outputTokens: 0 };
    const { analysis, model, inputTokens, outputTokens } = analysisResult;

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

    // 4. keep the client's roadmap in sync as a therapist-only draft.
    const roadmapGoals = analysis.needs.length > 0
      ? analysis.needs.slice(0, 4).map((need) => ({ goal: need.label, progress: 0, note: need.description }))
      : analysis.themes.slice(0, 3).map((theme) => ({ goal: theme.title, progress: 0, note: theme.description }));
    const roadmapNextSteps = [
      ...analysis.homework.slice(0, 4).map((item) => item.title),
      ...analysis.therapist_questions.slice(0, 3),
    ];
    const roadmapDraft = {
      currentFocus: analysis.summary_short,
      goalsJson: roadmapGoals,
      stagesJson: analysis.themes.slice(0, 4).map((theme, index) => ({
        title: theme.title,
        status: index === 0 ? "current" as const : "next" as const,
      })),
      resourcesJson: analysis.dynamics_vs_previous.improved,
      obstaclesJson: analysis.patterns.slice(0, 4).map((pattern) => pattern.title),
      nextStepsJson: roadmapNextSteps.length > 0 ? roadmapNextSteps : ["Проверить ключевые фрагменты расшифровки"],
      experimentsJson: [
        ...analysis.agreements.filter((item) => item.type === "experiment").map((item) => item.text),
        ...analysis.homework.slice(0, 3).map((item) => item.description),
      ],
      reviewDate: "После следующей сессии",
      draftPending: true,
      approved: false,
      updatedAt: new Date(),
    };
    const existingRoadmap = await db.query.roadmaps.findFirst({ where: eq(roadmaps.clientId, session.clientId) });
    if (existingRoadmap) {
      await db.update(roadmaps)
        .set({ ...roadmapDraft, version: existingRoadmap.version + 1 })
        .where(eq(roadmaps.id, existingRoadmap.id));
    } else {
      await db.insert(roadmaps).values({ clientId: session.clientId, ...roadmapDraft });
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
    await logAudit(null, "system", aiEnabled() ? "ai.analysis_complete" : "local.draft_complete", "session", String(sessionId), {
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
  } finally {
    // Privacy boundary: source audio/video is temporary and is removed after
    // success, failure, or analysis errors. A failed job must be re-uploaded.
    await deleteTemporaryMedia(sessionId, session.mediaPath).catch((error) => {
      console.error("temporary media cleanup failed", sessionId, error);
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
