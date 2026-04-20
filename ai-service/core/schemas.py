# Pydantic models for ai-service endpoints that return typed structured data.
# Used to validate LLM outputs (classify, plan-actions) and to keep request/response
# shapes explicit so .NET can deserialize them reliably.
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError


# ---- /classify ------------------------------------------------------------

IntentClass = Literal[
    "watch_compare",
    "collection_compare",
    "brand_decision",
    "affirmative_followup",
    "expansion_request",
    "revision_request",
    "contextual_followup",
    "brand_info",
    "collection_info",
    "brand_history",
    "discovery",
    "non_watch",
    "unclear",
]


class IntentClassification(BaseModel):
    """LLM-returned intent + confidence for the chat concierge router."""

    intent: IntentClass = "unclear"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


# ---- /plan-actions --------------------------------------------------------

ActionType = Literal[
    "compare",
    "search",
    "navigate",
    "suggest",
]


class SuggestedAction(BaseModel):
    """One planner-emitted chip. Backend re-validates slugs before surfacing."""

    type: ActionType
    label: str
    slugs: Optional[list[str]] = None      # compare
    query: Optional[str] = None            # search / suggest
    href: Optional[str] = None             # navigate
    reason: Optional[str] = None           # why the planner picked this chip


class PlanActionsResponse(BaseModel):
    """Wrapper returned by /plan-actions. Never contains more than 3 entries."""

    suggestedActions: list[SuggestedAction] = Field(default_factory=list)


def safe_parse(model: type[BaseModel], data: dict) -> Optional[BaseModel]:
    """Return the parsed model, or None if validation fails.

    Callers are expected to use this as a guard before surfacing LLM output.
    """
    try:
        return model.model_validate(data)
    except ValidationError:
        return None
