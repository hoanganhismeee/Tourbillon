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
    embed_client: Any  # OpenAI | None — None when no embed backend is available
    cache: dict[str, dict] = field(default_factory=dict)
    model_ready: bool = False
    use_anthropic: bool = False
    anthropic_client: Any = None
    rate_limiter: Any = None  # RateLimiter | None


def _is_ollama_url(base_url: str) -> bool:
    return "ollama" in base_url or "11434" in base_url


def _is_anthropic_url(base_url: str) -> bool:
    return "anthropic.com" in base_url


def create_runtime() -> Runtime:
    llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_model = os.getenv("LLM_MODEL", "qwen2.5:7b")
    llm_api_key = os.getenv("LLM_API_KEY", "ollama")

    embed_base_url = os.getenv("EMBED_BASE_URL", "http://localhost:11434/v1")
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

    # Embed client is None when running in production mode without a configured embed backend.
    # Production (use_anthropic=True) with the default Ollama EMBED_BASE_URL means no embed service.
    # Set EMBED_BASE_URL + EMBED_API_KEY env vars to enable cloud embeddings in production.
    has_embed = not (use_anthropic and embed_base_url == "http://localhost:11434/v1")
    embed_client = OpenAI(base_url=embed_base_url, api_key=embed_api_key) if has_embed else None

    if use_anthropic and not has_embed:
        print("No embed backend configured — /embed will return 503. Set EMBED_BASE_URL + EMBED_API_KEY to enable.")

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
