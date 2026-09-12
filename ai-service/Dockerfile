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

# Same weights baked in as the production image, so dev and prod embed into the same space
# and a local eval measures the pipeline production actually runs.
ARG LOCAL_EMBED_MODEL=sentence-transformers/all-mpnet-base-v2
ENV LOCAL_EMBED_MODEL=${LOCAL_EMBED_MODEL}
RUN python -c "from sentence_transformers import SentenceTransformer; import os; SentenceTransformer(os.environ['LOCAL_EMBED_MODEL'])"

COPY . .

RUN chmod +x entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]
