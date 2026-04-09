from flask import Flask

from core.runtime import create_runtime, start_warmup
from routes.chat import register_routes as register_chat_routes
from routes.collections import register_routes as register_collection_routes
from routes.editorial import register_routes as register_editorial_routes
from routes.embeddings import register_routes as register_embedding_routes
from routes.system import register_routes as register_system_routes
from routes.taste import register_routes as register_taste_routes
from routes.watch_finder import register_routes as register_watch_finder_routes

app = Flask(__name__)
runtime = create_runtime()

register_watch_finder_routes(app, runtime)
register_embedding_routes(app, runtime)
register_taste_routes(app, runtime)
register_editorial_routes(app, runtime)
register_chat_routes(app, runtime)
register_collection_routes(app, runtime)
register_system_routes(app, runtime)

start_warmup(runtime)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)
