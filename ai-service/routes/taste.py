import json

from flask import jsonify, request

from core.llm import call_llm, parse_llm_json
from core.runtime import Runtime
from prompts.taste import (
    DNA_FROM_BEHAVIOR_STRICT_PROMPT,
    DNA_FROM_BEHAVIOR_SYSTEM_PROMPT,
    TASTE_STRICT_PROMPT,
    TASTE_SYSTEM_PROMPT,
)


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/parse-taste", methods=["POST"])
    def parse_taste():
        """Extract structured watch preferences from a user's plain-text taste description."""
        body = request.get_json(silent=True) or {}
        taste_text = (body.get("taste_text") or "").strip()
        available_brands = body.get("available_brands") or []

        if not taste_text:
            return jsonify({"error": "taste_text is required"}), 400

        user_content = f"Available brands: {', '.join(available_brands)}\n\nUser description: {taste_text}"

        try:
            raw = call_llm(runtime, TASTE_SYSTEM_PROMPT, user_content, max_tokens=200)
            result = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_llm(runtime, TASTE_STRICT_PROMPT, user_content, max_tokens=200)
                result = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        return jsonify(result)

    @app.route("/generate-dna-from-behavior", methods=["POST"])
    def generate_dna_from_behavior():
        """Generate a structured taste profile from browsing behavior events."""
        body = request.get_json(silent=True) or {}
        events = body.get("events") or []
        available_brands = body.get("available_brands") or []

        if not events:
            return jsonify({"error": "events is required"}), 400

        event_lines = []
        for event in events:
            event_type = event.get("type", "")
            name = event.get("entityName") or event.get("entity_name", "")
            if event_type == "search":
                event_lines.append(f"- Searched for: {name}")
            elif event_type == "watch_view":
                event_lines.append(f"- Viewed watch: {name}")
            elif event_type == "brand_view":
                event_lines.append(f"- Visited brand page: {name}")
            elif event_type == "collection_view":
                event_lines.append(f"- Visited collection page: {name}")

        events_text = "\n".join(event_lines) if event_lines else "No events"
        user_content = f"Available brands: {', '.join(available_brands)}\n\nBrowsing history:\n{events_text}"

        try:
            raw = call_llm(runtime, DNA_FROM_BEHAVIOR_SYSTEM_PROMPT, user_content, max_tokens=300)
            result = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_llm(runtime, DNA_FROM_BEHAVIOR_STRICT_PROMPT, user_content, max_tokens=300)
                result = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        return jsonify(result)
