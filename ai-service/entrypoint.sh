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

# Pull embedding model if not cached (nomic-embed-text: 768-dim, free, runs alongside LLM)
if ollama list | grep -q "^nomic-embed-text"; then
  echo "nomic-embed-text already cached."
else
  echo "Pulling nomic-embed-text..."
  ollama pull nomic-embed-text
fi

# Create custom model with extended context from Modelfile
echo "Creating ${CUSTOM_MODEL} from Modelfile (num_ctx 4096)..."
ollama create "${CUSTOM_MODEL}" -f /app/Modelfile

echo "Starting Flask..."
python app.py &

# Warmup — load BOTH models into VRAM before signalling ready.
# /tmp/ai_ready is the sentinel Docker healthcheck waits for.
# Without this, the backend would start serving users while models are still cold.
echo "Warming up models..."
until curl -sf http://localhost:5000/health > /dev/null 2>&1; do
  sleep 1
done

# Warm LLM (qwen / haiku)
curl -sf -X POST http://localhost:5000/watch-finder/parse \
  -H "Content-Type: application/json" \
  -d '{"query":"dress watch"}' > /dev/null 2>&1
echo "LLM warm."

# Warm embedding model (nomic-embed-text)
curl -sf -X POST http://localhost:5000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts":["dress watch"]}' > /dev/null 2>&1
echo "Embed model warm."

touch /tmp/ai_ready
echo "AI service ready."

wait
