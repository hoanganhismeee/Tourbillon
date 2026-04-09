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


def _allowed_catalogue_paths(context: list[str]) -> set[str]:
    allowed: set[str] = set()

    for item in context:
        watch_match = re.search(r'Watch "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if watch_match:
            allowed.add(f"/watches/{watch_match.group(2)}")

        brand_match = re.search(r'Brand "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if brand_match:
            allowed.add(f"/brands/{brand_match.group(2)}")

        collection_match = re.search(r'Collection "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if collection_match:
            allowed.add(f"/collections/{collection_match.group(2)}")

    return allowed


def _inject_entity_links(text: str, context: list[str]) -> str:
    """Inject markdown links for bare watch, brand, and collection mentions using provided slugs."""
    watches: dict[str, str] = {}
    brands: dict[str, str] = {}
    collections: dict[str, str] = {}

    for item in context:
        watch_match = re.search(r'Watch "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if watch_match:
            watches[watch_match.group(1)] = watch_match.group(2)

        brand_match = re.search(r'Brand "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if brand_match:
            brands[brand_match.group(1)] = brand_match.group(2)

        collection_match = re.search(r'Collection "([^"]+)" \(Slug: ([\w-]+)\)', item)
        if collection_match:
            collections[collection_match.group(1)] = collection_match.group(2)

    if not watches and not brands and not collections:
        return text

    replacements = [(name, f"[{name}](/watches/{slug})") for name, slug in watches.items()]
    replacements += [(name, f"[{name}](/brands/{slug})") for name, slug in brands.items()]
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


def _filter_internal_links(text: str, context: list[str]) -> str:
    """Remove internal markdown links that are not present in the supplied catalogue context."""
    allowed = _allowed_catalogue_paths(context)
    if not allowed:
        return text

    def replace(match: re.Match[str]) -> str:
        label = match.group(1)
        href = match.group(2)
        if href.startswith(("/watches/", "/brands/", "/collections/")) and href not in allowed:
            return label
        return match.group(0)

    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace, text)


def _filter_actions(actions: list, context: list[str]) -> list:
    """Keep only actions that reference store entities already present in context."""
    allowed = _allowed_catalogue_paths(context)
    filtered: list = []

    for action in actions:
        if not isinstance(action, dict):
            continue

        action_type = str(action.get("type") or "").strip().lower()
        label = str(action.get("label") or "").strip()

        if action_type == "compare":
            slugs = [
                slug for slug in action.get("slugs") or []
                if isinstance(slug, str) and f"/watches/{slug}" in allowed
            ]
            slugs = list(dict.fromkeys(slugs))
            if len(slugs) >= 2:
                filtered.append({
                    "type": "compare",
                    "slugs": slugs,
                    "label": label or "Compare these watches",
                })
        elif action_type == "search":
            query = str(action.get("query") or "").strip()
            if query:
                filtered.append({
                    "type": "search",
                    "query": query,
                    "label": label or "Open Smart Search",
                })

    return filtered


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/chat", methods=["POST"])
    def chat():
        """Conversational RAG endpoint for the chat concierge."""
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        context = data.get("context") or []
        history = data.get("history") or []

        if not query:
            return jsonify({"error": "query is required"}), 400

        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        context_block = "\n\n".join(context)
        if context_block:
            messages.append({"role": "user", "content": f"Relevant product context:\n{context_block}"})
            messages.append({"role": "assistant", "content": "Understood, I have the context."})

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
            safe_text = _filter_internal_links(linked, context)
            safe_actions = _filter_actions(actions, context)
            return jsonify({"message": safe_text, "actions": safe_actions})
        except Exception as exc:
            return jsonify({"error": f"Chat LLM call failed: {str(exc)}"}), 502
