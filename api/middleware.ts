import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется вход в систему" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireRole = (roles: Array<"therapist" | "client" | "admin" | "owner">) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется вход в систему" });
    }
    const allowedAsPlatformOwner = roles.includes("owner") && ctx.user.isPlatformOwner;
    if (!roles.includes(ctx.user.role) && !allowedAsPlatformOwner) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Недостаточно прав" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

export const authedQuery = t.procedure.use(requireAuth);
export const therapistQuery = t.procedure.use(requireRole(["therapist"]));
export const clientQuery = t.procedure.use(requireRole(["client"]));
export const adminQuery = t.procedure.use(requireRole(["admin", "owner"]));
export const ownerQuery = t.procedure.use(requireRole(["owner"]));
