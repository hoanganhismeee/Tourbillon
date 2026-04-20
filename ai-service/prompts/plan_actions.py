# System prompt for the /plan-actions endpoint.
# The planner receives the assistant reply + resolved watch cards + intent and
# returns up to 3 typed tool calls that describe which follow-up chips would
# help the user next. The backend validates all slugs before surfacing any chip.
PLAN_ACTIONS_SYSTEM_PROMPT = """You are the action planner for the Tourbillon luxury watch chat concierge.

Your job is to decide which 0 to 3 follow-up chips to offer the user after the concierge reply.
You have four tools available:

- suggest_compare(slug_a, slug_b, label, reason) — pick two specific watch slugs from the provided watchCards that would make a rich side-by-side comparison. Only emit when both slugs come from watchCards, and preferably when the user has not already compared that exact pair in the conversation.
- suggest_collection_exploration(collection_slug, label, reason) — offer to open a specific collection page. The slug MUST come from a watchCard's collectionSlug.
- suggest_brand_info(brand_slug, label, reason) — offer a quick overview of a brand. The slug MUST come from a watchCard's brandSlug.
- suggest_smart_search(query, label, reason) — open Tourbillon Smart Search with a concrete refined brief. Use only when the user would benefit from broadening / refining the search (e.g. 'sport watches under 30k with steel bracelet').

Rules:
1. NEVER invent slugs. Every slug must appear in the provided watchCards.
2. Prefer variety: if the concierge already surfaced a compare action, a second compare chip is redundant — suggest exploration or brand info instead.
3. If the primary action is already a compare of two specific watches, it is fine to surface a DIFFERENT compare pair (e.g. a richer in-collection pair) — but skip if no better pair exists.
4. Skip chips that repeat the exact intent already fulfilled in the reply.
5. Do not suggest brands or collections that the user rejected in session.
6. Labels must be concise, polished, English (or the conversation language if obvious), and no longer than 9 words.
7. Return at most 3 tool calls total. If nothing is worth suggesting, return no tool calls.
8. Always respond with tool calls only — no prose, no explanation.

Think about what a boutique concierge would naturally offer next: the user just saw X, so the most useful next action is usually either a deeper comparison, an adjacent collection, brand context, or a refined search."""


def build_plan_actions_user_prompt(
    query: str,
    assistant_reply: str,
    intent: str,
    primary_action_types: list[str],
    watch_cards: list[dict],
    rejected_brand_slugs: list[str],
) -> str:
    """Render the user turn content with the full context the planner needs."""
    lines: list[str] = []
    lines.append(f'User message: "{query}"')
    lines.append("")
    if assistant_reply:
        trimmed_reply = assistant_reply.strip()
        if len(trimmed_reply) > 400:
            trimmed_reply = trimmed_reply[:400] + "..."
        lines.append(f"Concierge reply: {trimmed_reply}")
        lines.append("")
    lines.append(f"Classifier intent: {intent}")
    primary = ", ".join(primary_action_types) if primary_action_types else "none"
    lines.append(f"Primary action types already attached: {primary}")
    lines.append("")
    lines.append("Watch cards surfaced in this reply (use only these slugs):")
    if watch_cards:
        for card in watch_cards[:12]:
            slug = card.get("slug") or "?"
            name = card.get("name") or "?"
            brand_name = card.get("brandName") or "?"
            brand_slug = card.get("brandSlug") or "?"
            coll_name = card.get("collectionName") or "?"
            coll_slug = card.get("collectionSlug") or "?"
            price = card.get("price")
            price_str = f" (${price:,.0f})" if isinstance(price, (int, float)) and price > 0 else ""
            lines.append(
                f'- slug={slug} | name="{name}"{price_str} | brand="{brand_name}" ({brand_slug}) | collection="{coll_name}" ({coll_slug})'
            )
    else:
        lines.append("- (none)")
    lines.append("")
    if rejected_brand_slugs:
        lines.append("Brands the user has rejected this session — never suggest: " + ", ".join(rejected_brand_slugs))
        lines.append("")
    lines.append("Emit up to 3 tool calls for the most useful follow-up chips. If none would help, emit nothing.")
    return "\n".join(lines)


# Tool schemas in OpenAI tool-calling format. Any additional tool here also
# needs a handler in routes/plan_actions.py.
PLAN_ACTIONS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "suggest_compare",
            "description": "Offer a side-by-side comparison chip for two specific watches already surfaced.",
            "parameters": {
                "type": "object",
                "properties": {
                    "slug_a": {"type": "string", "description": "First watch slug, must come from watchCards."},
                    "slug_b": {"type": "string", "description": "Second watch slug, must come from watchCards."},
                    "label": {"type": "string", "description": "Chip label shown to the user, <= 9 words."},
                    "reason": {"type": "string", "description": "One short sentence describing why this compare helps."},
                },
                "required": ["slug_a", "slug_b", "label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_collection_exploration",
            "description": "Offer a chip that opens a specific collection page for deeper exploration.",
            "parameters": {
                "type": "object",
                "properties": {
                    "collection_slug": {"type": "string", "description": "Must match a card's collectionSlug."},
                    "label": {"type": "string", "description": "Chip label shown to the user, <= 9 words."},
                    "reason": {"type": "string", "description": "One short sentence describing why this exploration helps."},
                },
                "required": ["collection_slug", "label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_brand_info",
            "description": "Offer a chip that shows more information about a brand already surfaced.",
            "parameters": {
                "type": "object",
                "properties": {
                    "brand_slug": {"type": "string", "description": "Must match a card's brandSlug."},
                    "label": {"type": "string", "description": "Chip label shown to the user, <= 9 words."},
                    "reason": {"type": "string", "description": "One short sentence describing why this brand info helps."},
                },
                "required": ["brand_slug", "label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_smart_search",
            "description": "Open Tourbillon Smart Search with a refined natural-language brief.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The refined brief to run, e.g. 'steel sport watch with blue dial under 25k'."},
                    "label": {"type": "string", "description": "Chip label shown to the user, <= 9 words."},
                    "reason": {"type": "string", "description": "One short sentence describing why this search helps."},
                },
                "required": ["query"],
            },
        },
    },
]
