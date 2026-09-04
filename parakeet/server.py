import asyncio
import json
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse


NEMO_URL = "http://127.0.0.1:8080"
MODEL_NAME = "nvidia/parakeet-tdt-0.6b-v3:q8_0:cpu"

app = FastAPI(title="YaBolshe local Parakeet", docs_url=None, redoc_url=None)
transcription_lock = asyncio.Semaphore(1)
MAX_UPLOAD_BYTES = int(os.getenv("PARAKEET_MAX_UPLOAD_MB", "500")) * 1024 * 1024


@app.get("/health")
def health(response: Response) -> dict:
    try:
        ready = httpx.get(f"{NEMO_URL}/ready", timeout=5.0)
        if ready.status_code == 200 and ready.json().get("ready") is True:
            return {"ok": True, "model": MODEL_NAME, "busy": transcription_lock.locked()}
    except Exception:
        pass
    response.status_code = 503
    return {"ok": False, "model": MODEL_NAME, "busy": transcription_lock.locked()}


def _clean_text(tokens: list[str]) -> str:
    text = " ".join(token.strip() for token in tokens if token.strip())
    return re.sub(r"\s+([,.!?;:])", r"\1", text).strip()


def _segments_from_words(words: list[dict], full_text: str, duration: float) -> list[dict]:
    if not words:
        return (
            [{"start": 0.0, "end": duration, "text": full_text.strip(), "avg_logprob": -0.3}]
            if full_text.strip()
            else []
        )

    segments: list[dict] = []
    current: list[dict] = []
    for word in words:
        start = float(word.get("start", current[-1].get("end", 0.0) if current else 0.0))
        previous_end = float(current[-1].get("end", start)) if current else start
        current_duration = start - float(current[0].get("start", start)) if current else 0.0
        previous_text = str(current[-1].get("word", "")) if current else ""
        should_split = bool(current) and (
            start - previous_end > 1.2 or current_duration >= 12.0 or previous_text.rstrip().endswith((".", "!", "?"))
        )
        if should_split:
            segments.append(_make_segment(current))
            current = []
        current.append(word)
    if current:
        segments.append(_make_segment(current))
    return segments


def _make_segment(words: list[dict]) -> dict:
    confidences = [max(1e-6, min(1.0, float(word.get("confidence", 0.74)))) for word in words]
    confidence = sum(confidences) / len(confidences)
    return {
        "start": float(words[0].get("start", 0.0)),
        "end": float(words[-1].get("end", words[0].get("start", 0.0))),
        "text": _clean_text([str(word.get("word", "")) for word in words]),
        "avg_logprob": math.log(confidence),
    }


def run_transcription(source_path: str, language: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="parakeet-") as temp_dir:
        wav_path = Path(temp_dir) / "audio.wav"
        conversion = subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", source_path, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav_path),
            ],
            capture_output=True,
            text=True,
            timeout=1800,
        )
        if conversion.returncode != 0:
            raise RuntimeError(f"audio conversion failed: {conversion.stderr[-300:]}")

        with wav_path.open("rb") as audio_file, httpx.Client(timeout=4 * 60 * 60) as client:
            result = client.post(
                f"{NEMO_URL}/v1/audio/transcriptions",
                files={"file": ("audio.wav", audio_file, "audio/wav")},
                data={"language": language, "response_format": "verbose_json"},
            )
        if result.status_code != 200:
            raise RuntimeError(f"Parakeet error {result.status_code}: {result.text[:300]}")

        data = result.json()
        duration = float(data.get("duration", 0.0))
        return {
            "duration": duration,
            "language": data.get("language", language),
            "model": MODEL_NAME,
            "segments": _segments_from_words(data.get("words", []), data.get("text", ""), duration),
        }


@app.post("/transcribe")
async def transcribe(request: Request, language: str = "ru"):
    encoded_name = request.headers.get("x-filename", "audio.mp3")
    suffix = Path(unquote(encoded_name)).suffix.lower() or ".mp3"
    source_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as source_file:
            source_path = source_file.name
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="audio file is too large")
                source_file.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="empty audio file")
        async def stream_result():
            task = None
            try:
                async with transcription_lock:
                    task = asyncio.create_task(asyncio.to_thread(run_transcription, source_path, language))
                    while True:
                        try:
                            result = await asyncio.wait_for(asyncio.shield(task), timeout=15)
                            yield json.dumps(result, ensure_ascii=False)
                            return
                        except asyncio.TimeoutError:
                            # Keep the HTTP connection alive while the CPU model works.
                            yield " \n"
            finally:
                if task is not None and not task.done():
                    try:
                        await asyncio.shield(task)
                    except (Exception, asyncio.CancelledError):
                        pass
                Path(source_path).unlink(missing_ok=True)

        return StreamingResponse(stream_result(), media_type="application/json")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc
    except BaseException:
        if source_path:
            Path(source_path).unlink(missing_ok=True)
        raise
