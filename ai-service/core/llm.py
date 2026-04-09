import json
import re

from core.runtime import Runtime


def normalise(q: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for stable cache keys."""
    q = q.lower().strip()
    q = re.sub(r"[^\w\s]", "", q)
    q = re.sub(r"\s+", " ", q)
    return q


def parse_llm_json(raw: str):
    """
    Strip conversational preamble before the first { or [ and parse JSON.
    Defensive layer per AI_PLAN.md §10 — both Qwen and Haiku can add filler.
    """
    match = re.search(r"[\[{]", raw)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {raw[:200]}")
    return json.loads(raw[match.start():])


def call_llm(
    runtime: Runtime,
    system_prompt: str,
    user_content: str,
    max_tokens: int = 512,
    temperature: float = 0.1,
) -> str:
    """Single LLM call — returns raw text content."""
    response = runtime.client.chat.completions.create(
        model=runtime.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
