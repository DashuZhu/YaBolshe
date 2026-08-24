import type {
  SessionRow,
  InsightRow,
  ThemeRow,
  HomeworkRow,
  AgreementRow,
  RoadmapRow,
  TherapistNoteRow,
  CheckInRow,
} from "@db/schema";

// Maps DB rows to the DTO shapes consumed by the frontend.

const ruDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "";

const ruDateShort = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";

const ruDateTime = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) +
      ", " +
      d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "";

export { ruDate, ruDateShort, ruDateTime };

export interface TranscriptSegmentDTO {
  id: string;
  start: string;
  end: string;
  speaker: "therapist" | "client" | "unknown";
  text: string;
  confidence: number;
}

export function serializeSession(
  s: SessionRow,
  sessionInsights: InsightRow[],
  sessionThemes: ThemeRow[],
) {
  return {
    id: String(s.id),
    clientId: String(s.clientId),
    title: s.title,
    date: ruDate(s.sessionDate),
    durationMin: s.durationMin,
    status: s.status,
    hasMedia: s.hasMedia,
    processingError: s.processingError ?? undefined,
    summaryShort: s.summaryShort ?? "",
    clientFriendlySummary: s.clientFriendlySummary ?? "",
    emotions: (s.emotionsJson as { label: string; intensity: "low" | "medium" | "high"; context: string }[] | null) ?? [],
    needs: (s.needsJson as { label: string; description: string }[] | null) ?? [],
    patterns:
      (s.patternsJson as
        | { id: string; title: string; description: string; confidence: "low" | "medium" | "high"; evidence: string[] }[]
        | null) ?? [],
    riskFlags:
      (s.riskFlagsJson as
        | { type: string; severity: "low" | "medium" | "high"; evidence: string[]; recommendedAction?: string; recommended_action?: string }[]
        | null)?.map((r) => ({
          type: r.type,
          severity: r.severity,
          evidence: r.evidence ?? [],
          recommendedAction: r.recommendedAction ?? r.recommended_action ?? "",
        })) ?? [],
    dynamics:
      (s.dynamicsJson as
        | { summary: string; improved: string[]; stable: string[]; newTopics: string[] }
        | null) ?? { summary: "", improved: [], stable: [], newTopics: [] },
    therapistQuestions: (s.therapistQuestionsJson as string[] | null) ?? [],
    uncertainties: (s.uncertaintiesJson as string[] | null) ?? [],
    transcript: ((s.transcriptJson as TranscriptSegmentDTO[] | null) ?? []).map((seg) => ({
      ...seg,
      speaker: seg.speaker ?? "unknown",
    })),
    themes: sessionThemes.map(serializeTheme),
    insights: sessionInsights.map(serializeInsight),
    model: s.model ?? "—",
    tokens: { input: s.inputTokens, output: s.outputTokens },
    approvedAt: s.approvedAt ? ruDateTime(s.approvedAt) : undefined,
    sentAt: s.sentAt ? ruDateTime(s.sentAt) : undefined,
  };
}

export function serializeInsight(i: InsightRow) {
  return {
    id: String(i.id),
    title: i.title,
    description: i.description,
    clientAction: i.clientAction,
    confidence: i.confidence,
    evidence: (i.evidenceJson as string[] | null) ?? [],
    approved: i.approved,
    clientStatus: i.clientStatus,
  };
}

export function serializeTheme(t: ThemeRow) {
  return {
    id: String(t.id),
    title: t.title,
    description: t.description,
    confidence: t.confidence,
    evidence: (t.evidenceJson as string[] | null) ?? [],
    approved: t.approved,
  };
}

export function serializeHomework(h: HomeworkRow) {
  return {
    id: String(h.id),
    clientId: String(h.clientId),
    title: h.title,
    description: h.description,
    purpose: h.purpose ?? "",
    frequency: h.frequency,
    dueDate: h.dueDate,
    status: h.status,
    approved: h.approved,
    reflection: h.reflection ?? undefined,
    insightTitle: h.insightTitle ?? undefined,
  };
}

export function serializeAgreement(a: AgreementRow) {
  return {
    id: String(a.id),
    clientId: String(a.clientId),
    text: a.text,
    type: a.type,
    status: a.status,
    reviewDate: a.reviewDate,
    approved: a.approved,
  };
}

export function serializeRoadmap(r: RoadmapRow) {
  return {
    clientId: String(r.clientId),
    currentFocus: r.currentFocus ?? "",
    goals: (r.goalsJson as { goal: string; progress: number; note: string }[] | null) ?? [],
    stages: (r.stagesJson as { title: string; status: "done" | "current" | "next" }[] | null) ?? [],
    resources: (r.resourcesJson as string[] | null) ?? [],
    obstacles: (r.obstaclesJson as string[] | null) ?? [],
    nextSteps: (r.nextStepsJson as string[] | null) ?? [],
    experiments: (r.experimentsJson as string[] | null) ?? [],
    reviewDate: r.reviewDate,
    version: r.version,
    draftPending: r.draftPending,
    approved: r.approved,
  };
}

export function serializeNote(n: TherapistNoteRow) {
  return {
    id: String(n.id),
    clientId: String(n.clientId),
    text: n.text,
    tags: (n.tagsJson as string[] | null) ?? [],
    useAsAiContext: n.useAsAiContext,
    createdAt: ruDateTime(n.createdAt),
  };
}

export function serializeCheckIn(c: CheckInRow) {
  return {
    date: ruDateShort(c.createdAt),
    mood: c.mood,
    energy: c.energy,
    anxiety: c.anxiety,
  };
}
