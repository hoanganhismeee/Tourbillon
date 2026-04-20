# Pydantic models for ai-service endpoints that return typed structured data.
# Used to validate LLM outputs (classify, plan-actions) and to keep request/response
# shapes explicit so .NET can deserialize them reliably.
import json
import re
from typing import Literal, Optional, TypeVar, get_args

from pydantic import BaseModel, Field, ValidationError, model_validator


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
VALID_INTENTS = tuple(get_args(IntentClass))


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

    @model_validator(mode="after")
    def validate_shape(self):
        if self.type == "compare":
            slugs = [
                slug.strip().lower()
                for slug in (self.slugs or [])
                if isinstance(slug, str) and slug.strip()
            ]
            if len(set(slugs)) != 2:
                raise ValueError("compare actions require exactly two distinct slugs")
            self.slugs = slugs

        if self.type in {"search", "suggest"} and not (self.query or "").strip():
            raise ValueError(f"{self.type} actions require a query")

        if self.type == "navigate" and not (self.href or "").strip():
            raise ValueError("navigate actions require an href")

        return self


class PlanActionsResponse(BaseModel):
    """Wrapper returned by /plan-actions. Never contains more than 3 entries."""

    suggestedActions: list[SuggestedAction] = Field(default_factory=list, max_length=3)


_T = TypeVar("_T", bound=BaseModel)


def _strip_json_wrapper(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise ValueError("LLM returned an empty response")

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, count=1, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text, count=1)
        text = text.strip()

    match = re.search(r"[\[{]", text)
    if not match:
        snippet = text[:160].replace("\n", " ")
        raise ValueError(f"LLM response did not contain JSON: {snippet}")

    return text[match.start():].strip()


def _format_validation_error(exc: ValidationError) -> str:
    errors = exc.errors(include_url=False)
    parts = []
    for err in errors[:4]:
        location = ".".join(str(item) for item in err.get("loc", [])) or "root"
        parts.append(f"{location}: {err.get('msg', 'invalid value')}")
    return "; ".join(parts)


def parse_model_json(model: type[_T], raw: str, source: str) -> _T:
    """Parse a JSON string into a pydantic model with explicit error messages."""
    text = _strip_json_wrapper(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"{source} returned malformed JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc

    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"{source} returned invalid JSON shape: {_format_validation_error(exc)}") from exc


def safe_parse(model: type[_T], data: dict) -> Optional[_T]:
    """Return the parsed model, or None if validation fails.

    Callers are expected to use this as a guard before surfacing LLM output.
    """
    try:
        return model.model_validate(data)
    except ValidationError:
        return None
