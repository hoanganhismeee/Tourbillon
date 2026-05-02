from collections import Counter

from flask import jsonify

from core.runtime import Runtime


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/ready")
    def ready():
        """503 until model warmup completes; 200 after."""
        if not runtime.model_ready:
            return jsonify({"ready": False, "message": "Model warming up"}), 503
        return jsonify({"ready": True})

    @app.route("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "ai-service",
                "model": runtime.llm_model,
                "ready": runtime.model_ready,
            }
        )

    @app.route("/cache/export")
    def cache_export():
        """Dump the full in-memory cache as JSON.
        Run locally after Ollama testing: curl .../cache/export > ai-service/cache_seed.json
        """
        return jsonify(dict(runtime.cache))

    @app.route("/cache/stats")
    def cache_stats():
        """Return cache entry counts grouped by key prefix."""
        prefix_counts: Counter = Counter()
        for key in runtime.cache:
            prefix = key.split(":")[0] if ":" in key else key
            prefix_counts[prefix] += 1
        return jsonify({"total": len(runtime.cache), "by_prefix": dict(prefix_counts)})
