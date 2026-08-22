import { z } from "zod";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { createRouter, therapistQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  clientProfiles,
  users,
  sessions,
  insights,
  themes,
  homework,
  invites,
  therapistProfiles,
} from "@db/schema";
import { logAudit } from "../queries/audit";
import { ruDate, ruDateTime } from "../queries/serialize";

function initials(first: string, last: string) {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "??";
}

export const clientsRouter = createRouter({
  // therapist stats for the dashboard rings
  stats: therapistQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.therapistProfiles.findFirst({
      where: eq(therapistProfiles.userId, ctx.user.id),
    });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const activeClients = await db
      .select({ n: sql<number>`count(*)` })
      .from(clientProfiles)
      .where(and(eq(clientProfiles.therapistId, ctx.user.id), eq(clientProfiles.status, "active")));

    const monthSessions = await db
      .select({ n: sql<number>`count(*)`, minutes: sql<number>`coalesce(sum(duration_min),0)` })
      .from(sessions)
      .where(and(eq(sessions.therapistId, ctx.user.id), sql`session_date >= ${monthStart}`));

    return {
      name: `${ctx.user.firstName} ${ctx.user.lastName}`.trim(),
      firstName: ctx.user.firstName,
      activeClients: Number(activeClients[0]?.n ?? 0),
      maxClients: profile?.maxActiveClients ?? 20,
      monthSessions: Number(monthSessions[0]?.n ?? 0),
      monthSessionsLimit: profile?.monthlySessionLimit ?? 80,
      monthHours: Math.round((Number(monthSessions[0]?.minutes ?? 0) / 60) * 10) / 10,
      monthHoursLimit: profile?.monthlyHoursLimit ?? 120,
    };
  }),

  list: therapistQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profiles = await db
      .select({ profile: clientProfiles, user: users })
      .from(clientProfiles)
      .innerJoin(users, eq(users.id, clientProfiles.userId))
      .where(eq(clientProfiles.therapistId, ctx.user.id));

    const result = [];
    for (const { profile, user } of profiles) {
      const clientSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.clientId, profile.id))
        .orderBy(desc(sessions.sessionDate));

      const sessionIds = clientSessions.map((s) => s.id);
      let pendingApprovals = 0;
      if (sessionIds.length > 0) {
        const draftSessions = clientSessions.filter((s) =>
          ["draft_ready", "therapist_review"].includes(s.status),
        );
        const draftIds = draftSessions.map((s) => s.id);
        if (draftIds.length > 0) {
          const ii = await db
            .select({ n: sql<number>`count(*)` })
            .from(insights)
            .where(and(inArray(insights.sessionId, draftIds), eq(insights.approved, false)));
          const tt = await db
            .select({ n: sql<number>`count(*)` })
            .from(themes)
            .where(and(inArray(themes.sessionId, draftIds), eq(themes.approved, false)));
          pendingApprovals = Number(ii[0]?.n ?? 0) + Number(tt[0]?.n ?? 0);
        }
      }

      const hwActive = await db
        .select({ n: sql<number>`count(*)` })
        .from(homework)
        .where(
          and(
            eq(homework.clientId, profile.id),
            inArray(homework.status, ["assigned", "in_progress"]),
            eq(homework.approved, true),
          ),
        );

      const lastWithRisk = clientSessions.find(
        (s) =>
          s.status !== "sent_to_client" &&
          Array.isArray(s.riskFlagsJson) &&
          (s.riskFlagsJson as unknown[]).length > 0,
      );
      const lastAnalyzed = clientSessions.find((s) => s.dynamicsJson);
      const dynamicsData = lastAnalyzed?.dynamicsJson as { improved?: string[] } | null;
      const dynamics = lastWithRisk
        ? ("attention" as const)
        : dynamicsData?.improved && dynamicsData.improved.length > 0
          ? ("up" as const)
          : ("stable" as const);

      result.push({
        id: String(profile.id),
        name: `${user.firstName} ${user.lastName}`.trim(),
        initials: initials(user.firstName, user.lastName),
        status: profile.status,
        since: ruDate(profile.createdAt),
        lastSession: clientSessions[0] ? ruDate(clientSessions[0].sessionDate) : "—",
        sessionsCount: clientSessions.length,
        focus: profile.focus,
        dynamics,
        riskFlag: lastWithRisk
          ? { severity: "medium" as const, label: "Есть сигналы риска — проверить сессию" }
          : undefined,
        pendingApprovals,
        homeworkActive: Number(hwActive[0]?.n ?? 0),
        avatarHue: profile.avatarHue,
      });
    }
    return result;
  }),

  createInvite: therapistQuery
    .input(z.object({ focus: z.string().max(255).default("") }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const code = randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      await db.insert(invites).values({
        code,
        therapistId: ctx.user.id,
        focus: input.focus,
        expiresAt,
      });
      await logAudit(ctx.user.id, ctx.user.firstName, "client.invite_created", "invite", code);
      return { code, expiresAt: ruDateTime(expiresAt) };
    }),

  archive: therapistQuery
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.clientProfiles.findFirst({
        where: and(
          eq(clientProfiles.id, input.clientId),
          eq(clientProfiles.therapistId, ctx.user.id),
        ),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Клиент не найден" });
      await db
        .update(clientProfiles)
        .set({ status: profile.status === "archived" ? "active" : "archived" })
        .where(eq(clientProfiles.id, profile.id));
      await logAudit(ctx.user.id, ctx.user.firstName, "client.archive_toggle", "client", String(profile.id));
      return { ok: true };
    }),

  updateFocus: therapistQuery
    .input(z.object({ clientId: z.number(), focus: z.string().max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(clientProfiles)
        .set({ focus: input.focus })
        .where(
          and(eq(clientProfiles.id, input.clientId), eq(clientProfiles.therapistId, ctx.user.id)),
        );
      return { ok: true };
    }),

  // current client user's own profile (for the client cabinet)
  myProfile: authedQuery.query(async ({ ctx }) => {
    if (ctx.user.role !== "client") return null;
    const db = getDb();
    const profile = await db.query.clientProfiles.findFirst({
      where: eq(clientProfiles.userId, ctx.user.id),
    });
    if (!profile) return null;
    const therapistUser = await db.query.users.findFirst({
      where: eq(users.id, profile.therapistId),
    });
    const sessionsCount = await db
      .select({ n: sql<number>`count(*)` })
      .from(sessions)
      .where(and(eq(sessions.clientId, profile.id), eq(sessions.status, "sent_to_client")));
    return {
      id: String(profile.id),
      name: ctx.user.firstName,
      therapistName: therapistUser
        ? `${therapistUser.firstName} ${therapistUser.lastName}`.trim()
        : "—",
      sessionsCount: Number(sessionsCount[0]?.n ?? 0),
    };
  }),
});
