# Tests for the /plan-actions endpoint and helper functions.
# These cover tool-call parsing, slug validation, and empty fallback behavior
# without making live LLM calls.
import json
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock

from flask import Flask

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

try:
    import openai  # type: ignore # noqa: F401
except ModuleNotFoundError:
    stub = ModuleType("openai")

    class _OpenAIStub:
        def __init__(self, *args, **kwargs) -> None:
            raise RuntimeError("openai package is required for live planner evaluation")

    stub.OpenAI = _OpenAIStub
    sys.modules["openai"] = stub

from routes.plan_actions import (  # noqa: E402
    _normalise_cards,
    _tool_call_to_action,
    register_routes,
)


def _tool_call(name: str, arguments) -> SimpleNamespace:
    return SimpleNamespace(function=SimpleNamespace(name=name, arguments=arguments))


def _mock_runtime(tool_calls=None, side_effect=None) -> MagicMock:
    choice = MagicMock()
    choice.message.tool_calls = tool_calls or []
    completion = MagicMock()
    completion.choices = [choice]
    runtime = MagicMock()
    runtime.llm_model = "test-model"
    runtime.use_anthropic = False
    runtime.rate_limiter = None
    runtime.client.chat.completions.create = MagicMock(side_effect=side_effect, return_value=completion)
    return runtime


class PlanActionsRouteTests(unittest.TestCase):
    def test_normalise_cards_lowercases_slugs_and_skips_invalid_rows(self) -> None:
        cards = _normalise_cards([
            {"slug": "NAUTILUS-5711", "brandSlug": "Patek-Philippe", "collectionSlug": "Nautilus"},
            {"slug": ""},
            "not-a-card",
        ])

        self.assertEqual(1, len(cards))
        self.assertEqual("nautilus-5711", cards[0]["slug"])
        self.assertEqual("patek-philippe", cards[0]["brandSlug"])
        self.assertEqual("nautilus", cards[0]["collectionSlug"])

    def test_tool_call_to_action_rejects_compare_with_unknown_slug(self) -> None:
        action = _tool_call_to_action(
            "suggest_compare",
            {"slug_a": "nautilus-5711", "slug_b": "missing-watch", "label": "Compare them"},
            {"nautilus-5711", "royal-oak-15202"},
            {"patek-philippe"},
            {"nautilus"},
        )

        self.assertIsNone(action)

    def test_plan_actions_endpoint_returns_validated_compare_chip(self) -> None:
        runtime = _mock_runtime(tool_calls=[
            _tool_call("suggest_compare", json.dumps({
                "slug_a": "nautilus-5711",
                "slug_b": "royal-oak-15202",
                "label": "Compare the icons",
            })),
            _tool_call("suggest_compare", json.dumps({
                "slug_a": "nautilus-5711",
                "slug_b": "royal-oak-15202",
                "label": "Duplicate idea",
            })),
        ])

        app = Flask(__name__)
        register_routes(app, runtime)
        client = app.test_client()

        response = client.post("/plan-actions", json={
            "query": "compare these",
            "assistantReply": "These are the strongest options.",
            "intent": "watch_compare",
            "primaryActionTypes": [],
            "watchCards": [
                {"slug": "nautilus-5711", "name": "5711", "brandSlug": "patek-philippe", "collectionSlug": "nautilus"},
                {"slug": "royal-oak-15202", "name": "15202", "brandSlug": "audemars-piguet", "collectionSlug": "royal-oak"},
            ],
            "rejectedBrandSlugs": [],
        })

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(1, len(payload["suggestedActions"]))
        self.assertEqual("compare", payload["suggestedActions"][0]["type"])
        self.assertEqual(["nautilus-5711", "royal-oak-15202"], payload["suggestedActions"][0]["slugs"])

    def test_plan_actions_endpoint_drops_invalid_tool_arguments(self) -> None:
        runtime = _mock_runtime(tool_calls=[
            _tool_call("suggest_brand_info", json.dumps({
                "brand_slug": "invented-brand",
                "label": "Tell me more",
            })),
            _tool_call("suggest_compare", "{not-valid-json"),
        ])

        app = Flask(__name__)
        register_routes(app, runtime)
        client = app.test_client()

        response = client.post("/plan-actions", json={
            "query": "what next",
            "assistantReply": "Here is the shortlist.",
            "intent": "contextual_followup",
            "watchCards": [
                {"slug": "nautilus-5711", "name": "5711", "brandSlug": "patek-philippe", "collectionSlug": "nautilus"},
                {"slug": "royal-oak-15202", "name": "15202", "brandSlug": "audemars-piguet", "collectionSlug": "royal-oak"},
            ],
        })

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual([], payload["suggestedActions"])
        self.assertIn("error", payload)

    def test_plan_actions_endpoint_falls_back_to_empty_on_llm_failure(self) -> None:
        runtime = _mock_runtime(side_effect=RuntimeError("LLM down"))

        app = Flask(__name__)
        register_routes(app, runtime)
        client = app.test_client()

        response = client.post("/plan-actions", json={
            "query": "what next",
            "assistantReply": "Here is the shortlist.",
            "intent": "contextual_followup",
            "watchCards": [
                {"slug": "nautilus-5711", "name": "5711", "brandSlug": "patek-philippe", "collectionSlug": "nautilus"},
                {"slug": "royal-oak-15202", "name": "15202", "brandSlug": "audemars-piguet", "collectionSlug": "royal-oak"},
            ],
        })

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual([], payload["suggestedActions"])
        self.assertIn("error", payload)


if __name__ == "__main__":
    unittest.main()
