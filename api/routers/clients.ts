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
import { hashPassword } from "../auth/session";

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

    if (profiles.length === 0) return [];
    const clientIds = profiles.map(({ profile }) => profile.id);
    const allSessions = await db
      .select()
      .from(sessions)
      .where(inArray(sessions.clientId, clientIds))
      .orderBy(desc(sessions.sessionDate));
    const draftIds = allSessions
      .filter((session) => ["draft_ready", "therapist_review"].includes(session.status))
      .map((session) => session.id);
    const [unapprovedInsights, unapprovedThemes, activeHomework] = await Promise.all([
      draftIds.length > 0
        ? db.select({ sessionId: insights.sessionId }).from(insights)
            .where(and(inArray(insights.sessionId, draftIds), eq(insights.approved, false)))
        : Promise.resolve([]),
      draftIds.length > 0
        ? db.select({ sessionId: themes.sessionId }).from(themes)
            .where(and(inArray(themes.sessionId, draftIds), eq(themes.approved, false)))
        : Promise.resolve([]),
      db.select({ clientId: homework.clientId }).from(homework)
        .where(
          and(
            inArray(homework.clientId, clientIds),
            inArray(homework.status, ["assigned", "in_progress"]),
            eq(homework.approved, true),
          ),
        ),
    ]);
    const clientIdBySession = new Map(allSessions.map((session) => [session.id, session.clientId]));
    const pendingByClient = new Map<number, number>();
    for (const item of [...unapprovedInsights, ...unapprovedThemes]) {
      const clientId = clientIdBySession.get(item.sessionId);
      if (clientId) pendingByClient.set(clientId, (pendingByClient.get(clientId) ?? 0) + 1);
    }
    const homeworkByClient = new Map<number, number>();
    for (const item of activeHomework) {
      homeworkByClient.set(item.clientId, (homeworkByClient.get(item.clientId) ?? 0) + 1);
    }

    const result = [];
    for (const { profile, user } of profiles) {
      const clientSessions = allSessions.filter((session) => session.clientId === profile.id);

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
        pendingApprovals: pendingByClient.get(profile.id) ?? 0,
        homeworkActive: homeworkByClient.get(profile.id) ?? 0,
        avatarHue: profile.avatarHue,
      });
    }
    return result;
  }),

  createManual: therapistQuery
    .input(
      z.object({
        name: z.string().trim().min(1, "Укажите имя клиента").max(240),
        focus: z.string().trim().max(255).default(""),
        aiConsent: z.literal(true, {
          error: "Подтвердите, что клиент согласился на обработку записи",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const normalizedName = input.name.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
      const existingProfiles = await db
        .select({ profile: clientProfiles, user: users })
        .from(clientProfiles)
        .innerJoin(users, eq(users.id, clientProfiles.userId))
        .where(eq(clientProfiles.therapistId, ctx.user.id));
      const existing = existingProfiles.find(({ user }) =>
        `${user.firstName} ${user.lastName}`
          .toLocaleLowerCase("ru-RU")
          .replace(/\s+/g, " ")
          .trim() === normalizedName,
      );
      if (existing) {
        if (existing.profile.status === "archived" || !existing.profile.aiConsent) {
          await db
            .update(clientProfiles)
            .set({ status: "active", aiConsent: true })
            .where(eq(clientProfiles.id, existing.profile.id));
        }
        return { id: String(existing.profile.id), name: input.name, created: false };
      }

      const parts = input.name.split(/\s+/).filter(Boolean);
      const firstName = parts.shift() ?? input.name;
      const lastName = parts.join(" ");
      const internalId = randomBytes(12).toString("hex");
      const [{ id: userId }] = await db
        .insert(users)
        .values({
          email: `manual.${ctx.user.id}.${internalId}@local.yabolshe`,
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
          role: "client",
          firstName,
          lastName,
        })
        .$returningId();
      const [{ id }] = await db
        .insert(clientProfiles)
        .values({
          userId,
          therapistId: ctx.user.id,
          focus: input.focus,
          avatarHue: Math.floor(Math.random() * 360),
          aiConsent: true,
        })
        .$returningId();
      await logAudit(ctx.user.id, ctx.user.firstName, "client.created_manual", "client", String(id), {
        name: input.name,
      });
      return { id: String(id), name: input.name, created: true };
    }),

  createInvite: therapistQuery
    .input(
      z.object({
        email: z.string().email("Некорректный email"),
        focus: z.string().max(255).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const code = randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      await db.insert(invites).values({
        code,
        therapistId: ctx.user.id,
        email: input.email.toLowerCase().trim(),
        focus: input.focus,
        expiresAt,
      });
      await logAudit(ctx.user.id, ctx.user.firstName, "client.invite_created", "invite", code);
      return {
        code,
        email: input.email.toLowerCase().trim(),
        expiresAt: ruDateTime(expiresAt),
      };
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
