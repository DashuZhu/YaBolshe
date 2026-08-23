import { randomBytes } from "node:crypto";
import { z } from "zod";
import { desc, sql, eq, isNull, gt, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  users,
  clientProfiles,
  sessions,
  tokenUsage,
  auditLogs,
  accountInvites,
  therapistProfiles,
} from "@db/schema";
import { ruDateTime, ruDateShort } from "../queries/serialize";
import { logAudit } from "../queries/audit";

export const adminRouter = createRouter({
  users: adminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
    const result = [];
    for (const u of all) {
      let clientsInfo = "—";
      let plan = "—";
      if (u.role === "therapist") {
        const n = await db
          .select({ n: sql<number>`count(*)` })
          .from(clientProfiles)
          .where(sql`therapist_id = ${u.id} AND status = 'active'`);
        clientsInfo = `${Number(n[0]?.n ?? 0)} / 20`;
        const profile = await db.query.therapistProfiles.findFirst({
          where: eq(therapistProfiles.userId, u.id),
        });
        plan = profile
          ? `${profile.plan === "free" ? "Бесплатный" : "Pro"} · ${profile.subscriptionStatus}`
          : "—";
      }
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthSessions = await db
        .select({ n: sql<number>`count(*)` })
        .from(sessions)
        .where(sql`therapist_id = ${u.id} AND session_date >= ${monthStart}`);
      result.push({
        id: String(u.id),
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        roleKey: u.role,
        role:
          u.role === "therapist"
            ? "Терапевт"
            : u.role === "client"
              ? "Клиент"
              : u.role === "owner"
                ? "Владелец"
                : "Администратор",
        clients: clientsInfo,
        plan,
        monthSessions: Number(monthSessions[0]?.n ?? 0),
        status: u.status,
      });
    }
    return result;
  }),

  accountInvites: adminQuery.query(async () => {
    const rows = await getDb()
      .select()
      .from(accountInvites)
      .orderBy(desc(accountInvites.createdAt))
      .limit(100);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      plan: row.plan,
      code: row.usedByUserId ? null : row.code,
      status: row.usedByUserId
        ? ("used" as const)
        : row.expiresAt <= new Date()
          ? ("expired" as const)
          : ("active" as const),
      expiresAt: ruDateTime(row.expiresAt),
    }));
  }),

  createAccountInvite: adminQuery
    .input(
      z.object({
        email: z.string().email("Некорректный email"),
        role: z.enum(["therapist", "admin", "owner"]).default("therapist"),
        plan: z.enum(["free", "pro"]).default("free"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (ctx.user.role !== "owner" && input.role !== "therapist") {
        const ownerCount = await db
          .select({ n: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, "owner"));
        const mayBootstrapFirstOwner = input.role === "owner" && Number(ownerCount[0]?.n ?? 0) === 0;
        if (!mayBootstrapFirstOwner) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Только владелец платформы может приглашать администраторов и владельцев",
          });
        }
      }
      const email = input.email.toLowerCase().trim();
      const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "Пользователь с такой почтой уже есть" });
      }
      const existingInvite = await db.query.accountInvites.findFirst({
        where: and(
          eq(accountInvites.email, email),
          isNull(accountInvites.usedByUserId),
          gt(accountInvites.expiresAt, new Date()),
        ),
      });
      if (existingInvite) {
        return {
          code: existingInvite.code,
          email,
          expiresAt: ruDateTime(existingInvite.expiresAt),
        };
      }
      const code = randomBytes(16).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await db.insert(accountInvites).values({
        code,
        email,
        role: input.role,
        plan: input.role === "therapist" ? input.plan : "free",
        invitedByUserId: ctx.user.id,
        expiresAt,
      });
      await logAudit(
        ctx.user.id,
        ctx.user.firstName,
        "account.invite_created",
        "account_invite",
        email,
        { role: input.role, plan: input.plan },
      );
      return { code, email, expiresAt: ruDateTime(expiresAt) };
    }),

  usage: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(tokenUsage).orderBy(desc(tokenUsage.createdAt)).limit(500);
    // aggregate by day
    const byDay = new Map<string, { tokens: number; cost: number }>();
    for (const r of rows) {
      const key = ruDateShort(r.createdAt);
      const cur = byDay.get(key) ?? { tokens: 0, cost: 0 };
      cur.tokens += r.inputTokens + r.outputTokens;
      cur.cost += r.costEstimate;
      byDay.set(key, cur);
    }
    const series = [...byDay.entries()]
      .map(([day, v]) => ({ day, tokens: v.tokens, cost: Math.round(v.cost * 100) / 100 }))
      .reverse();
    const totalTokens = rows.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0);
    const totalCost = Math.round(rows.reduce((a, r) => a + r.costEstimate, 0) * 100) / 100;
    return { series, totalTokens, totalCost };
  }),

  audit: adminQuery.query(async () => {
    const rows = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return rows.map((r) => ({
      time: ruDateTime(r.createdAt),
      actor: r.actorName,
      action: r.action,
      entity: `${r.entityType}:${r.entityId}`,
      meta: r.metaJson ? JSON.stringify(r.metaJson) : "",
    }));
  }),
});
