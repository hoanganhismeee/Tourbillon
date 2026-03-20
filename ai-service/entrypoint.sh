#!/bin/bash
# Start Ollama server in background, pull model on first run, then start Flask

ollama serve &

echo "Waiting for Ollama to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done

MODEL="${LLM_MODEL:-qwen3:8b}"
if ollama list | grep -q "^${MODEL}"; then
  echo "Model ${MODEL} already cached, skipping pull."
else
  echo "Pulling ${MODEL}..."
  ollama pull "${MODEL}"
fi

echo "Starting Flask..."
exec python app.py
