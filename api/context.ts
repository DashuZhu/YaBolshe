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
  let user: User | undefined;
  try {
    user = await findUserByToken(token);
  } catch (err) {
    console.error("session lookup failed", err);
  }
  return { req: opts.req, resHeaders: opts.resHeaders, user };
}
