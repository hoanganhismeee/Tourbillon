# Semantic route layer for chat concierge discovery queries.
# Classifies a query as "simple_brand" (pure SQL is sufficient) or
# "descriptor_query" (full WatchFinder vector + LLM rerank is needed).
# Uses cosine similarity against pre-embedded example utterances — same
# concept as semantic-router (Aurelio AI) but implemented inline to avoid
# an extra dependency and Docker-build fragility.
import threading
from typing import Optional

from core.runtime import Runtime

# ---------------------------------------------------------------------------
# Route definitions — example utterances for each class
# ---------------------------------------------------------------------------

SIMPLE_BRAND_UTTERANCES = [
    # Pure brand exploration — user just wants to browse a maison
    "show me Patek Philippe",
    "suggest me some Rolex",
    "enlighten me about Grand Seiko",
    "tell me about Audemars Piguet",
    "what watches do you have from Omega",
    "I want to see Vacheron Constantin",
    "give me Jaeger-LeCoultre",
    "Patek Philippe watches",
    "show me some Cartier",
    "what do you have from IWC",
    "any Blancpain watches",
    "show me Glashütte Original",
    "I'm interested in Breguet",
    "can you show me Tudor",
    "A. Lange and Sohne",
    "let me see what you have from Omega",
    "introduce me to F.P. Journe",
    "guide me through Frederique Constant",
    "what is the Tourbillon collection like",
    "show me the Royal Oak collection",
]

DESCRIPTOR_QUERY_UTTERANCES = [
    # Query contains a style, material, complication, occasion, price, or other attribute
    "Patek dress watch",
    "sporty Rolex",
    "elegant Vacheron Constantin",
    "Rolex dive watch",
    "minimalist dress watch",
    "blue dial chronograph",
    "Omega Speedmaster moonwatch",
    "Audemars Piguet Royal Oak sports",
    "dress watch under 20000",
    "Grand Seiko snowflake dial",
    "casual everyday watch",
    "luxury sports watch with rubber strap",
    "thin elegant watch for formal occasions",
    "Patek Philippe perpetual calendar",
    "something waterproof and sporty",
    "automatic watch with moonphase",
    "IWC Portugieser in rose gold",
    "skeleton watch with visible movement",
    "budget friendly dress watch",
    "vintage looking chronograph",
]

ROUTES: dict[str, list[str]] = {
    "simple_brand": SIMPLE_BRAND_UTTERANCES,
    "descriptor_query": DESCRIPTOR_QUERY_UTTERANCES,
}

# Cosine similarity threshold — queries below this on every route default
# to "descriptor_query" so the safer full pipeline runs.
THRESHOLD = 0.45


# ---------------------------------------------------------------------------
# Cosine similarity (pure Python — no numpy dependency)
# ---------------------------------------------------------------------------

def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


# ---------------------------------------------------------------------------
# Route layer
# ---------------------------------------------------------------------------

class RouteLayer:
    """Lazy-init semantic router.  Embeds all utterances on first use, then
    caches them for the lifetime of the process."""

    def __init__(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._route_embeddings: dict[str, list[list[float]]] = {}
        self._ready = False
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    def _embed(self, texts: list[str]) -> list[list[float]]:
        response = self._runtime.embed_client.embeddings.create(
            model=self._runtime.embed_model,
            input=texts,
        )
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]

    def _ensure_ready(self) -> bool:
        if self._ready:
            return True
        with self._lock:
            if self._ready:
                return True
            try:
                for route_name, utterances in ROUTES.items():
                    self._route_embeddings[route_name] = self._embed(utterances)
                self._ready = True
                print("RouteLayer: utterances embedded and ready.")
                return True
            except Exception as exc:
                print(f"RouteLayer: failed to embed utterances ({exc}) — will retry on next call.")
                return False

    # ------------------------------------------------------------------
    def route(self, query: str) -> tuple[str, float]:
        """Return (route_name, confidence).

        Falls back to ("descriptor_query", 0.0) on any error so the full
        WatchFinder pipeline always runs when the router is unavailable.
        """
        if not self._ensure_ready():
            return ("descriptor_query", 0.0)

        try:
            query_emb = self._embed([query])[0]

            best_route = "descriptor_query"
            best_score = 0.0

            for route_name, embeddings in self._route_embeddings.items():
                # Nearest-neighbour: take the utterance with highest similarity.
                max_sim = max(_cosine(query_emb, emb) for emb in embeddings)
                if max_sim > best_score:
                    best_score = max_sim
                    best_route = route_name

            if best_score < THRESHOLD:
                # No confident match — default to the safe full-pipeline path.
                return ("descriptor_query", best_score)

            return (best_route, best_score)

        except Exception as exc:
            print(f"RouteLayer.route failed ({exc}) — falling back to descriptor_query.")
            return ("descriptor_query", 0.0)


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_instance: Optional[RouteLayer] = None
_init_lock = threading.Lock()


def get_route_layer(runtime: Runtime) -> RouteLayer:
    """Return the process-wide RouteLayer, creating it on first call."""
    global _instance
    if _instance is not None:
        return _instance
    with _init_lock:
        if _instance is not None:
            return _instance
        _instance = RouteLayer(runtime)
    return _instance
