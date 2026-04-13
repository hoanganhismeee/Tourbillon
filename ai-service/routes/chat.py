import json
import re
import urllib.error
import urllib.parse
import urllib.request

from flask import jsonify, request

from core.runtime import Runtime
from prompts.chat import CHAT_SYSTEM_PROMPT

ALLOWED_CURSOR_STYLES = {
    "default",
    "tourbillon",
    "crosshair",
    "lumed",
    "hand",
    "bezel",
    "compass",
    "sapphire",
    "rotor",
}

LANGUAGE_HINTS = {
    "en": "english",
    "english": "english",
    "fr": "french",
    "french": "french",
    "vi": "vietnamese",
    "vietnamese": "vietnamese",
    "ja": "japanese",
    "japanese": "japanese",
    "zh": "chinese",
    "chinese": "chinese",
    "es": "spanish",
    "spanish": "spanish",
    "de": "german",
    "german": "german",
    "it": "italian",
    "italian": "italian",
    "pt": "portuguese",
    "portuguese": "portuguese",
    "ko": "korean",
    "korean": "korean",
}

LANGUAGE_KEYWORDS = {
    "english": {"the", "and", "with", "about", "watch", "brand", "collection", "history"},
    "french": {"bonjour", "montre", "maison", "histoire", "collection", "avec", "pour", "suisse"},
    "vietnamese": {"dong", "ho", "lich", "su", "thuong", "hieu", "bo", "suu", "tap", "voi"},
}


def _extract_actions(raw: str) -> tuple[str, list]:
    """Extract and strip any ACTIONS: [...] lines from the LLM response."""
    lines = raw.rstrip().splitlines()
    actions = []
    text_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("ACTIONS:"):
            payload = stripped[len("ACTIONS:") :].strip()
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, list):
                    actions.extend(item for item in parsed if isinstance(item, dict))
            except Exception:
                pass
            continue
        text_lines.append(line)

    return "\n".join(text_lines).strip(), actions


def _truncate_chat_response(text: str, max_words: int = 130) -> str:
    """Safety-net word cap that keeps whole sentences and avoids cut-off fragments."""
    words = text.split()
    if len(words) <= max_words:
        stripped = text.strip()
        if stripped and stripped[-1] not in ".!?":
            sentences = re.split(r"(?<=[.!?])\s+", stripped)
            if len(sentences) > 1:
                candidate = " ".join(sentences[:-1]).strip()
                if candidate:
                    return candidate
            return stripped.rstrip(",;:- ") + "."
        return stripped

    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    kept: list[str] = []
    total_words = 0

    for sentence in sentences:
        sentence_words = sentence.split()
        if not sentence_words:
            continue
        if total_words + len(sentence_words) > max_words:
            break
        kept.append(sentence.strip())
        total_words += len(sentence_words)

    if kept:
        return " ".join(kept).strip()

    fallback = " ".join(words[:max_words]).rstrip(",;:- ")
    if fallback and fallback[-1] not in ".!?":
        fallback += "."
    return fallback


def _cleanup_markdown_artifacts(text: str) -> str:
    """Remove truncated markdown fragments so pills and links degrade into plain text."""
    cleaned = text.strip()
    if not cleaned:
        return cleaned

    cleaned = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]*$", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)$", r"\1", cleaned)
    cleaned = re.sub(r"\((/[^)]*)$", "", cleaned)

    if cleaned.count("**") % 2 == 1:
        cleaned = cleaned.replace("**", "")
    if cleaned.count("*") % 2 == 1:
        cleaned = cleaned.replace("*", "")

    cleaned = cleaned.rstrip(",;:- ")
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned


def _normalize_language(language: str | None) -> str | None:
    if not language:
        return None

    normalized = language.strip().lower()
    if not normalized:
        return None

    primary = normalized.split("-", 1)[0]
    return LANGUAGE_HINTS.get(normalized) or LANGUAGE_HINTS.get(primary)


def _language_score(text: str, language: str) -> int:
    words = re.findall(r"[a-zA-ZÀ-ÿ']+", text.lower())
    keywords = LANGUAGE_KEYWORDS.get(language, set())
    return sum(1 for word in words if word in keywords)


def _response_matches_language(text: str, expected_language: str | None) -> bool:
    if not text or not expected_language:
        return True

    # Vietnamese tone marks are highly distinctive and rarely appear in other languages.
    has_viet_tone_marks = bool(re.search(
        r"[ắằẳẵặấầẩẫậếềểễệịọốồổỗộớờởỡợụứừửữựỳỷỹỵ]", text
    ))

    if expected_language == "english":
        if re.search(r"[^\x00-\x7F]", text):
            return False
        english_score = _language_score(text, "english")
        competing_score = max(_language_score(text, "french"), _language_score(text, "vietnamese"))
        return english_score >= competing_score

    if expected_language == "french":
        # Vietnamese drift in a French response is clearly wrong.
        if has_viet_tone_marks:
            return False
        return True

    # All other languages — trust the model's built-in multilingual capability.
    return True


def _fetch_url_json(url: str) -> dict | list | None:
    try:
        request_obj = urllib.request.Request(url, headers={"User-Agent": "TourbillonChat/1.0"})
        with urllib.request.urlopen(request_obj, timeout=4) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None


def _fetch_web_notes(query: str) -> str | None:
    if not query:
        return None

    encoded_query = urllib.parse.quote(query)
    search_url = (
        "https://en.wikipedia.org/w/api.php"
        f"?action=opensearch&search={encoded_query}&limit=1&namespace=0&format=json"
    )
    search_result = _fetch_url_json(search_url)
    if not isinstance(search_result, list) or len(search_result) < 2 or not search_result[1]:
        return None

    title = urllib.parse.quote(str(search_result[1][0]))
    summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
    summary = _fetch_url_json(summary_url)
    if not isinstance(summary, dict):
        return None

    extract = str(summary.get("extract") or "").strip()
    title_text = str(summary.get("title") or query).strip()
    if not extract:
        return None

    return f"{title_text}: {extract}"


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
            if query and not re.search(
                r"\b(?:change the cursor|set the cursor|switch the cursor|cursor|watch named|introduce me|should i wear|browse the web|search the web|web|internet|history|heritage|background|founder|founded|origins?)\b",
                query,
                re.IGNORECASE,
            ):
                filtered.append({
                    "type": "search",
                    "query": query,
                    "label": label or "Open Smart Search",
                })
        elif action_type == "set_cursor":
            cursor = str(action.get("cursor") or "").strip().lower()
            if cursor in ALLOWED_CURSOR_STYLES:
                filtered.append({
                    "type": "set_cursor",
                    "cursor": cursor,
                    "label": label or "Update cursor",
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
        response_language = _normalize_language(data.get("responseLanguage"))
        allow_web_enrichment = bool(data.get("allowWebEnrichment"))
        web_query = (data.get("webQuery") or "").strip()
        allow_actions = bool(data.get("allowActions", True))

        if not query:
            return jsonify({"error": "query is required"}), 400

        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        context_block = "\n\n".join(context)
        if context_block:
            messages.append({"role": "user", "content": f"Relevant product context:\n{context_block}"})
            messages.append({"role": "assistant", "content": "Understood, I have the context."})

        if response_language:
            messages.append({
                "role": "user",
                "content": (
                    f"Response language rule: write the entire answer in {response_language} only. "
                    "Do not drift into another language."
                ),
            })
            messages.append({"role": "assistant", "content": "Understood, I will stay in the requested language."})

        if allow_web_enrichment and web_query:
            web_notes = _fetch_web_notes(web_query)
            if web_notes:
                messages.append({
                    "role": "user",
                    "content": (
                        "Secondary web notes for brand or horology background only. "
                        "Use these only when they do not conflict with Tourbillon catalogue context:\n"
                        f"{web_notes}"
                    ),
                })
                messages.append({"role": "assistant", "content": "Understood, I will treat the web notes as secondary background only."})

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

            if response_language and not _response_matches_language(text_only, response_language):
                retry_messages = messages + [
                    {"role": "assistant", "content": text_only},
                    {
                        "role": "user",
                        "content": (
                            f"Rewrite that answer in {response_language} only. "
                            "Keep the meaning, keep it concise, and do not add any other language."
                        ),
                    },
                ]
                retry = runtime.client.chat.completions.create(
                    model=runtime.llm_model,
                    messages=retry_messages,
                    max_tokens=200,
                    temperature=0.1,
                )
                raw = (retry.choices[0].message.content or "").strip()
                text_only, actions = _extract_actions(raw)

            trimmed = _cleanup_markdown_artifacts(_truncate_chat_response(text_only))
            linked = _inject_entity_links(trimmed, context)
            safe_text = _cleanup_markdown_artifacts(_filter_internal_links(linked, context))
            safe_actions = _filter_actions(actions, context) if allow_actions else []
            return jsonify({"message": safe_text, "actions": safe_actions})
        except Exception as exc:
            return jsonify({"error": f"Chat LLM call failed: {str(exc)}"}), 502
