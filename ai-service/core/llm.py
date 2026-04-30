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


def _rate_limit(runtime: Runtime) -> None:
    limiter = getattr(runtime, "rate_limiter", None)
    if limiter is not None:
        limiter.acquire()


def _convert_tools_to_anthropic(tools: list) -> list:
    """Convert OpenAI-style function tool definitions to Anthropic format."""
    result = []
    for tool in tools:
        if tool.get("type") == "function" and "function" in tool:
            fn = tool["function"]
            result.append({
                "name": fn["name"],
                "description": fn.get("description", ""),
                "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
            })
    return result


def call_llm(
    runtime: Runtime,
    system_prompt: str,
    user_content: str,
    max_tokens: int = 512,
    temperature: float = 0.1,
) -> str:
    """Single LLM call — returns raw text content."""
    if getattr(runtime, "use_anthropic", False) is True:
        _rate_limit(runtime)
        response = runtime.anthropic_client.messages.create(
            model=runtime.llm_model,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.content[0].text if response.content else ""

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


def call_llm_chat(
    runtime: Runtime,
    messages: list[dict],
    max_tokens: int = 200,
    temperature: float = 0.3,
) -> str:
    """Multi-turn chat call. System message (role='system') is extracted for Anthropic;
    for Ollama it stays in the messages list as-is."""
    if getattr(runtime, "use_anthropic", False) is True:
        _rate_limit(runtime)
        system = ""
        chat_messages = []
        for msg in messages:
            if msg.get("role") == "system":
                system = msg.get("content") or ""
            else:
                chat_messages.append(msg)
        response = runtime.anthropic_client.messages.create(
            model=runtime.llm_model,
            system=system,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.content[0].text if response.content else ""

    response = runtime.client.chat.completions.create(
        model=runtime.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def call_llm_with_tools(
    runtime: Runtime,
    system: str,
    user_content: str,
    tools: list,
    max_tokens: int = 300,
    temperature: float = 0.2,
) -> list[dict]:
    """Tool-calling LLM call. Returns normalised tool invocations:
    [{"name": str, "arguments": dict}, ...]"""
    if getattr(runtime, "use_anthropic", False) is True:
        _rate_limit(runtime)
        response = runtime.anthropic_client.messages.create(
            model=runtime.llm_model,
            system=system,
            messages=[{"role": "user", "content": user_content}],
            tools=_convert_tools_to_anthropic(tools),
            temperature=temperature,
            max_tokens=max_tokens,
        )
        result = []
        for block in response.content:
            if getattr(block, "type", None) == "tool_use":
                result.append({"name": block.name, "arguments": block.input})
        return result

    response = runtime.client.chat.completions.create(
        model=runtime.llm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        tools=tools,
        tool_choice="auto",
        max_tokens=max_tokens,
        temperature=temperature,
    )
    choice = response.choices[0] if response.choices else None
    if choice is None:
        return []
    result = []
    for call in (getattr(choice.message, "tool_calls", None) or []):
        fn = getattr(call, "function", None)
        if fn is None:
            continue
        name = getattr(fn, "name", "") or ""
        raw_args = getattr(fn, "arguments", "") or "{}"
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            if not isinstance(args, dict):
                continue
        except json.JSONDecodeError:
            continue
        result.append({"name": name, "arguments": args})
    return result
