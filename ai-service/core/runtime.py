import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI


class RateLimiter:
    """Sliding-window rate limiter: max_calls requests per window_seconds."""

    def __init__(self, max_calls: int, window_seconds: float) -> None:
        self._max_calls = max_calls
        self._window = window_seconds
        self._lock = threading.Lock()
        self._calls: deque[float] = deque()

    def acquire(self) -> None:
        with self._lock:
            now = time.monotonic()
            cutoff = now - self._window
            while self._calls and self._calls[0] <= cutoff:
                self._calls.popleft()
            if len(self._calls) >= self._max_calls:
                wait = self._calls[0] + self._window - now
                if wait > 0:
                    time.sleep(wait)
                    now = time.monotonic()
                    cutoff = now - self._window
                    while self._calls and self._calls[0] <= cutoff:
                        self._calls.popleft()
            self._calls.append(time.monotonic())


@dataclass
class Runtime:
    llm_base_url: str
    llm_model: str
    llm_api_key: str
    embed_base_url: str
    embed_model: str
    client: OpenAI
    embed_client: Any  # OpenAI | None — None when no HTTP embed backend is available
    cache: dict[str, dict] = field(default_factory=dict)
    model_ready: bool = False
    use_anthropic: bool = False
    anthropic_client: Any = None
    rate_limiter: Any = None  # RateLimiter | None
    # SentenceTransformer | None — the model running inside this process, used when no HTTP
    # embed backend is configured. Anthropic has no embeddings endpoint, so a deployment that
    # uses Anthropic for generation has nothing to embed with unless one of these two exists.
    local_embed_model: Any = None

    @property
    def has_embeddings(self) -> bool:
        return self.embed_client is not None or self.local_embed_model is not None


def _is_ollama_url(base_url: str) -> bool:
    return "ollama" in base_url or "11434" in base_url


def _is_anthropic_url(base_url: str) -> bool:
    return "anthropic.com" in base_url


# Weights are baked into the production image at build time, so this is a load from disk
# rather than a download. Kept module-level and lazy so importing runtime stays cheap.
def _load_local_embed_model(model_name: str):
    """Loads the embedding model into this process. Returns None if it cannot be loaded.

    This is how production embeds at all: Anthropic has no embeddings endpoint, so a
    deployment that uses Anthropic for generation has nothing to embed with unless the model
    runs here. It is also the default locally, so both environments produce vectors in the
    same space — a dev setup on a different embedding model measures something production
    never does.

    all-mpnet-base-v2 is 768-dimensional, matching the stored vector(768) columns, and needs
    no remote code. nomic-embed-text is the same size but ships custom modeling code that
    only loads under transformers 4.x, which would mean pinning two libraries to old majors.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("sentence-transformers not installed — no in-process embedding available.")
        return None

    try:
        model = SentenceTransformer(model_name)
        # Renamed in sentence-transformers 6; support both so a version bump is not a break.
        dims = (model.get_embedding_dimension() if hasattr(model, "get_embedding_dimension")
                else model.get_sentence_embedding_dimension())
        print(f"Loaded in-process embedding model {model_name} ({dims} dimensions).")
        return model
    except Exception as exc:  # noqa: BLE001 — startup must not fail on a model problem
        print(f"Could not load in-process embedding model {model_name}: {exc}")
        return None


def create_runtime() -> Runtime:
    llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_model = os.getenv("LLM_MODEL", "qwen2.5:7b")
    llm_api_key = os.getenv("LLM_API_KEY", "ollama")

    embed_base_url_env = os.getenv("EMBED_BASE_URL")
    embed_base_url = embed_base_url_env or "http://localhost:11434/v1"
    embed_model = os.getenv("EMBED_MODEL", "nomic-embed-text")
    embed_api_key = os.getenv("EMBED_API_KEY", "ollama")

    use_anthropic = _is_anthropic_url(llm_base_url)
    anthropic_client = None
    rate_limiter = None

    if use_anthropic:
        from anthropic import Anthropic  # lazy import — only needed in prod
        anthropic_client = Anthropic(api_key=llm_api_key)
        rate_limit_rpm = int(os.getenv("LLM_RATE_LIMIT_RPM", "0"))
        if rate_limit_rpm > 0:
            rate_limiter = RateLimiter(max_calls=rate_limit_rpm, window_seconds=60.0)

    # An explicitly configured EMBED_BASE_URL is always honoured; only the unset case falls back
    # on the local Ollama default, which exists solely for the all-local setup. Inferring "no
    # embed backend" from the URL matching that default silently disabled embeddings for a
    # hybrid deployment — Anthropic for generation, local Ollama for embeddings — which is a
    # legitimate configuration and the one used to benchmark the pipeline.
    has_embed = embed_base_url_env is not None or not use_anthropic
    embed_client = OpenAI(base_url=embed_base_url, api_key=embed_api_key) if has_embed else None

    # With no HTTP embed backend, run the model here instead of giving up. This is the default
    # in both environments, so dev and production embed into the same space; EMBED_BASE_URL
    # remains the escape hatch for pointing at a hosted embeddings service instead.
    local_embed_model = None
    if not has_embed:
        local_embed_model = _load_local_embed_model(
            os.getenv("LOCAL_EMBED_MODEL", "sentence-transformers/all-mpnet-base-v2"))
        if local_embed_model is None:
            print("No embed backend configured — /embed will return 503. "
                  "Set EMBED_BASE_URL + EMBED_API_KEY, or install sentence-transformers.")

    return Runtime(
        llm_base_url=llm_base_url,
        llm_model=llm_model,
        llm_api_key=llm_api_key,
        embed_base_url=embed_base_url,
        embed_model=embed_model,
        client=OpenAI(base_url=llm_base_url, api_key=llm_api_key),
        embed_client=embed_client,
        use_anthropic=use_anthropic,
        anthropic_client=anthropic_client,
        rate_limiter=rate_limiter,
        local_embed_model=local_embed_model,
    )


def warmup(runtime: Runtime) -> None:
    """Load the LLM into VRAM before the first user request."""
    if not _is_ollama_url(runtime.llm_base_url):
        runtime.model_ready = True
        print("Production LLM detected — skipping warmup.")
        return

    try:
        warmup_client = OpenAI(base_url=runtime.llm_base_url, api_key=runtime.llm_api_key)
        warmup_client.chat.completions.create(
            model=runtime.llm_model,
            messages=[{"role": "user", "content": "dress watch"}],
            temperature=0.1,
            max_tokens=10,
        )
        runtime.model_ready = True
        print("Warmup complete — model ready.")
    except Exception as exc:
        print(f"Warmup failed (proceeding anyway): {exc}")
        runtime.model_ready = True


def start_warmup(runtime: Runtime) -> None:
    threading.Thread(target=warmup, args=(runtime,), daemon=True).start()
