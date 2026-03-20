# AI service — watch finder endpoints: intent parsing, candidate reranking, embedding generation
import json
import os
import re
import threading

from flask import Flask, jsonify, request
from openai import OpenAI

app = Flask(__name__)

# LLM client — points to Ollama locally, swappable to Anthropic via env vars
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL    = os.getenv("LLM_MODEL", "qwen2.5:7b")
LLM_API_KEY  = os.getenv("LLM_API_KEY", "ollama")

client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

# Embedding client — always Ollama regardless of LLM choice (nomic-embed-text is local only)
EMBED_BASE_URL = os.getenv("EMBED_BASE_URL", "http://localhost:11434/v1")
EMBED_MODEL    = "nomic-embed-text"
embed_client   = OpenAI(base_url=EMBED_BASE_URL, api_key="ollama")

# In-memory response cache — keyed by normalised query + endpoint
# Cleared on service restart; Redis upgrade deferred to Phase 3
_cache: dict[str, dict] = {}

# ── Model readiness ───────────────────────────────────────────────────────────

# False until the LLM warmup call completes. Prevents users from racing the 60s VRAM load.
# On Claude API (production), warmup skips immediately — no cold start.
_model_ready = False


# ── Warmup ───────────────────────────────────────────────────────────────────

def _warmup():
    """Fire a real LLM call on startup to load the model into VRAM before any user request.
    On Claude API (production) the skip path fires immediately — no cold start there."""
    global _model_ready
    if "ollama" not in LLM_BASE_URL and "11434" not in LLM_BASE_URL:
        _model_ready = True
        print("Production LLM detected — skipping warmup.")
        return
    try:
        # Import the parse prompt lazily (defined below) via a simple inline prompt
        _client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
        _client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": "dress watch"}],
            temperature=0.1,
            max_tokens=10,
        )
        _model_ready = True
        print("Warmup complete — model ready.")
    except Exception as e:
        print(f"Warmup failed (proceeding anyway): {e}")
        _model_ready = True  # don't block the service forever


# Start warmup in background so Flask can serve /ready and /health immediately
threading.Thread(target=_warmup, daemon=True).start()


# ── Helpers ──────────────────────────────────────────────────────────────────

def normalise(q: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for stable cache keys."""
    q = q.lower().strip()
    q = re.sub(r"[^\w\s]", "", q)
    q = re.sub(r"\s+", " ", q)
    return q


def parse_llm_json(raw: str):
    """
    Strip conversational preamble before the first { or [ and parse JSON.
    Defensive layer per AI_PLAN.md §10 — both Qwen and Haiku can add filler.
    """
    match = re.search(r"[\[{]", raw)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {raw[:200]}")
    return json.loads(raw[match.start():])


def call_llm(system_prompt: str, user_content: str, max_tokens: int = 512) -> str:
    """Single LLM call — returns raw text content."""
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
        temperature=0.1,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


# ── Parse endpoint ────────────────────────────────────────────────────────────

PARSE_SYSTEM_PROMPT = """You are a luxury watch expert assistant.
Convert the user's plain-language watch query into structured JSON.
Use your knowledge to infer occasion, style, and preferences from context clues.

Return ONLY valid JSON with these exact keys. Use null for fields not mentioned or inferable, [] for empty lists:
{
  "occasion": null,
  "style": null,
  "material": [],
  "maxPrice": null,
  "minPrice": null,
  "maxThicknessMm": null,
  "maxDiameterMm": null,
  "strap": null,
  "movement": null,
  "complications": []
}

Key guidance:
- occasion: "wedding", "diving", "business", "daily", "sport", "casual", "formal"
- style: "dress", "sport", "casual", "field", "pilot", "diver"
- material: array from ["rose gold", "yellow gold", "white gold", "platinum", "steel", "titanium", "ceramic"]
- maxPrice / minPrice: number in USD. Convert "20k" → 20000, "under 10k" → maxPrice 10000
- maxThicknessMm: number. "thin" → 9, "slim" → 9
- maxDiameterMm: number. "small wrist" → 38, "large" → 42
- strap: "leather", "bracelet", "rubber", "nato", "alligator"
- movement: "automatic", "manual", "quartz"
- complications: array from ["date", "chronograph", "moonphase", "tourbillon", "gmt", "alarm", "power reserve"]

No preamble. No explanation. JSON only."""

PARSE_STRICT_PROMPT = PARSE_SYSTEM_PROMPT + "\n\nCRITICAL: Output raw JSON only. No markdown. No text before or after."


@app.route("/watch-finder/parse", methods=["POST"])
def watch_finder_parse():
    """LLM call 1 — convert plain-language query into structured intent filters."""
    if not _model_ready:
        return jsonify({"error": "Model warming up, please retry in a moment"}), 503
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400

    cache_key = f"parse:{normalise(query)}"
    if cache_key in _cache:
        return jsonify({**_cache[cache_key], "cached": True})

    # First attempt — cap at 250 tokens (JSON intent is ~100-150 tokens)
    try:
        raw = call_llm(PARSE_SYSTEM_PROMPT, query, max_tokens=250)
        intent = parse_llm_json(raw)
    except (ValueError, json.JSONDecodeError):
        # Retry with stricter no-preamble instruction
        try:
            raw = call_llm(PARSE_STRICT_PROMPT, query, max_tokens=250)
            intent = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError) as e:
            return jsonify({"error": f"Failed to parse LLM response: {str(e)}"}), 502

    result = {"intent": intent, "cached": False}
    _cache[cache_key] = {"intent": intent}
    return jsonify(result)


# ── Rerank endpoint ───────────────────────────────────────────────────────────

RERANK_SYSTEM_PROMPT = """You are a luxury watch expert. Score EVERY watch 0-100 for fit with the query. 100=perfect match, 0=irrelevant.
You MUST include one entry per watch — do not skip any.
Return ONLY a JSON array with exactly as many entries as watches provided, no markdown, no preamble:
[{"watch_id": 42, "score": 92}]
No explanation field. Include ALL watches."""

RERANK_STRICT_PROMPT = RERANK_SYSTEM_PROMPT + "\n\nJSON array only. Include ALL watches. No text before or after the array."


@app.route("/watch-finder/rerank", methods=["POST"])
def watch_finder_rerank():
    """LLM call 2 — score candidates by relevance (scores only, no explanations)."""
    if not _model_ready:
        return jsonify({"error": "Model warming up, please retry in a moment"}), 503
    body = request.get_json(silent=True) or {}
    query   = (body.get("query") or "").strip()
    watches = body.get("watches") or []

    if not query:
        return jsonify({"error": "query is required"}), 400
    if not watches:
        return jsonify({"ranked": [], "cached": False})

    # Cache key includes sorted watch IDs so different candidate sets don't collide
    ids_key  = ":".join(sorted(str(w.get("id", "")) for w in watches))
    cache_key = f"rerank:{normalise(query)}:{ids_key}"
    if cache_key in _cache:
        return jsonify({**_cache[cache_key], "cached": True})

    # Build a compact watch list string for the prompt — cap specs at 80 chars
    watch_lines = []
    for w in watches:
        price_str = f"${w['price']:,}" if w.get("price") else "Price on request"
        specs = (w.get("specs_summary") or "")[:80]
        watch_lines.append(
            f"ID {w['id']} | {w.get('brand', '')} | {w.get('name', '')} | "
            f"{price_str} | {specs} | {w.get('description', '')}"
        )
    watches_text = "\n".join(watch_lines)

    user_content = f'Query: "{query}"\n\nWatches:\n{watches_text}'

    # Cap at 600 tokens — 30 watches × ~20 tokens per scores-only entry
    try:
        raw = call_llm(RERANK_SYSTEM_PROMPT, user_content, max_tokens=600)
        ranked = parse_llm_json(raw)
    except (ValueError, json.JSONDecodeError):
        try:
            raw = call_llm(RERANK_STRICT_PROMPT, user_content, max_tokens=600)
            ranked = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError) as e:
            return jsonify({"error": f"Failed to parse LLM response: {str(e)}"}), 502

    result = {"ranked": ranked, "cached": False}
    _cache[cache_key] = {"ranked": ranked}
    return jsonify(result)


# ── On-demand explain endpoint ────────────────────────────────────────────────

EXPLAIN_SYSTEM_PROMPT = "You are a luxury watch expert. In one sentence, explain exactly why this watch fits the user's query. Be specific about which features match."


@app.route("/watch-finder/explain", methods=["POST"])
def watch_finder_explain():
    """On-demand single-watch explanation — only called when user clicks 'Why this?'."""
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    watch = body.get("watch") or {}

    if not query or not watch:
        return jsonify({"error": "query and watch required"}), 400

    cache_key = f"explain:{normalise(query)}:{watch.get('id', '')}"
    if cache_key in _cache:
        return jsonify({**_cache[cache_key], "cached": True})

    price_str = f"${watch['price']:,}" if watch.get("price") else "Price on request"
    watch_text = (
        f"ID {watch.get('id','')} | {watch.get('brand','')} | "
        f"{watch.get('name','')} | {price_str} | {watch.get('specs_summary','')}"
    )
    user_content = f'Query: "{query}"\nWatch: {watch_text}'

    try:
        explanation = call_llm(EXPLAIN_SYSTEM_PROMPT, user_content, max_tokens=100).strip()
    except Exception as e:
        return jsonify({"error": f"Explain failed: {str(e)}"}), 502

    result = {"explanation": explanation}
    _cache[cache_key] = result
    return jsonify({**result, "cached": False})


# ── Embedding endpoint ────────────────────────────────────────────────────────

@app.route("/embed", methods=["POST"])
def embed():
    """Generate embeddings for a batch of text chunks using nomic-embed-text.
    No LLM call — embedding model is always local Ollama regardless of LLM_BASE_URL."""
    body = request.get_json(silent=True) or {}
    texts = body.get("texts") or []
    if not texts:
        return jsonify({"error": "texts required"}), 400

    try:
        embeddings = []
        for text in texts:
            resp = embed_client.embeddings.create(model=EMBED_MODEL, input=text)
            embeddings.append(resp.data[0].embedding)
        return jsonify({"embeddings": embeddings})
    except Exception as e:
        return jsonify({"error": f"Embedding failed: {str(e)}"}), 502


# ── Readiness + health checks ─────────────────────────────────────────────────

@app.route("/ready")
def ready():
    """503 until model warmup completes; 200 after. Frontend polls this before allowing queries."""
    if not _model_ready:
        return jsonify({"ready": False, "message": "Model warming up"}), 503
    return jsonify({"ready": True})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ai-service", "model": LLM_MODEL, "ready": _model_ready})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
