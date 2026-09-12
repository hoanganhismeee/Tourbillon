from flask import jsonify, request

from core.runtime import Runtime


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/embed", methods=["POST"])
    def embed():
        """Generate embeddings from whichever backend this deployment has.

        Two sources, in priority order: an HTTP service when EMBED_BASE_URL is configured,
        otherwise the model running inside this process. Production has no HTTP embed service
        — Anthropic serves generation and has no embeddings endpoint — so the in-process model
        is what keeps vector search and the semantic cache alive there.
        """
        if not runtime.has_embeddings:
            return jsonify({"error": "No embed backend configured. Set EMBED_BASE_URL + EMBED_API_KEY env vars."}), 503

        body = request.get_json(silent=True) or {}
        texts = body.get("texts") or []
        if not texts:
            return jsonify({"error": "texts required"}), 400

        try:
            if runtime.embed_client is not None:
                response = runtime.embed_client.embeddings.create(model=runtime.embed_model, input=texts)
                embeddings = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
            else:
                # encode returns numpy arrays; the response has to be JSON, and the stored
                # vectors are float32 either way.
                vectors = runtime.local_embed_model.encode(texts)
                embeddings = [[float(value) for value in vector] for vector in vectors]
            return jsonify({"embeddings": embeddings})
        except Exception as exc:
            return jsonify({"error": f"Embedding failed: {str(exc)}"}), 502
