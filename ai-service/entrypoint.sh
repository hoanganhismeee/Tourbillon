#!/bin/bash
# Start Ollama server in background, pull model on first run, then start Flask

ollama serve &

echo "Waiting for Ollama to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done

BASE_MODEL="${BASE_LLM_MODEL:-qwen2.5:7b}"
CUSTOM_MODEL="${LLM_MODEL:-qwen2.5:7b}"

# Pull base model if not cached
if ollama list | grep -q "^${BASE_MODEL}"; then
  echo "Model ${BASE_MODEL} already cached, skipping pull."
else
  echo "Pulling ${BASE_MODEL}..."
  ollama pull "${BASE_MODEL}"
fi

# Create custom model with extended context from Modelfile
echo "Creating ${CUSTOM_MODEL} from Modelfile (num_ctx 4096)..."
ollama create "${CUSTOM_MODEL}" -f /app/Modelfile

echo "Starting Flask..."
python app.py &

# Warmup — load model into VRAM before first real user request
echo "Warming up model..."
until curl -sf http://localhost:5000/health > /dev/null 2>&1; do
  sleep 1
done
curl -sf -X POST http://localhost:5000/watch-finder/parse \
  -H "Content-Type: application/json" \
  -d '{"query":"dress watch"}' > /dev/null 2>&1
echo "Model warm, ready."

wait
