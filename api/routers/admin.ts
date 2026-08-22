import { desc, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users, clientProfiles, sessions, tokenUsage, auditLogs } from "@db/schema";
import { ruDateTime, ruDateShort } from "../queries/serialize";

export const adminRouter = createRouter({
  users: adminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
    const result = [];
    for (const u of all) {
      let clientsInfo = "—";
      if (u.role === "therapist") {
        const n = await db
          .select({ n: sql<number>`count(*)` })
          .from(clientProfiles)
          .where(sql`therapist_id = ${u.id} AND status = 'active'`);
        clientsInfo = `${Number(n[0]?.n ?? 0)} / 20`;
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
        role: u.role === "therapist" ? "Терапевт" : u.role === "client" ? "Клиент" : "Администратор",
        clients: clientsInfo,
        monthSessions: Number(monthSessions[0]?.n ?? 0),
        status: u.status,
      });
    }
    return result;
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
