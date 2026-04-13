import json

from flask import jsonify, request

from core.llm import call_llm, parse_llm_json
from core.runtime import Runtime
from prompts.collections import CLASSIFY_STYLE_PROMPT


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/collections/classify-styles", methods=["POST"])
    def classify_collection_styles():
        """Admin one-time: classify collection style tags."""
        body = request.get_json(silent=True) or {}
        collections = body.get("collections") or []
        if not collections:
            return jsonify({"error": "collections list is required"}), 400

        lines = [
            f"{item.get('id')}: {item.get('brand', '')} {item.get('name', '')} — {str(item.get('description', ''))[:120]}"
            for item in collections
        ]
        prompt = "\n".join(lines)

        try:
            raw = call_llm(runtime, CLASSIFY_STYLE_PROMPT, prompt, max_tokens=len(collections) * 30 + 50)
            results = parse_llm_json(raw)
            if not isinstance(results, list):
                raise ValueError("Expected a JSON array")
        except (ValueError, json.JSONDecodeError) as exc:
            return jsonify({"error": f"LLM classification failed: {str(exc)}"}), 502

        valid_styles = {"dress", "sport", "diver", "art"}
        cleaned = []
        for item in results:
            # Accept "styles" array (new) or legacy "style" string
            styles = item.get("styles")
            if isinstance(styles, list):
                styles = [s.lower() for s in styles if isinstance(s, str) and s.lower() in valid_styles]
            else:
                s = item.get("style")
                styles = [s.lower()] if isinstance(s, str) and s.lower() in valid_styles else []
            cleaned.append({"id": item.get("id"), "styles": styles})

        return jsonify({"results": cleaned})
