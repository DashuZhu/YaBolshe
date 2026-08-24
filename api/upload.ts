import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { sessions } from "@db/schema";
import { findUserByToken, readCookie, SESSION_COOKIE } from "./auth/session";
import { processSession } from "./ai/pipeline";
import { logAudit } from "./queries/audit";

const UPLOAD_DIR = () => process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads");
const MAX_BYTES = () => Number(process.env.MAX_UPLOAD_MB ?? 250) * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".mp3", ".wav", ".m4a", ".aac", ".flac", ".opus", ".ogg",
  ".mp4", ".mov", ".mkv", ".avi", ".mpeg", ".mpga", ".webm",
  ".3gp", ".3g2", ".ts", ".mts", ".m2ts",
]);

export async function handleUpload(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = Number(url.searchParams.get("sessionId"));
    if (!Number.isFinite(sessionId)) {
      return Response.json({ error: "sessionId обязателен" }, { status: 400 });
    }

    const token = readCookie(req, SESSION_COOKIE);
    const user = await findUserByToken(token);
    if (!user || (user.role !== "therapist" && user.role !== "admin")) {
      return Response.json({ error: "Требуется вход терапевта" }, { status: 401 });
    }

    const db = getDb();
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.therapistId, user.id)),
    });
    if (!session) {
      return Response.json({ error: "Сессия не найдена" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Файл не передан" }, { status: 400 });
    }
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return Response.json(
        { error: `Формат ${ext || "без расширения"} не поддерживается. Выберите обычный аудио- или видеофайл.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES()) {
      return Response.json(
        {
          error: `Файл больше ${Math.round(MAX_BYTES() / 1024 / 1024)} МБ. Сожмите запись или загрузите только аудиодорожку.`,
        },
        { status: 413 },
      );
    }

    await mkdir(UPLOAD_DIR(), { recursive: true });
    const safeName = `session-${sessionId}-${Date.now()}${ext}`;
    const fullPath = join(UPLOAD_DIR(), safeName);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, bytes);

    await db
      .update(sessions)
      .set({
        hasMedia: true,
        mediaPath: fullPath,
        mediaSizeBytes: file.size,
        status: "queued",
      })
      .where(eq(sessions.id, sessionId));

    await logAudit(user.id, user.firstName, "session.upload", "session", String(sessionId), {
      fileName: file.name,
      sizeBytes: file.size,
    });

    // fire-and-forget async processing
    void processSession(sessionId);

    return Response.json({ ok: true, sessionId });
  } catch (err) {
    console.error("upload failed", err);
    return Response.json({ error: "Не удалось сохранить файл. Попробуйте ещё раз." }, { status: 500 });
  }
}
