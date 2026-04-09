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
