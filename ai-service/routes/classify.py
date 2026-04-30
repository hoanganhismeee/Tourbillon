# Chat intent classifier endpoint.
# Receives query + session summary + entity mentions; returns {"intent": str, "confidence": float}.
# Classifier failure is non-fatal - the backend falls back to regex routing on "unclear".
from flask import jsonify, request

from core.llm import call_llm
from core.runtime import Runtime
from core.schemas import IntentClassification, VALID_INTENTS, parse_model_json
from prompts.classify import CLASSIFY_SYSTEM_PROMPT, CLASSIFY_USER_PROMPT


def _safe_classify(runtime: Runtime, query: str, session: dict, last_cards: list, entities: dict) -> dict:
    """Call the LLM and parse the JSON intent response. Returns a fallback on any error."""
    user_content = CLASSIFY_USER_PROMPT.format(
        follow_up_mode=session.get("followUpMode") or "none",
        last_card_count=len(last_cards),
        session_brands=", ".join(str(b) for b in (session.get("brandIds") or [])) or "none",
        entity_brands=", ".join(entities.get("brands") or []) or "none",
        entity_collections=", ".join(entities.get("collections") or []) or "none",
        query=query,
    )

    try:
        raw = call_llm(runtime, CLASSIFY_SYSTEM_PROMPT, user_content, max_tokens=60, temperature=0.0)
        parsed = parse_model_json(IntentClassification, raw.strip(), source="/classify")
        return parsed.model_dump()
    except Exception as exc:
        return {"intent": "unclear", "confidence": 0.0, "error": str(exc)}


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/classify", methods=["POST"])
    def classify_intent():
        """AI intent classifier for chat routing."""
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        if not query:
            return jsonify({"error": "query required"}), 400

        session = data.get("sessionState") or {}
        last_cards = data.get("lastWatchCards") or []
        entities = data.get("entityMentions") or {}

        result = _safe_classify(runtime, query, session, last_cards, entities)
        return jsonify(result)
