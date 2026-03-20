# AI service — CUDA-enabled Ubuntu base so Ollama can use the host GPU via NVIDIA Container Toolkit.
# Swap back to python:3.12-bookworm if running CPU-only and image size matters.
FROM nvidia/cuda:12.4.1-base-ubuntu22.04

# Install Python 3.10 (Ubuntu 22.04 default), pip, curl (Ollama installer + healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl zstd \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3 /usr/bin/python

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

RUN chmod +x entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]
