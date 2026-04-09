import json

from flask import jsonify, request

from core.llm import call_llm, normalise, parse_llm_json
from core.runtime import Runtime
from prompts.watch_finder import (
    EXPLAIN_SYSTEM_PROMPT,
    PARSE_STRICT_PROMPT,
    PARSE_SYSTEM_PROMPT,
    RERANK_STRICT_PROMPT,
    RERANK_SYSTEM_PROMPT,
)


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

    @app.route("/watch-finder/rerank", methods=["POST"])
    def watch_finder_rerank():
        """Score a candidate pool by relevance."""
        if not runtime.model_ready:
            return jsonify({"error": "Model warming up, please retry in a moment"}), 503

        body = request.get_json(silent=True) or {}
        query = (body.get("query") or "").strip()
        watches = body.get("watches") or []

        if not query:
            return jsonify({"error": "query is required"}), 400
        if not watches:
            return jsonify({"ranked": [], "cached": False})

        ids_key = ":".join(sorted(str(watch.get("id", "")) for watch in watches))
        cache_key = f"rerank:{normalise(query)}:{ids_key}"
        if cache_key in runtime.cache:
            return jsonify({**runtime.cache[cache_key], "cached": True})

        watch_lines = []
        for watch in watches:
            price_str = f"${watch['price']:,}" if watch.get("price") else "Price on request"
            specs = (watch.get("specs_summary") or "")[:80]
            collection = watch.get("collection", "")
            brand_collection = (
                f"{watch.get('brand', '')} {collection}".strip() if collection else watch.get("brand", "")
            )
            watch_lines.append(
                f"ID {watch['id']} | {brand_collection} | {watch.get('name', '')} | "
                f"{price_str} | {specs} | {watch.get('description', '')}"
            )
        watches_text = "\n".join(watch_lines)
        user_content = f'Query: "{query}"\n\nWatches:\n{watches_text}'

        try:
            raw = call_llm(runtime, RERANK_SYSTEM_PROMPT, user_content, max_tokens=600)
            ranked = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_llm(runtime, RERANK_STRICT_PROMPT, user_content, max_tokens=600)
                ranked = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        result = {"ranked": ranked, "cached": False}
        runtime.cache[cache_key] = {"ranked": ranked}
        return jsonify(result)

    @app.route("/watch-finder/explain", methods=["POST"])
    def watch_finder_explain():
        """Return a single-sentence explanation for a specific watch match."""
        body = request.get_json(silent=True) or {}
        query = (body.get("query") or "").strip()
        watch = body.get("watch") or {}

        if not query or not watch:
            return jsonify({"error": "query and watch required"}), 400

        cache_key = f"explain:{normalise(query)}:{watch.get('id', '')}"
        if cache_key in runtime.cache:
            return jsonify({**runtime.cache[cache_key], "cached": True})

        price_str = f"${watch['price']:,}" if watch.get("price") else "Price on request"
        watch_text = (
            f"ID {watch.get('id', '')} | {watch.get('brand', '')} | "
            f"{watch.get('name', '')} | {price_str} | {watch.get('specs_summary', '')}"
        )
        user_content = f'Query: "{query}"\nWatch: {watch_text}'

        try:
            explanation = call_llm(runtime, EXPLAIN_SYSTEM_PROMPT, user_content, max_tokens=100).strip()
        except Exception as exc:
            return jsonify({"error": f"Explain failed: {str(exc)}"}), 502

        result = {"explanation": explanation}
        runtime.cache[cache_key] = result
        return jsonify({**result, "cached": False})
