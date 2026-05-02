import json
import re
import sys
import time

from core.runtime import Runtime


def _log(msg: str) -> None:
    import tempfile, os
    print(msg, file=sys.stderr, flush=True)
    try:
        log_path = os.path.join(tempfile.gettempdir(), "llm-timing.log")
        with open(log_path, "a") as _f:
            _f.write(msg + "\n")
    except OSError:
        pass


def normalise(q: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for stable cache keys."""
    q = q.lower().strip()
    q = re.sub(r"[^\w\s]", "", q)
    q = re.sub(r"\s+", " ", q)
    return q


def parse_llm_json(raw: str):
    """Strip markdown code fences and preamble, then parse the first complete JSON value.

    Uses raw_decode so trailing text after the JSON object/array is ignored — both Qwen
    and Haiku can append filler sentences after the closing bracket.
    """
    raw = re.sub(r"```[\w]*\n?|```", "", raw)
    match = re.search(r"[\[{]", raw)
    if not match:
        raise ValueError(f"No JSON found in LLM response: {raw[:200]}")
    obj, _ = json.JSONDecoder().raw_decode(raw, match.start())
    return obj


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
        system_payload = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
        t0 = time.perf_counter()
        response = runtime.anthropic_client.messages.create(
            model=runtime.llm_model,
            system=system_payload,
            messages=[{"role": "user", "content": user_content}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        ms = (time.perf_counter() - t0) * 1000
        u = getattr(response, "usage", None)
        cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
        cache_hit = " CACHE_HIT" if cache_read > 0 else ""
        _log(
            f"[LLM] {ms:.0f}ms | in={getattr(u,'input_tokens','?')} "
            f"out={getattr(u,'output_tokens','?')} cache_read={cache_read}{cache_hit}"
        )
        return response.content[0].text if response.content else ""

    t0 = time.perf_counter()
    response = runtime.client.chat.completions.create(
        model=runtime.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    ms = (time.perf_counter() - t0) * 1000
    _log(f"[LLM] {ms:.0f}ms | ollama")
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
        system_payload = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}] if system else []
        t0 = time.perf_counter()
        response = runtime.anthropic_client.messages.create(
            model=runtime.llm_model,
            system=system_payload,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        ms = (time.perf_counter() - t0) * 1000
        u = getattr(response, "usage", None)
        cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
        cache_hit = " CACHE_HIT" if cache_read > 0 else ""
        _log(
            f"[LLM chat] {ms:.0f}ms | in={getattr(u,'input_tokens','?')} "
            f"out={getattr(u,'output_tokens','?')} cache_read={cache_read}{cache_hit}"
        )
        return response.content[0].text if response.content else ""

    t0 = time.perf_counter()
    response = runtime.client.chat.completions.create(
        model=runtime.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    ms = (time.perf_counter() - t0) * 1000
    _log(f"[LLM chat] {ms:.0f}ms | ollama")
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
