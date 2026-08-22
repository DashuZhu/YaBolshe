import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./auth/router";
import { clientsRouter } from "./routers/clients";
import { sessionsRouter } from "./routers/sessions";
import {
  homeworkRouter,
  agreementsRouter,
  roadmapRouter,
  notesRouter,
  checkInsRouter,
  insightsRouter,
} from "./routers/materials";
import { adminRouter } from "./routers/admin";
import { aiEnabled } from "./ai/openai";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now(), aiEnabled: aiEnabled() })),

  auth: authRouter,
  clients: clientsRouter,
  sessions: sessionsRouter,
  homework: homeworkRouter,
  agreements: agreementsRouter,
  roadmap: roadmapRouter,
  notes: notesRouter,
  checkins: checkInsRouter,
  insights: insightsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
