import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, therapistQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { sessions, insights, themes, homework, agreements, clientProfiles } from "@db/schema";
import { serializeSession, type TranscriptSegmentDTO } from "../queries/serialize";
import { logAudit } from "../queries/audit";
import { processSession } from "../ai/pipeline";

async function loadSessionWithMaterials(sessionId: number, clientView = false) {
  const db = getDb();
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
  const ii = await db.select().from(insights).where(eq(insights.sessionId, sessionId));
  const tt = await db.select().from(themes).where(eq(themes.sessionId, sessionId));
  const dto = serializeSession(
    session,
    clientView ? ii.filter((item) => item.approved) : ii,
    clientView ? tt.filter((item) => item.approved) : tt,
  );
  if (clientView) {
    dto.transcript = [];
    dto.riskFlags = [];
    dto.therapistQuestions = [];
    dto.uncertainties = [];
  }
  return dto;
}

async function assertTherapistOwns(userId: number, sessionId: number) {
  const db = getDb();
  const s = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!s || s.therapistId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Это не ваша сессия" });
  }
  return s;
}

async function clientProfileIdFor(userId: number): Promise<number> {
  const db = getDb();
  const p = await db.query.clientProfiles.findFirst({ where: eq(clientProfiles.userId, userId) });
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Профиль клиента не найден" });
  return p.id;
}

export const sessionsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    let rows;
    if (ctx.user.role === "client") {
      const profileId = await clientProfileIdFor(ctx.user.id);
      // client sees only sessions whose materials were sent to them
      rows = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.clientId, profileId), eq(sessions.status, "sent_to_client")))
        .orderBy(desc(sessions.sessionDate));
    } else if (ctx.user.role === "therapist") {
      rows = await db
        .select()
        .from(sessions)
        .where(eq(sessions.therapistId, ctx.user.id))
        .orderBy(desc(sessions.sessionDate));
    } else {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Администрация не имеет доступа к содержанию терапевтических сессий",
      });
    }
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const allInsights = await db.select().from(insights).where(inArray(insights.sessionId, ids));
    const allThemes = await db.select().from(themes).where(inArray(themes.sessionId, ids));

    return rows.map((s) => {
      // for clients: strip transcript and keep only approved materials
      const si = allInsights.filter((i) => i.sessionId === s.id);
      const st = allThemes.filter((t) => t.sessionId === s.id);
      const dto = serializeSession(
        s,
        ctx.user.role === "client" ? si.filter((i) => i.approved) : si,
        ctx.user.role === "client" ? st.filter((t) => t.approved) : st,
      );
      if (ctx.user.role === "client") {
        dto.transcript = [];
        dto.riskFlags = [];
        dto.therapistQuestions = [];
        dto.uncertainties = [];
      }
      return dto;
    });
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const s = await db.query.sessions.findFirst({ where: eq(sessions.id, input.id) });
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      if (ctx.user.role === "therapist" && s.therapistId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Это не ваша сессия" });
      }
      if (ctx.user.role === "client") {
        const profileId = await clientProfileIdFor(ctx.user.id);
        if (s.clientId !== profileId || s.status !== "sent_to_client") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Материалы этой сессии вам ещё не отправлены" });
        }
      }
      if (ctx.user.role !== "therapist" && ctx.user.role !== "client") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Администрация не имеет доступа к содержанию терапевтических сессий",
        });
      }
      return loadSessionWithMaterials(input.id, ctx.user.role === "client");
    }),

  createManual: therapistQuery
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(1).max(255),
        durationMin: z.number().int().min(5).max(90),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.clientProfiles.findFirst({
        where: and(eq(clientProfiles.id, input.clientId), eq(clientProfiles.therapistId, ctx.user.id)),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Клиент не найден" });
      const [{ id }] = await db
        .insert(sessions)
        .values({
          therapistId: ctx.user.id,
          clientId: input.clientId,
          title: input.title,
          durationMin: input.durationMin,
          status: "draft_ready",
          hasMedia: false,
        })
        .$returningId();
      await logAudit(ctx.user.id, ctx.user.firstName, "session.create_manual", "session", String(id));
      return { id };
    }),

  // creates a session row that awaits a media file at POST /api/upload?sessionId=
  createForUpload: therapistQuery
    .input(z.object({ clientId: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.clientProfiles.findFirst({
        where: and(eq(clientProfiles.id, input.clientId), eq(clientProfiles.therapistId, ctx.user.id)),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Клиент не найден" });
      if (!profile.aiConsent) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Клиент ещё не дал согласие на AI-обработку сессий",
        });
      }
      const [{ id }] = await db
        .insert(sessions)
        .values({
          therapistId: ctx.user.id,
          clientId: input.clientId,
          title: input.title,
          status: "uploaded",
          hasMedia: false,
        })
        .$returningId();
      return { id };
    }),

  reprocess: therapistQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertTherapistOwns(ctx.user.id, input.id);
      await getDb().update(sessions).set({ status: "queued" }).where(eq(sessions.id, input.id));
      void processSession(input.id);
      return { ok: true };
    }),

  updateSegment: therapistQuery
    .input(
      z.object({
        sessionId: z.number(),
        segmentId: z.string(),
        text: z.string().optional(),
        speaker: z.enum(["therapist", "client", "unknown"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const s = await assertTherapistOwns(ctx.user.id, input.sessionId);
      const segs = ((s.transcriptJson as TranscriptSegmentDTO[] | null) ?? []).map((seg) =>
        seg.id === input.segmentId
          ? { ...seg, text: input.text ?? seg.text, speaker: input.speaker ?? seg.speaker }
          : seg,
      );
      await getDb().update(sessions).set({ transcriptJson: segs }).where(eq(sessions.id, input.sessionId));
      return { ok: true };
    }),

  toggleInsight: therapistQuery
    .input(z.object({ insightId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.insights.findFirst({ where: eq(insights.id, input.insightId) });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTherapistOwns(ctx.user.id, row.sessionId);
      await db.update(insights).set({ approved: !row.approved }).where(eq(insights.id, row.id));
      await logAudit(ctx.user.id, ctx.user.firstName, row.approved ? "material.unapprove" : "material.approve", "insight", String(row.id));
      return { approved: !row.approved };
    }),

  toggleTheme: therapistQuery
    .input(z.object({ themeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.themes.findFirst({ where: eq(themes.id, input.themeId) });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTherapistOwns(ctx.user.id, row.sessionId);
      await db.update(themes).set({ approved: !row.approved }).where(eq(themes.id, row.id));
      return { approved: !row.approved };
    }),

  approveAll: therapistQuery
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await assertTherapistOwns(ctx.user.id, input.sessionId);
      await db.update(insights).set({ approved: true }).where(eq(insights.sessionId, input.sessionId));
      await db.update(themes).set({ approved: true }).where(eq(themes.sessionId, input.sessionId));
      await db
        .update(homework)
        .set({ approved: true })
        .where(eq(homework.sessionId, input.sessionId));
      await db
        .update(agreements)
        .set({ approved: true })
        .where(eq(agreements.sessionId, input.sessionId));
      await db
        .update(sessions)
        .set({ status: "approved", approvedAt: new Date() })
        .where(eq(sessions.id, input.sessionId));
      await logAudit(ctx.user.id, ctx.user.firstName, "session.approve", "session", String(input.sessionId));
      return { ok: true };
    }),

  sendToClient: therapistQuery
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const s = await assertTherapistOwns(ctx.user.id, input.sessionId);
      if (s.status !== "approved") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Сначала подтвердите материалы сессии",
        });
      }
      await db
        .update(sessions)
        .set({ status: "sent_to_client", sentAt: new Date() })
        .where(eq(sessions.id, input.sessionId));
      await logAudit(ctx.user.id, ctx.user.firstName, "session.send_to_client", "session", String(input.sessionId));
      return { ok: true };
    }),
});
