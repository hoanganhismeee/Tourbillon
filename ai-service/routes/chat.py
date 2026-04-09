import json
import re

from flask import jsonify, request

from core.runtime import Runtime
from prompts.chat import CHAT_SYSTEM_PROMPT


def _extract_actions(raw: str) -> tuple[str, list]:
    """Extract and strip the ACTIONS: [...] line from the end of the LLM response."""
    lines = raw.rstrip().splitlines()
    actions = []
    text_lines = lines[:]

    for i in range(len(lines) - 1, max(len(lines) - 4, -1), -1):
        stripped = lines[i].strip()
        if stripped.startswith("ACTIONS:"):
            payload = stripped[len("ACTIONS:") :].strip()
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, list):
                    actions = parsed
            except Exception:
                pass
            text_lines = lines[:i]
            break

    return "\n".join(text_lines).strip(), actions


def _truncate_chat_response(text: str, max_words: int = 130) -> str:
    """Safety-net word cap — cuts at the last complete sentence within max_words."""
    words = text.split()
    if len(words) <= max_words:
        return text

    truncated = " ".join(words[:max_words])
    last_end = max(truncated.rfind("."), truncated.rfind("!"), truncated.rfind("?"))
    if last_end > len(truncated) // 2:
        return truncated[: last_end + 1]
    return truncated


def _inject_entity_links(text: str, context: list[str]) -> str:
    """Inject markdown links for bare brand and collection mentions using provided slugs."""
    brands: dict[str, str] = {}
    collections: dict[str, str] = {}

    for item in context:
        brand_match = re.search(r'Brand "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if brand_match:
            brands[brand_match.group(1)] = brand_match.group(2)

        collection_match = re.search(r'Collection "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if collection_match:
            collections[collection_match.group(1)] = collection_match.group(2)

    if not brands and not collections:
        return text

    replacements = [(name, f"[{name}](/brands/{slug})") for name, slug in brands.items()]
    replacements += [(name, f"[{name}](/collections/{slug})") for name, slug in collections.items()]
    replacements.sort(key=lambda item: -len(item[0]))

    link_re = re.compile(r"\[([^\]]+)\]\([^)]+\)")
    parts = []
    last = 0
    for link_match in link_re.finditer(text):
        parts.append(("plain", text[last : link_match.start()]))
        parts.append(("link", link_match.group(0)))
        last = link_match.end()
    parts.append(("plain", text[last:]))

    used: set[str] = set()
    result = []
    for kind, segment in parts:
        if kind == "link":
            result.append(segment)
            continue

        for name, link in replacements:
            if name in used:
                continue
            index = segment.find(name)
            if index >= 0:
                segment = segment[:index] + link + segment[index + len(name) :]
                used.add(name)
        result.append(segment)

    return "".join(result)


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/chat", methods=["POST"])
    def chat():
        """Conversational RAG endpoint for the chat concierge."""
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        context = data.get("context") or []
        history = data.get("history") or []
        enable_web_search = data.get("enableWebSearch", False)

        if not query:
            return jsonify({"error": "query is required"}), 400

        web_snippets = []
        if enable_web_search:
            try:
                from duckduckgo_search import DDGS

                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=3))
                web_snippets = [result["body"] for result in results if result.get("body")]
            except Exception as exc:
                print(f"Web search failed (proceeding without): {exc}")

        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        context_block = "\n\n".join(context)
        if context_block:
            messages.append({"role": "user", "content": f"Relevant product context:\n{context_block}"})
            messages.append({"role": "assistant", "content": "Understood, I have the context."})

        if web_snippets:
            web_block = "\n\n".join(web_snippets)
            messages.append({"role": "user", "content": f"Web search results:\n{web_block}"})
            messages.append({"role": "assistant", "content": "Noted the web context."})

        messages.extend(history)
        messages.append({"role": "user", "content": query})

        try:
            response = runtime.client.chat.completions.create(
                model=runtime.llm_model,
                messages=messages,
                max_tokens=200,
                temperature=0.3,
            )
            raw = (response.choices[0].message.content or "").strip()
            text_only, actions = _extract_actions(raw)
            trimmed = _truncate_chat_response(text_only)
            linked = _inject_entity_links(trimmed, context)
            return jsonify({"message": linked, "actions": actions})
        except Exception as exc:
            return jsonify({"error": f"Chat LLM call failed: {str(exc)}"}), 502
