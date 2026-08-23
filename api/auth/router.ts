import { z } from "zod";
import { eq, and, isNull, gt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  users,
  invites,
  accountInvites,
  therapistProfiles,
  clientProfiles,
} from "@db/schema";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  readCookie,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE,
} from "./session";
import { logAudit } from "../queries/audit";

const passwordSchema = z.string().min(8, "Пароль — минимум 8 символов").max(100);

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
  };
}

export const authRouter = createRouter({
  me: publicQuery.query(({ ctx }) => (ctx.user ? publicUser(ctx.user) : null)),

  registerInvited: publicQuery
    .input(
      z.object({
        inviteCode: z.string().min(8, "Укажите код приглашения"),
        email: z.string().email("Некорректный email"),
        password: passwordSchema,
        firstName: z.string().min(1, "Укажите имя").max(120),
        lastName: z.string().max(120).default(""),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const invite = await db.query.accountInvites.findFirst({
        where: and(
          eq(accountInvites.code, input.inviteCode.trim().toUpperCase()),
          eq(accountInvites.email, email),
          isNull(accountInvites.usedByUserId),
          gt(accountInvites.expiresAt, new Date()),
        ),
      });
      if (!invite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Приглашение не найдено, уже использовано или выдано на другую почту",
        });
      }
      const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Пользователь с таким email уже есть" });
      }
      const [{ id }] = await db
        .insert(users)
        .values({
          email,
          passwordHash: await hashPassword(input.password),
          role: invite.role,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
        })
        .$returningId();
      if (invite.role === "therapist") {
        await db.insert(therapistProfiles).values({
          userId: id,
          plan: invite.plan,
          subscriptionStatus: "active",
        });
      }
      await db
        .update(accountInvites)
        .set({ usedByUserId: id })
        .where(and(eq(accountInvites.id, invite.id), isNull(accountInvites.usedByUserId)));
      await logAudit(
        id,
        `${input.firstName} ${input.lastName}`,
        "auth.register_invited",
        "user",
        String(id),
        { role: invite.role, plan: invite.plan },
      );
      const token = await createSession(id, ctx.req.headers.get("user-agent") ?? undefined);
      ctx.resHeaders.append("set-cookie", sessionCookieHeader(token, 14 * 24 * 3600));
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      return publicUser(user!);
    }),

  registerClient: publicQuery
    .input(
      z.object({
        inviteCode: z.string().min(4, "Укажите код приглашения"),
        email: z.string().email("Некорректный email"),
        password: passwordSchema,
        firstName: z.string().min(1, "Укажите имя").max(120),
        lastName: z.string().max(120).default(""),
        aiConsent: z.literal(true, {
          error: "Нужно согласие на AI-обработку сессий — его можно отозвать в любой момент",
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const invite = await db.query.invites.findFirst({
        where: and(
          eq(invites.code, input.inviteCode.trim().toUpperCase()),
          or(isNull(invites.email), eq(invites.email, email)),
          isNull(invites.usedByUserId),
          gt(invites.expiresAt, new Date()),
        ),
      });
      if (!invite) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Код приглашения недействителен или истёк" });
      }
      const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Пользователь с таким email уже есть" });
      }
      const [{ id }] = await db
        .insert(users)
        .values({
          email,
          passwordHash: await hashPassword(input.password),
          role: "client",
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
        })
        .$returningId();
      const hue = Math.floor(Math.random() * 360);
      await db.insert(clientProfiles).values({
        userId: id,
        therapistId: invite.therapistId,
        focus: invite.focus,
        avatarHue: hue,
        aiConsent: true,
      });
      await db.update(invites).set({ usedByUserId: id }).where(eq(invites.id, invite.id));
      await logAudit(id, `${input.firstName} ${input.lastName}`, "auth.register_client", "user", String(id), {
        inviteCode: invite.code,
      });
      const token = await createSession(id, ctx.req.headers.get("user-agent") ?? undefined);
      ctx.resHeaders.append("set-cookie", sessionCookieHeader(token, 14 * 24 * 3600));
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      return publicUser(user!);
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email("Введите корректную почту"),
        password: z.string().min(1, "Введите пароль"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      const ok = user && (await verifyPassword(input.password, user.passwordHash));
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный email или пароль" });
      }
      if (user.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Аккаунт заблокирован" });
      }
      const token = await createSession(user.id, ctx.req.headers.get("user-agent") ?? undefined);
      ctx.resHeaders.append("set-cookie", sessionCookieHeader(token, 14 * 24 * 3600));
      await logAudit(user.id, `${user.firstName} ${user.lastName}`, "auth.login", "user", String(user.id));
      return publicUser(user);
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const token = readCookie(ctx.req, SESSION_COOKIE);
    if (token) await destroySession(token);
    ctx.resHeaders.append("set-cookie", clearSessionCookieHeader());
    return { ok: true };
  }),
});
