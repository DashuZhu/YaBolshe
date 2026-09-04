import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { handleUpload } from "./upload";
import { env } from "./lib/env";
import { resumePendingSessions } from "./ai/pipeline";
import { transcriptionHealth } from "./ai/openai";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use("/api/trpc/*", bodyLimit({ maxSize: 10 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
// Keep a small transport margin above the advertised 500 MB file limit.
app.post("/api/upload", bodyLimit({ maxSize: 505 * 1024 * 1024 }), async (c) => {
  return handleUpload(c.req.raw);
});
app.get("/api/health", async (c) => {
  const started = Date.now();
  let databaseOk = false;
  let databaseMs = 0;
  try {
    const dbStarted = Date.now();
    await getDb().select({ id: users.id }).from(users).limit(1);
    databaseMs = Date.now() - dbStarted;
    databaseOk = true;
  } catch {
    databaseMs = Date.now() - started;
  }
  const transcription = await transcriptionHealth();
  const ok = databaseOk && transcription.length > 0 && transcription.some((service) => service.ok);
  return c.json(
    {
      ok,
      database: { ok: databaseOk, responseMs: databaseMs },
      transcription,
      totalMs: Date.now() - started,
    },
    ok ? 200 : 503,
  );
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
    void resumePendingSessions().catch((error) => console.error("failed to resume processing queue", error));
  });
}
