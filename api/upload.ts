import { mkdir, open, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { sessions, sessionFiles } from "@db/schema";
import { findUserByToken, readCookie, SESSION_COOKIE } from "./auth/session";
import { logAudit } from "./queries/audit";

const UPLOAD_DIR = () => process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads");
const MAX_BYTES = () => Number(process.env.MAX_UPLOAD_MB ?? 500) * 1024 * 1024;
const AUDIO_VIDEO_EXT = new Set([
  ".mp3", ".wav", ".m4a", ".aac", ".flac", ".opus", ".ogg",
  ".mp4", ".mov", ".mkv", ".avi", ".mpeg", ".mpga", ".webm",
  ".3gp", ".3g2", ".ts", ".mts", ".m2ts",
]);
const TEXT_EXT = new Set([".txt"]);

type SpeakerHint = "therapist" | "client" | "unknown";

function uploadFileName(req: Request): string {
  const encoded = req.headers.get("x-filename") ?? "";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function speakerHintFromHeader(req: Request): SpeakerHint {
  const raw = req.headers.get("x-speaker-hint");
  return raw === "therapist" || raw === "client" ? raw : "unknown";
}

async function streamRequestToFile(req: Request, fullPath: string): Promise<number> {
  if (!req.body) throw new Error("Файл не передан");

  const declaredSize = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BYTES()) {
    throw new UploadTooLargeError();
  }

  const handle = await open(fullPath, "wx");
  const reader = req.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES()) throw new UploadTooLargeError();
      await handle.write(value);
    }
    if (size === 0) throw new Error("Файл пуст");
    return size;
  } finally {
    reader.releaseLock();
    await handle.close();
  }
}

class UploadTooLargeError extends Error {}

export async function handleUpload(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = Number(url.searchParams.get("sessionId"));
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
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

    const fileName = uploadFileName(req);
    if (!fileName) {
      return Response.json({ error: "Имя файла не передано" }, { status: 400 });
    }
    const ext = extname(fileName).toLowerCase();
    const kind: "audio_video" | "text" | null = AUDIO_VIDEO_EXT.has(ext)
      ? "audio_video"
      : TEXT_EXT.has(ext)
        ? "text"
        : null;
    if (!kind) {
      return Response.json(
        {
          error: `Формат ${ext || "без расширения"} не поддерживается. Загрузите аудио/видео запись или текстовый файл расшифровки (.txt).`,
        },
        { status: 400 },
      );
    }
    await mkdir(UPLOAD_DIR(), { recursive: true });
    const safeName = `session-${sessionId}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const fullPath = join(UPLOAD_DIR(), safeName);
    let size = 0;
    try {
      size = await streamRequestToFile(req, fullPath);
    } catch (err) {
      await unlink(fullPath).catch(() => undefined);
      if (err instanceof UploadTooLargeError) {
        return Response.json(
          {
            error: `Файл больше ${Math.round(MAX_BYTES() / 1024 / 1024)} МБ. Сожмите запись или загрузите только аудиодорожку.`,
          },
          { status: 413 },
        );
      }
      throw err;
    }

    await db.insert(sessionFiles).values({
      sessionId,
      kind,
      speakerHint: speakerHintFromHeader(req),
      filePath: fullPath,
      originalName: fileName,
      sizeBytes: size,
    });

    if (kind === "audio_video") {
      await db.update(sessions).set({ hasMedia: true }).where(eq(sessions.id, sessionId));
    }

    await logAudit(user.id, user.firstName, "session.upload", "session", String(sessionId), {
      fileName,
      sizeBytes: size,
      kind,
    });

    return Response.json({ ok: true, sessionId });
  } catch (err) {
    console.error("upload failed", err);
    return Response.json({ error: "Не удалось сохранить файл. Попробуйте ещё раз." }, { status: 500 });
  }
}
