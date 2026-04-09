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

        valid_styles = {"dress", "sport", "diver", None}
        cleaned = []
        for item in results:
            style = item.get("style")
            if isinstance(style, str):
                style = style.lower()
            if style not in valid_styles:
                style = None
            cleaned.append({"id": item.get("id"), "style": style})

        return jsonify({"results": cleaned})
