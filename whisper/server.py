import asyncio
import json
import math
import os
import tempfile
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from faster_whisper import BatchedInferencePipeline, WhisperModel


MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "8"))
NUM_WORKERS = int(os.getenv("WHISPER_NUM_WORKERS", "1"))
BATCH_SIZE = int(os.getenv("WHISPER_BATCH_SIZE", "8"))
MODEL_DIR = os.getenv("HF_HOME", "/models")
MAX_UPLOAD_BYTES = int(os.getenv("WHISPER_MAX_UPLOAD_MB", "500")) * 1024 * 1024

app = FastAPI(title="YaBolshe local Whisper", docs_url=None, redoc_url=None)
model: WhisperModel | None = None
batched_model: BatchedInferencePipeline | None = None
transcription_lock = asyncio.Semaphore(1)


@app.on_event("startup")
def load_model() -> None:
    global model, batched_model
    model = WhisperModel(
        MODEL_NAME,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
        num_workers=NUM_WORKERS,
        download_root=MODEL_DIR,
    )
    batched_model = BatchedInferencePipeline(model=model)


@app.get("/health")
def health() -> dict:
    return {
        "ok": model is not None and batched_model is not None,
        "model": MODEL_NAME,
        "compute_type": COMPUTE_TYPE,
        "batch_size": BATCH_SIZE,
        "busy": transcription_lock.locked(),
    }


def run_transcription(path: str, language: str) -> dict:
    if batched_model is None:
        raise RuntimeError("model is not loaded")

    segments, info = batched_model.transcribe(
        path,
        batch_size=BATCH_SIZE,
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
async def transcribe(request: Request, language: str = "ru"):
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
        async def stream_result():
            task = None
            try:
                async with transcription_lock:
                    task = asyncio.create_task(asyncio.to_thread(run_transcription, temp_path, language))
                    while True:
                        try:
                            result = await asyncio.wait_for(asyncio.shield(task), timeout=15)
                            yield json.dumps(result, ensure_ascii=False)
                            return
                        except asyncio.TimeoutError:
                            yield " \n"
            finally:
                if task is not None and not task.done():
                    try:
                        await asyncio.shield(task)
                    except (Exception, asyncio.CancelledError):
                        pass
                Path(temp_path).unlink(missing_ok=True)

        return StreamingResponse(stream_result(), media_type="application/json")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc
    except BaseException:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
        raise
