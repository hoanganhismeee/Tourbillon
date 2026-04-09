import os
import threading
from dataclasses import dataclass, field

from openai import OpenAI


@dataclass
class Runtime:
    llm_base_url: str
    llm_model: str
    llm_api_key: str
    embed_base_url: str
    embed_model: str
    client: OpenAI
    embed_client: OpenAI
    cache: dict[str, dict] = field(default_factory=dict)
    model_ready: bool = False


def create_runtime() -> Runtime:
    llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_model = os.getenv("LLM_MODEL", "qwen2.5:7b")
    llm_api_key = os.getenv("LLM_API_KEY", "ollama")

    embed_base_url = os.getenv("EMBED_BASE_URL", "http://localhost:11434/v1")
    embed_model = "nomic-embed-text"

    return Runtime(
        llm_base_url=llm_base_url,
        llm_model=llm_model,
        llm_api_key=llm_api_key,
        embed_base_url=embed_base_url,
        embed_model=embed_model,
        client=OpenAI(base_url=llm_base_url, api_key=llm_api_key),
        embed_client=OpenAI(base_url=embed_base_url, api_key="ollama"),
    )


def _is_ollama_url(base_url: str) -> bool:
    return "ollama" in base_url or "11434" in base_url


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
