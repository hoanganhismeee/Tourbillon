import json

from flask import jsonify, request

from core.llm import call_llm, normalise, parse_llm_json
from core.runtime import Runtime
from prompts.watch_finder import PARSE_STRICT_PROMPT, PARSE_SYSTEM_PROMPT


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/watch-finder/parse", methods=["POST"])
    def watch_finder_parse():
        """Convert a plain-language query into structured intent filters."""
        if not runtime.model_ready:
            return jsonify({"error": "Model warming up, please retry in a moment"}), 503

        body = request.get_json(silent=True) or {}
        query = (body.get("query") or "").strip()
        if not query:
            return jsonify({"error": "query is required"}), 400

        cache_key = f"parse:{normalise(query)}"
        if cache_key in runtime.cache:
            return jsonify({**runtime.cache[cache_key], "cached": True})

        try:
            raw = call_llm(runtime, PARSE_SYSTEM_PROMPT, query, max_tokens=250)
            intent = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_llm(runtime, PARSE_STRICT_PROMPT, query, max_tokens=250)
                intent = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        result = {"intent": intent, "cached": False}
        runtime.cache[cache_key] = {"intent": intent}
        return jsonify(result)
