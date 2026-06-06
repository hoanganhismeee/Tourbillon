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


def _frequency_recency_suffix(event: dict) -> str:
    """Render an optional '[seen Nx, last <when>]' annotation from a rollup event.

    Returns an empty string for legacy single-event payloads that omit count, so
    the endpoint stays backward compatible with un-aggregated callers and tests.
    """
    count = event.get("count")
    if not count:
        return ""

    days = event.get("lastSeenDaysAgo")
    if days is None:
        days = event.get("last_seen_days_ago")

    if days is None:
        recency = ""
    elif days <= 0:
        recency = ", last today"
    elif days == 1:
        recency = ", last yesterday"
    else:
        recency = f", last {days} days ago"

    times = "once" if count == 1 else f"{count}x"
    return f" [seen {times}{recency}]"


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
                line = f"- Searched for: {name}"
            elif event_type == "watch_view":
                line = f"- Viewed watch: {name}"
            elif event_type == "brand_view":
                line = f"- Visited brand page: {name}"
            elif event_type == "collection_view":
                line = f"- Visited collection page: {name}"
            else:
                continue
            # Backend may pre-aggregate events into a per-entity rollup carrying
            # frequency (count) and recency (lastSeenDaysAgo). Surface it so the
            # model can weigh repeated/recent items, as the system prompt instructs.
            event_lines.append(line + _frequency_recency_suffix(event))

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
