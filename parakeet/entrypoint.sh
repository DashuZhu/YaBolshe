#!/bin/sh
set -eu

model_dir=${PARAKEET_MODEL_DIR:-/models}
model_file="$model_dir/parakeet-tdt-0.6b-v3.q8_0.gguf"
model_url=https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3/resolve/main/parakeet-tdt-0.6b-v3.q8_0.gguf
model_sha256=e3880d0aaaaf2c308ea2c35016b2b895c423eb3fda924c1b463d1c19b7f4d32e

mkdir -p "$model_dir"
if [ ! -f "$model_file" ] || ! echo "$model_sha256  $model_file" | sha256sum -c - >/dev/null 2>&1; then
  echo "Downloading verified Parakeet TDT 0.6B v3 model..."
  curl -fL --retry 5 -o "$model_file.part" "$model_url"
  echo "$model_sha256  $model_file.part" | sha256sum -c -
  mv "$model_file.part" "$model_file"
fi

LD_LIBRARY_PATH=/opt/nemo-speech/lib /opt/nemo-speech/bin/nemo-speech serve \
  --asr-model "$model_file" \
  --host 127.0.0.1 \
  --port 8080 \
  --no-ui \
  --threads "${PARAKEET_THREADS:-8}" \
  --max-upload-mb "${PARAKEET_MAX_UPLOAD_MB:-300}" \
  --read-timeout 3600 \
  --write-timeout 3600 &
nemo_pid=$!

uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1 &
api_pid=$!

cleanup() {
  kill "$nemo_pid" 2>/dev/null || true
  kill "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

while kill -0 "$nemo_pid" 2>/dev/null && kill -0 "$api_pid" 2>/dev/null; do
  sleep 5
done

echo "Parakeet service process stopped unexpectedly" >&2
exit 1
