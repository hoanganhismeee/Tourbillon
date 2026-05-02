import json
import os


def load_cache_seed(runtime) -> None:
    """Load pre-computed cache entries from cache_seed.json into runtime.cache.

    Enables reuse of results generated during local Ollama testing so production
    (Haiku) does not need to redo those LLM calls on a cold start.
    """
    seed_path = os.path.join(os.path.dirname(__file__), "..", "cache_seed.json")
    if not os.path.exists(seed_path):
        print("No cache_seed.json found — starting with empty cache.")
        return
    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        runtime.cache.update(data)
        print(f"Cache seed loaded: {len(data)} entries.")
    except Exception as exc:
        print(f"Failed to load cache_seed.json (continuing with empty cache): {exc}")
