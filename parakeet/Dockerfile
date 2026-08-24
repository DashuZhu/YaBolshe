FROM python:3.11-slim

ARG NEMO_SPEECH_VERSION=0.1.0
ARG TARGETARCH

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip install "fastapi==0.116.1" "httpx==0.28.1" "uvicorn==0.35.0"

RUN case "${TARGETARCH}" in \
      amd64) nemo_arch=x86_64; nemo_sha256=0f74131d631ad2c694cf0ec53490866bb6461147959589a69fb6fc231944065b ;; \
      arm64) nemo_arch=aarch64; nemo_sha256=0e4112255d566de7bdd142f239e984995c4447103ba8feb41f2bb5c559d561d3 ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && archive="nemo-speech-${NEMO_SPEECH_VERSION}-linux-${nemo_arch}-cpu.tar.gz" \
    && curl -fL --retry 3 -o "/tmp/${archive}" \
      "https://github.com/NVIDIA/NeMo-Speech.cpp/releases/download/v${NEMO_SPEECH_VERSION}/${archive}" \
    && echo "${nemo_sha256}  /tmp/${archive}" | sha256sum -c - \
    && mkdir -p /opt/nemo-speech \
    && tar -xzf "/tmp/${archive}" --strip-components=1 -C /opt/nemo-speech \
    && rm "/tmp/${archive}"

WORKDIR /service
COPY server.py entrypoint.sh /service/
RUN chmod +x /service/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/service/entrypoint.sh"]
