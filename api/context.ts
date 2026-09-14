import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { findUserByToken, readCookie, SESSION_COOKIE } from "./auth/session";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const token = readCookie(opts.req, SESSION_COOKIE);
  if (!token) {
    // No cookie at all — genuinely logged out, not an error.
    return { req: opts.req, resHeaders: opts.resHeaders, user: undefined };
  }
  let user: User | undefined;
  try {
    user = await findUserByToken(token);
  } catch (err) {
    // A DB hiccup here must never be reported as "not logged in" — a
    // therapist who briefly loses their DB connection would otherwise get
    // silently kicked to the login screen on their next click, even though
    // their session cookie is perfectly valid. Retry once before giving up,
    // and if it still fails, surface a real error instead of pretending the
    // user has no session (auth.me would legitimately return null and the
    // frontend would treat that as a real logout).
    console.warn("session lookup failed, retrying once", err);
    try {
      user = await findUserByToken(token);
    } catch (err2) {
      console.error("session lookup failed twice", err2);
      throw new Error("Не удалось проверить сессию — обновите страницу через момент");
    }
  }
  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
