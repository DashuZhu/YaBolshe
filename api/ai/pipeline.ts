import { eq, and, desc, inArray, isNotNull, sql } from "drizzle-orm";
import { readFile, unlink } from "node:fs/promises";
import { getDb } from "../queries/connection";
import { sessions, sessionFiles, insights, themes, homework, tokenUsage, clientAnalysis, type SessionFileRow } from "@db/schema";
import {
  transcribeAudioFile,
  analyzeTranscript,
  buildLocalDraft,
  analyzeClientPortrait,
  buildLocalClientAnalysis,
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

function ts(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

async function setStatus(sessionId: number, status: typeof sessions.$inferSelect.status, error?: string) {
  await getDb()
    .update(sessions)
    .set({ status, processingError: error ?? null })
    .where(eq(sessions.id, sessionId));
}

/**
 * Builds the cross-session context fed into the "Динамика" psychological
 * portrait: for each of the last several sent sessions, a short digest plus
 * the titles of its themes/patterns — enough signal to spot recurrence
 * across sessions without re-sending each session's full analysis.
 */
async function approvedContextFor(clientId: number): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ id: sessions.id, summary: sessions.summaryShort, title: sessions.title, date: sessions.sessionDate })
    .from(sessions)
    .where(and(eq(sessions.clientId, clientId), eq(sessions.status, "sent_to_client")))
    .orderBy(desc(sessions.sessionDate))
    .limit(8);
  if (rows.length === 0) return "";

  const ids = rows.map((r) => r.id);
  const [allThemes, allPatterns] = await Promise.all([
    db.select({ sessionId: themes.sessionId, title: themes.title }).from(themes).where(inArray(themes.sessionId, ids)),
    db.select({ sessionId: sessions.id, patternsJson: sessions.patternsJson }).from(sessions).where(inArray(sessions.id, ids)),
  ]);
  const patternTitlesBySession = new Map<number, string[]>();
  for (const row of allPatterns) {
    const titles = (row.patternsJson as { title: string }[] | null)?.map((p) => p.title) ?? [];
    patternTitlesBySession.set(row.sessionId, titles);
  }
  const themeTitlesBySession = new Map<number, string[]>();
  for (const t of allThemes) {
    themeTitlesBySession.set(t.sessionId, [...(themeTitlesBySession.get(t.sessionId) ?? []), t.title]);
  }

  return rows
    .map((r) => {
      const themeTitles = themeTitlesBySession.get(r.id) ?? [];
      const patternTitles = patternTitlesBySession.get(r.id) ?? [];
      const parts = [`• ${r.title}: ${r.summary ?? ""}`];
      if (themeTitles.length > 0) parts.push(`  темы: ${themeTitles.join(", ")}`);
      if (patternTitles.length > 0) parts.push(`  паттерны: ${patternTitles.join(", ")}`);
      return parts.join("\n");
    })
    .join("\n");
}

const CLIENT_PORTRAIT_EVERY_N_SESSIONS = 4;

/**
 * Full analyzed-session history for one client (not just sessions already
 * sent), used only by the standing client-level portrait/dynamics job —
 * deeper and wider than approvedContextFor, which feeds the per-session call.
 */
async function fullClientHistoryContext(clientId: number): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      date: sessions.sessionDate,
      summary: sessions.summaryShort,
      caseAnalysis: sessions.caseAnalysis,
    })
    .from(sessions)
    .where(and(eq(sessions.clientId, clientId), isNotNull(sessions.summaryShort)))
    .orderBy(sessions.sessionDate);
  if (rows.length === 0) return "";

  const ids = rows.map((r) => r.id);
  const [allThemes, allPatterns] = await Promise.all([
    db.select({ sessionId: themes.sessionId, title: themes.title }).from(themes).where(inArray(themes.sessionId, ids)),
    db.select({ sessionId: sessions.id, patternsJson: sessions.patternsJson }).from(sessions).where(inArray(sessions.id, ids)),
  ]);
  const patternTitlesBySession = new Map<number, string[]>();
  for (const row of allPatterns) {
    const titles = (row.patternsJson as { title: string }[] | null)?.map((p) => p.title) ?? [];
    patternTitlesBySession.set(row.sessionId, titles);
  }
  const themeTitlesBySession = new Map<number, string[]>();
  for (const t of allThemes) {
    themeTitlesBySession.set(t.sessionId, [...(themeTitlesBySession.get(t.sessionId) ?? []), t.title]);
  }

  return rows
    .map((r, i) => {
      const themeTitles = themeTitlesBySession.get(r.id) ?? [];
      const patternTitles = patternTitlesBySession.get(r.id) ?? [];
      const parts = [`• Сессия ${i + 1}: ${r.summary ?? ""}`];
      if (themeTitles.length > 0) parts.push(`  темы: ${themeTitles.join(", ")}`);
      if (patternTitles.length > 0) parts.push(`  паттерны: ${patternTitles.join(", ")}`);
      if (r.caseAnalysis) parts.push(`  анализ случая: ${r.caseAnalysis.slice(0, 600)}`);
      return parts.join("\n");
    })
    .join("\n");
}

/**
 * After a session finishes analysis, checks whether the client has just hit
 * another multiple of CLIENT_PORTRAIT_EVERY_N_SESSIONS analyzed sessions and,
 * if so, (re)builds the standing portrait/dynamics for the client's page.
 */
async function maybeUpdateClientPortrait(clientId: number): Promise<void> {
  const db = getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sessions)
    .where(and(eq(sessions.clientId, clientId), isNotNull(sessions.summaryShort)));
  const analyzedCount = Number(n ?? 0);
  if (analyzedCount === 0 || analyzedCount % CLIENT_PORTRAIT_EVERY_N_SESSIONS !== 0) return;

  const existing = await db.query.clientAnalysis.findFirst({ where: eq(clientAnalysis.clientId, clientId) });
  if (existing?.sessionsAnalyzed === analyzedCount) return; // already up to date

  const historyContext = await fullClientHistoryContext(clientId);
  const result = aiEnabled()
    ? await analyzeClientPortrait(historyContext, existing?.portraitSummary ?? undefined)
    : { analysis: buildLocalClientAnalysis(analyzedCount), model: "local-structured-draft-v1", inputTokens: 0, outputTokens: 0 };
  const { analysis, model, inputTokens, outputTokens } = result;

  const values = {
    clientId,
    portraitSummary: analysis.portrait_summary,
    dynamicsSummary: analysis.dynamics_summary,
    recurringThemesJson: analysis.recurring_themes,
    avoidedByClientJson: analysis.avoided_by_client,
    avoidedByTherapistJson: analysis.avoided_by_therapist,
    sessionsAnalyzed: analyzedCount,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(clientAnalysis).set(values).where(eq(clientAnalysis.id, existing.id));
  } else {
    await db.insert(clientAnalysis).values(values);
  }

  await db.insert(tokenUsage).values({
    sessionId: null,
    kind: "analysis",
    model,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    inputTokens,
    outputTokens,
    costEstimate: aiEnabled()
      ? (inputTokens / 1e6) * COST.inputPer1M + (outputTokens / 1e6) * COST.outputPer1M
      : 0,
  });
  await logAudit(null, "system", "ai.client_portrait_updated", "client", String(clientId), { analyzedCount, model });
}

/** Split a plain-text transcript into readable chunks; timestamps are synthetic (no real audio). */
function segmentsFromText(files: SessionFileRow[], texts: string[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (let f = 0; f < files.length; f += 1) {
    const paragraphs = texts[f]
      .split(/\r?\n\s*\r?\n|\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    for (const paragraph of paragraphs) {
      segments.push({
        id: `seg-${segments.length + 1}`,
        start: ts(cursor),
        end: ts(cursor + 20),
        speaker: files[f].speakerHint,
        text: paragraph,
        confidence: 1,
      });
      cursor += 20;
    }
  }
  return segments;
}

/** Merge per-track transcripts of one synced session recording into one ordered transcript. */
function mergeTrackSegments(tracks: TranscriptSegment[][]): TranscriptSegment[] {
  const flat = tracks.flat().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return flat.map((segment, index) => ({ ...segment, id: `seg-${index + 1}` }));
}

async function deleteAttachedFiles(sessionId: number): Promise<void> {
  const db = getDb();
  const files = await db.select().from(sessionFiles).where(eq(sessionFiles.sessionId, sessionId));
  for (const file of files) {
    await unlink(file.filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.warn("could not delete temporary file", sessionId, file.filePath, error);
    });
  }
  if (files.length > 0) {
    await db.delete(sessionFiles).where(eq(sessionFiles.sessionId, sessionId));
    await db.update(sessions).set({ hasMedia: false }).where(eq(sessions.id, sessionId));
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
    const savedSegments = Array.isArray(session.transcriptJson)
      ? session.transcriptJson as TranscriptSegment[]
      : [];
    let segments: TranscriptSegment[] = savedSegments;
    let durationSec = session.durationMin * 60;

    if (savedSegments.length > 0) {
      // Rebuild drafts directly from the saved transcript. This makes repeat
      // analysis quick and works after the original files have been deleted.
      await setStatus(sessionId, "analyzing");
    } else {
      const files = await db
        .select()
        .from(sessionFiles)
        .where(eq(sessionFiles.sessionId, sessionId));
      const audioFiles = files.filter((f) => f.kind === "audio_video");
      const textFiles = files.filter((f) => f.kind === "text");

      if (audioFiles.length > 0 && textFiles.length > 0) {
        throw new Error(
          "К сессии одновременно прикреплены аудио/видео и текстовая расшифровка. Оставьте материалы одного типа и загрузите сессию заново.",
        );
      }

      if (textFiles.length > 0) {
        await setStatus(sessionId, "analyzing");
        const texts = await Promise.all(textFiles.map((f) => readFile(f.filePath, "utf-8")));
        segments = segmentsFromText(textFiles, texts);
      } else if (audioFiles.length === 1) {
        await setStatus(sessionId, "transcribing");
        const file = audioFiles[0];
        const result = await transcribeAudioFile(file.filePath, file.originalName);
        segments = file.speakerHint === "unknown"
          ? result.segments
          : result.segments.map((s) => ({ ...s, speaker: file.speakerHint }));
        durationSec = result.durationSec || durationSec;
        await db.insert(tokenUsage).values({
          sessionId,
          kind: "transcription",
          model: result.model,
          inputTokens: 0,
          outputTokens: 0,
          costEstimate: aiEnabled() && !localTranscriptionEnabled() ? (durationSec / 60) * COST.whisperPerMin : 0,
        });
      } else if (audioFiles.length > 1) {
        // Several synced tracks of one conversation (e.g. separate mics per
        // participant) are transcribed independently and merged by timestamp
        // into a single transcript, instead of a separate diarization pass.
        await setStatus(sessionId, "transcribing");
        const perTrack: TranscriptSegment[][] = [];
        let totalDurationSec = 0;
        let lastModel = "";
        for (const file of audioFiles) {
          const result = await transcribeAudioFile(file.filePath, file.originalName);
          const labeled = file.speakerHint === "unknown"
            ? result.segments
            : result.segments.map((s) => ({ ...s, speaker: file.speakerHint }));
          perTrack.push(labeled);
          totalDurationSec = Math.max(totalDurationSec, result.durationSec);
          lastModel = result.model;
        }
        segments = mergeTrackSegments(perTrack);
        durationSec = totalDurationSec || durationSec;
        await db.insert(tokenUsage).values({
          sessionId,
          kind: "transcription",
          model: lastModel || "unknown",
          inputTokens: 0,
          outputTokens: 0,
          costEstimate: aiEnabled() && !localTranscriptionEnabled() ? (durationSec / 60) * COST.whisperPerMin : 0,
        });
      } else {
        // manual session without any attached material — nothing to transcribe
        await setStatus(sessionId, "draft_ready");
        return;
      }
    }

    // The verbatim transcript is kept (unlike the source audio/video, which is
    // deleted right after processing) — the therapist can read and copy it
    // from the session page.
    await db
      .update(sessions)
      .set({
        transcriptJson: segments,
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

    await db
      .update(sessions)
      .set({
        summaryShort: analysis.summary_short,
        clientFriendlySummary: analysis.client_friendly_summary,
        clientProgressNote: analysis.client_dynamics_note,
        emotionsNeedsAnalysis: analysis.emotions_needs_analysis,
        patternsJson: analysis.patterns.map((p, i) => ({ id: `pat-${i + 1}`, ...p })),
        riskFlagsJson: analysis.risk_flags,
        caseAnalysis: analysis.case_analysis,
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
    // Note: there is no separate "roadmap" entity anymore, and no per-session
    // dynamics tab — the client's standing portrait and dynamics live on the
    // client's own page and are recomputed every few sessions, below.
    await maybeUpdateClientPortrait(session.clientId).catch((error) => {
      console.error("client portrait update failed", session.clientId, error);
    });

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
    // Privacy boundary: source audio/video/text is temporary and is removed
    // after success, failure, or analysis errors. A failed job must be re-uploaded.
    await deleteAttachedFiles(sessionId).catch((error) => {
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
    .select({ id: sessions.id })
    .from(sessions)
    .where(inArray(sessions.status, ["queued", "transcribing", "analyzing"]));
  for (const session of pending) {
    const attached = await getDb()
      .select({ id: sessionFiles.id })
      .from(sessionFiles)
      .where(eq(sessionFiles.sessionId, session.id))
      .limit(1);
    if (attached.length > 0) enqueueSession(session.id);
  }
}
