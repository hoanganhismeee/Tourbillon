# /plan-actions — LLM-planned follow-up chip layer for the chat concierge.
# Called by .NET ChatService in parallel with /chat. Uses OpenAI-style tool
# calling to let the model pick which chips to surface. Slug validation is
# enforced here AND again on the .NET side — never trust slugs blindly.
from flask import jsonify, request

from core.llm import call_llm_with_tools
from core.runtime import Runtime
from core.schemas import PlanActionsResponse, safe_parse
from prompts.plan_actions import (
    PLAN_ACTIONS_SYSTEM_PROMPT,
    PLAN_ACTIONS_TOOLS,
    build_plan_actions_user_prompt,
)

MAX_SUGGESTIONS = 3
PLANNER_MAX_TOKENS = 300
PLANNER_TEMPERATURE = 0.2


def _normalise_cards(raw_cards: list) -> list[dict]:
    cards: list[dict] = []
    if not isinstance(raw_cards, list):
        return cards
    for item in raw_cards:
        if not isinstance(item, dict):
            continue
        slug = (item.get("slug") or "").strip().lower()
        if not slug:
            continue
        cards.append({
            "slug": slug,
            "name": item.get("name") or "",
            "brandName": item.get("brandName") or "",
            "brandSlug": (item.get("brandSlug") or "").strip().lower() or None,
            "collectionName": item.get("collectionName") or "",
            "collectionSlug": (item.get("collectionSlug") or "").strip().lower() or None,
            "price": item.get("price"),
        })
    return cards


def _build_card_indexes(cards: list[dict]) -> tuple[set[str], set[str], set[str]]:
    watch_slugs = {c["slug"] for c in cards}
    brand_slugs = {c["brandSlug"] for c in cards if c.get("brandSlug")}
    collection_slugs = {c["collectionSlug"] for c in cards if c.get("collectionSlug")}
    return watch_slugs, brand_slugs, collection_slugs


def _tool_call_to_action(
    name: str,
    args: dict,
    watch_slugs: set[str],
    brand_slugs: set[str],
    collection_slugs: set[str],
) -> dict | None:
    label = (args.get("label") or "").strip()
    reason = (args.get("reason") or "").strip() or None

    if name == "suggest_compare":
        slug_a = (args.get("slug_a") or "").strip().lower()
        slug_b = (args.get("slug_b") or "").strip().lower()
        if not slug_a or not slug_b or slug_a == slug_b:
            return None
        if slug_a not in watch_slugs or slug_b not in watch_slugs:
            return None
        return {
            "type": "compare",
            "label": label or f"Compare {slug_a} and {slug_b} side by side",
            "slugs": [slug_a, slug_b],
            "reason": reason,
        }

    if name == "suggest_collection_exploration":
        slug = (args.get("collection_slug") or "").strip().lower()
        if not slug or slug not in collection_slugs:
            return None
        return {
            "type": "navigate",
            "label": label or "Explore this collection",
            "href": f"/collections/{slug}",
            "reason": reason,
        }

    if name == "suggest_brand_info":
        slug = (args.get("brand_slug") or "").strip().lower()
        if not slug or slug not in brand_slugs:
            return None
        return {
            "type": "navigate",
            "label": label or "Tell me more about this brand",
            "href": f"/brands/{slug}",
            "reason": reason,
        }

    if name == "suggest_smart_search":
        query = (args.get("query") or "").strip()
        if not query:
            return None
        return {
            "type": "search",
            "label": label or "Open Smart Search",
            "query": query,
            "reason": reason,
        }

    return None


def _dedup_actions(actions: list[dict]) -> list[dict]:
    """Collapse duplicate chip ideas (same type + same key field)."""
    seen: set[tuple] = set()
    out: list[dict] = []
    for action in actions:
        key: tuple
        if action["type"] == "compare":
            slugs = tuple(sorted(action.get("slugs") or []))
            key = ("compare", slugs)
        elif action["type"] == "navigate":
            key = ("navigate", (action.get("href") or "").lower())
        elif action["type"] == "search":
            key = ("search", (action.get("query") or "").lower())
        else:
            key = (action["type"], action.get("label", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(action)
    return out


def _plan_actions(
    runtime: Runtime,
    query: str,
    assistant_reply: str,
    intent: str,
    primary_action_types: list[str],
    cards: list[dict],
    rejected_brand_slugs: list[str],
) -> tuple[list[dict], str | None]:
    user_prompt = build_plan_actions_user_prompt(
        query=query,
        assistant_reply=assistant_reply,
        intent=intent,
        primary_action_types=primary_action_types,
        watch_cards=cards,
        rejected_brand_slugs=rejected_brand_slugs,
    )
    try:
        tool_calls = call_llm_with_tools(
            runtime=runtime,
            system=PLAN_ACTIONS_SYSTEM_PROMPT,
            user_content=user_prompt,
            tools=PLAN_ACTIONS_TOOLS,
            max_tokens=PLANNER_MAX_TOKENS,
            temperature=PLANNER_TEMPERATURE,
        )
    except Exception as exc:
        return [], f"/plan-actions call failed: {exc}"

    if not tool_calls:
        return [], None

    watch_slugs, brand_slugs, collection_slugs = _build_card_indexes(cards)
    actions: list[dict] = []
    errors: list[str] = []

    for call in tool_calls:
        name = call.get("name", "") or ""
        args = call.get("arguments") or {}
        if not isinstance(args, dict):
            errors.append(f"tool {name} returned non-object arguments")
            continue

        action = _tool_call_to_action(name, args, watch_slugs, brand_slugs, collection_slugs)
        if action is None:
            errors.append(f"tool {name} returned unusable arguments")
            continue
        actions.append(action)

    actions = _dedup_actions(actions)
    return actions[:MAX_SUGGESTIONS], (errors[0] if errors and not actions else None)


def register_routes(app, runtime: Runtime) -> None:
    @app.route("/plan-actions", methods=["POST"])
    def plan_actions():
        """Return up to 3 planner-suggested follow-up chips for the given reply.

        Request body:
          query                 str
          assistantReply        str
          intent                str   — classifier output
          primaryActionTypes    list  — action types already attached by backend
          watchCards            list  — {slug, name, brandName, brandSlug, collectionName, collectionSlug, price}
          rejectedBrandSlugs    list  — brand slugs the user rejected this session
        Response:
          {"suggestedActions": [SuggestedAction, ...]}
        """
        data = request.get_json(silent=True) or {}
        query = (data.get("query") or "").strip()
        assistant_reply = (data.get("assistantReply") or "").strip()
        intent = (data.get("intent") or "unclear").strip().lower()
        primary_types = data.get("primaryActionTypes") or []
        cards = _normalise_cards(data.get("watchCards") or [])
        rejected_brand_slugs = [
            (s or "").strip().lower()
            for s in (data.get("rejectedBrandSlugs") or [])
            if isinstance(s, str) and s.strip()
        ]

        if not query or not cards:
            # Without cards there is nothing to plan around — backend's deterministic
            # fallback handles the no-cards case (static suggestion bank for refusals).
            return jsonify(PlanActionsResponse().model_dump())

        raw_actions, planner_error = _plan_actions(
            runtime=runtime,
            query=query,
            assistant_reply=assistant_reply,
            intent=intent,
            primary_action_types=[str(t) for t in primary_types if isinstance(t, str)],
            cards=cards,
            rejected_brand_slugs=rejected_brand_slugs,
        )

        # Validate via pydantic so malformed output still yields a clean response.
        payload = {"suggestedActions": raw_actions}
        parsed = safe_parse(PlanActionsResponse, payload)
        if parsed is None:
            return jsonify({
                **PlanActionsResponse().model_dump(),
                "error": "planner returned invalid suggested action shape",
            })

        response = parsed.model_dump(exclude_none=True)
        if planner_error:
            response["error"] = planner_error
        return jsonify(response)
