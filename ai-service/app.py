# AI service — watch finder endpoints: intent parsing and candidate reranking
import json
import os
import re

from flask import Flask, jsonify, request
from openai import OpenAI

app = Flask(__name__)

# LLM client — points to Ollama locally, swappable to Anthropic via env vars
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL    = os.getenv("LLM_MODEL", "qwen2.5:7b")
LLM_API_KEY  = os.getenv("LLM_API_KEY", "ollama")

client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

# In-memory response cache — keyed by normalised query + endpoint
# Cleared on service restart; Redis upgrade deferred to Phase 3
_cache: dict[str, dict] = {}


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

RERANK_SYSTEM_PROMPT = """You are a luxury watch expert. Score EVERY watch in the list 0-100 for fit with the query. 100=perfect match, 0=irrelevant.
You MUST include one entry per watch — do not skip any. Keep explanations to one short sentence.
Return ONLY a JSON array with exactly as many entries as watches provided, no markdown, no preamble:
[{"watch_id": 42, "score": 92, "explanation": "One sentence specific to this watch and the query."}]"""

RERANK_STRICT_PROMPT = RERANK_SYSTEM_PROMPT + "\n\nOutput the JSON array only. Include ALL watches. No text before or after the array."


@app.route("/watch-finder/rerank", methods=["POST"])
def watch_finder_rerank():
    """LLM call 2 — rerank filtered candidates and generate per-watch explanations."""
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

    # Cap at 1500 tokens — 30 watches × ~50 tokens per scored entry
    try:
        raw = call_llm(RERANK_SYSTEM_PROMPT, user_content, max_tokens=1500)
        ranked = parse_llm_json(raw)
    except (ValueError, json.JSONDecodeError):
        try:
            raw = call_llm(RERANK_STRICT_PROMPT, user_content, max_tokens=1500)
            ranked = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError) as e:
            return jsonify({"error": f"Failed to parse LLM response: {str(e)}"}), 502

    result = {"ranked": ranked, "cached": False}
    _cache[cache_key] = {"ranked": ranked}
    return jsonify(result)


# ── Health check ──────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ai-service", "model": LLM_MODEL})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
