# Semantic routing endpoint for the chat concierge discovery path.
# Classifies a discovery query as "simple_brand" or "descriptor_query" using
# cosine similarity against pre-embedded example utterances (see core/route_layer.py).
#
# simple_brand  → pure SQL catalogue sample is sufficient (no WatchFinder LLM cost).
# descriptor_query → full WatchFinder vector + LLM rerank pipeline is required.
#
# The C# backend calls this endpoint before deciding whether to run the full
# WatchFinder pipeline, and falls back to its own regex check on any HTTP error.
from flask import jsonify, request

from core.route_layer import get_route_layer
from core.runtime import Runtime


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/route", methods=["POST"])
    def route_query():
        """Classify a discovery query into simple_brand or descriptor_query.

        Request body:
          query  str  — user message (required)

        Response:
          {
            "route":      "simple_brand" | "descriptor_query",
            "confidence": float   (cosine similarity of nearest utterance),
            "fallback":   bool    (true when route layer is unavailable)
          }
        """
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        if not query:
            return jsonify({"error": "query required"}), 400

        rl = get_route_layer(runtime)
        route_name, confidence = rl.route(query)

        # Expose whether this was a genuine embedding decision or a fallback.
        fallback = confidence == 0.0 and route_name == "descriptor_query"
        return jsonify({"route": route_name, "confidence": round(confidence, 4), "fallback": fallback})
