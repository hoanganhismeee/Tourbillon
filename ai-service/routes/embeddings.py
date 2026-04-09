from flask import jsonify, request

from core.runtime import Runtime


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/embed", methods=["POST"])
    def embed():
        """Generate embeddings using nomic-embed-text."""
        body = request.get_json(silent=True) or {}
        texts = body.get("texts") or []
        if not texts:
            return jsonify({"error": "texts required"}), 400

        try:
            response = runtime.embed_client.embeddings.create(model=runtime.embed_model, input=texts)
            embeddings = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
            return jsonify({"embeddings": embeddings})
        except Exception as exc:
            return jsonify({"error": f"Embedding failed: {str(exc)}"}), 502
