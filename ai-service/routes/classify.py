# Chat intent classifier endpoint.
# Receives query + session summary + entity mentions; returns {"intent": str, "confidence": float}.
# Classifier failure is non-fatal — the backend falls back to regex routing on "unclear".
import json

from flask import jsonify, request

from core.runtime import Runtime
from prompts.classify import CLASSIFY_SYSTEM_PROMPT, CLASSIFY_USER_PROMPT

VALID_INTENTS = {
    "watch_compare",
    "collection_compare",
    "brand_decision",
    "affirmative_followup",
    "expansion_request",
    "revision_request",
    "contextual_followup",
    "brand_info",
    "collection_info",
    "brand_history",
    "discovery",
    "non_watch",
    "unclear",
}


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

    messages = [
        {"role": "system", "content": CLASSIFY_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    try:
        response = runtime.client.chat.completions.create(
            model=runtime.llm_model,
            messages=messages,
            max_tokens=60,
            temperature=0.0,
        )
        raw = (response.choices[0].message.content or "").strip()

        # Strip markdown fences if the model wraps anyway
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()

        result = json.loads(raw)
        intent = str(result.get("intent") or "unclear")
        confidence = float(result.get("confidence") or 0.0)

        if intent not in VALID_INTENTS:
            intent = "unclear"
            confidence = 0.0

        return {"intent": intent, "confidence": confidence}
    except Exception as exc:
        return {"intent": "unclear", "confidence": 0.0, "error": str(exc)}


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/classify", methods=["POST"])
    def classify_intent():
        """AI intent classifier for chat routing.

        Request body:
          query          str   — user message
          sessionState   dict  — {followUpMode, brandIds}
          lastWatchCards list  — cards from the previous turn
          entityMentions dict  — {brands: [str], collections: [str]}

        Response:
          {"intent": str, "confidence": float}
        """
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        if not query:
            return jsonify({"error": "query required"}), 400

        session = data.get("sessionState") or {}
        last_cards = data.get("lastWatchCards") or []
        entities = data.get("entityMentions") or {}

        result = _safe_classify(runtime, query, session, last_cards, entities)
        return jsonify(result)
