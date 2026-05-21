FROM python:3.11-slim

# System deps: ffmpeg for decoding most audio formats, sox/soxr for transkun's
# audio I/O, libsndfile for torchaudio backends.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    sox \
    libsox-fmt-all \
    libsndfile1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU PyTorch from the official index so we don't pull the multi-GB
# CUDA wheels.
RUN pip install --no-cache-dir \
    torch==2.4.1 torchaudio==2.4.1 \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Warm-cache the transkun import so the first request doesn't pay for it.
RUN python -c "import transkun" || true

COPY main.py .

ENV TRANSKUN_DEVICE=cpu
ENV TRANSKUN_WORK_DIR=/tmp/transkun-jobs

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
