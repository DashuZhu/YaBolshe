import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { authSessions, users, type User } from "@db/schema";

export const SESSION_COOKIE = "yb_session";
const SESSION_TTL_DAYS = 14;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // timing-safe-ish: bcrypt compare is already constant-time for our purposes
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createSession(userId: number, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(authSessions).values({
    userId,
    tokenHash: sha256(token),
    userAgent: userAgent?.slice(0, 250),
    expiresAt,
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await getDb().delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
}

export async function findUserByToken(token: string | undefined): Promise<User | undefined> {
  if (!token) return undefined;
  const db = getDb();
  const rows = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, sha256(token)),
        gt(authSessions.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  return rows[0]?.user;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookieHeader(token: string, maxAgeSec: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
