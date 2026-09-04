import asyncio
import math
import os
import tempfile
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Request
from faster_whisper import WhisperModel


MODEL_NAME = os.getenv("WHISPER_MODEL", "medium")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "8"))
NUM_WORKERS = int(os.getenv("WHISPER_NUM_WORKERS", "1"))
MODEL_DIR = os.getenv("HF_HOME", "/models")
MAX_UPLOAD_BYTES = int(os.getenv("WHISPER_MAX_UPLOAD_MB", "250")) * 1024 * 1024

app = FastAPI(title="YaBolshe local Whisper", docs_url=None, redoc_url=None)
model: WhisperModel | None = None
transcription_lock = asyncio.Semaphore(1)


@app.on_event("startup")
def load_model() -> None:
    global model
    model = WhisperModel(
        MODEL_NAME,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
        num_workers=NUM_WORKERS,
        download_root=MODEL_DIR,
    )


@app.get("/health")
def health() -> dict:
    return {
        "ok": model is not None,
        "model": MODEL_NAME,
        "compute_type": COMPUTE_TYPE,
        "busy": transcription_lock.locked(),
    }


def run_transcription(path: str, language: str) -> dict:
    if model is None:
        raise RuntimeError("model is not loaded")

    segments, info = model.transcribe(
        path,
        language=language,
        task="transcribe",
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    result = []
    for segment in segments:
        avg_logprob = float(getattr(segment, "avg_logprob", -0.3))
        if not math.isfinite(avg_logprob):
            avg_logprob = -0.3
        result.append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
                "avg_logprob": avg_logprob,
            }
        )
    return {"duration": float(info.duration), "language": info.language, "segments": result}


@app.post("/transcribe")
async def transcribe(request: Request, language: str = "ru") -> dict:
    encoded_name = request.headers.get("x-filename", "audio.mp3")
    suffix = Path(unquote(encoded_name)).suffix.lower() or ".mp3"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_path = temp_file.name
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="audio file is too large")
                temp_file.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="empty audio file")
        async with transcription_lock:
            return await asyncio.to_thread(run_transcription, temp_path, language)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
