import json
import os
import sys
import unittest
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from flask import Flask


AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

try:
    import openai  # type: ignore # noqa: F401
except ModuleNotFoundError:
    stub = ModuleType("openai")

    class _OpenAIStub:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            raise RuntimeError("openai package is required for live taste evaluation")

    stub.OpenAI = _OpenAIStub
    sys.modules["openai"] = stub

from routes.taste import register_routes


@dataclass
class BehaviorEvalCase:
    name: str
    events: list[dict[str, Any]]
    available_brands: list[str]
    required_brands_any: list[str] = field(default_factory=list)
    forbidden_brands: list[str] = field(default_factory=list)
    expected_materials_any: list[str] = field(default_factory=list)
    expected_dial_colors_any: list[str] = field(default_factory=list)
    expected_price_max: int | None = None
    expected_case_size: str | None = None
    summary_should_contain_any: list[str] = field(default_factory=list)
    summary_should_not_contain_any: list[str] = field(default_factory=list)
    max_brand_count: int | None = None


def create_taste_app(runtime: Any) -> Flask:
    app = Flask(__name__)
    register_routes(app, runtime)
    return app


def assert_behavior_eval_case(
    test_case: unittest.TestCase,
    scenario: BehaviorEvalCase,
    payload: dict[str, Any],
) -> None:
    preferred_brands = payload.get("preferred_brands") or []
    preferred_materials = payload.get("preferred_materials") or []
    preferred_dial_colors = payload.get("preferred_dial_colors") or []
    summary = payload.get("summary")

    if scenario.required_brands_any:
        test_case.assertTrue(
            any(brand in preferred_brands for brand in scenario.required_brands_any),
            f"{scenario.name}: expected one of {scenario.required_brands_any} in {preferred_brands}",
        )

    for brand in scenario.forbidden_brands:
        test_case.assertNotIn(brand, preferred_brands, f"{scenario.name}: unexpected brand {brand}")

    if scenario.expected_materials_any:
        test_case.assertTrue(
            any(material in preferred_materials for material in scenario.expected_materials_any),
            f"{scenario.name}: expected one of {scenario.expected_materials_any} in {preferred_materials}",
        )

    if scenario.expected_dial_colors_any:
        test_case.assertTrue(
            any(color in preferred_dial_colors for color in scenario.expected_dial_colors_any),
            f"{scenario.name}: expected one of {scenario.expected_dial_colors_any} in {preferred_dial_colors}",
        )

    if scenario.expected_price_max is not None:
        test_case.assertEqual(
            scenario.expected_price_max,
            payload.get("price_max"),
            f"{scenario.name}: unexpected price_max",
        )

    if scenario.expected_case_size is not None:
        test_case.assertEqual(
            scenario.expected_case_size,
            payload.get("preferred_case_size"),
            f"{scenario.name}: unexpected case size",
        )

    if scenario.max_brand_count is not None:
        test_case.assertLessEqual(
            len(preferred_brands),
            scenario.max_brand_count,
            f"{scenario.name}: preferred_brands was too broad: {preferred_brands}",
        )

    if scenario.summary_should_contain_any:
        test_case.assertIsInstance(summary, str, f"{scenario.name}: summary should be a string")
        lowered = summary.lower()
        test_case.assertTrue(
            any(keyword.lower() in lowered for keyword in scenario.summary_should_contain_any),
            f"{scenario.name}: summary missing expected keywords {scenario.summary_should_contain_any}: {summary}",
        )

    if summary:
        lowered = summary.lower()
        for keyword in scenario.summary_should_not_contain_any:
            test_case.assertNotIn(
                keyword.lower(),
                lowered,
                f"{scenario.name}: summary should not contain '{keyword}': {summary}",
            )


class TasteBehaviorContractTests(unittest.TestCase):
    def setUp(self) -> None:
        runtime = SimpleNamespace()
        self.app = create_taste_app(runtime)
        self.client = self.app.test_client()

    def test_generate_dna_from_behavior_returns_400_when_events_missing(self) -> None:
        response = self.client.post(
            "/generate-dna-from-behavior",
            json={"events": [], "available_brands": ["Patek Philippe"]},
        )

        self.assertEqual(400, response.status_code)
        self.assertEqual({"error": "events is required"}, response.get_json())

    def test_generate_dna_from_behavior_acceptance_helper_checks_directional_expectations(self) -> None:
        scenario = BehaviorEvalCase(
            name="blue dress watches under 30k",
            events=[
                {"type": "watch_view", "entityName": "Reverso Tribute"},
                {"type": "collection_view", "entityName": "Calatrava"},
                {"type": "search", "entityName": "blue dial dress watch under 30k"},
                {"type": "brand_view", "entityName": "Patek Philippe"},
            ],
            available_brands=["Jaeger-LeCoultre", "Patek Philippe", "Audemars Piguet"],
            required_brands_any=["Patek Philippe", "Jaeger-LeCoultre"],
            expected_dial_colors_any=["blue"],
            expected_price_max=30000,
            max_brand_count=2,
            summary_should_contain_any=["dress", "refined", "calatrava", "reverso"],
        )

        llm_json = {
            "preferred_brands": ["Patek Philippe"],
            "preferred_materials": ["stainless steel"],
            "preferred_dial_colors": ["blue"],
            "price_min": None,
            "price_max": 30000,
            "preferred_case_size": "medium",
            "summary": "Recent browsing leans toward refined dress watches with a pull toward Patek Philippe.",
        }

        with patch("routes.taste.call_llm", return_value=json.dumps(llm_json)):
            response = self.client.post(
                "/generate-dna-from-behavior",
                json={"events": scenario.events, "available_brands": scenario.available_brands},
            )

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        assert_behavior_eval_case(self, scenario, payload)

    def test_generate_dna_from_behavior_acceptance_helper_allows_conservative_output_for_noisy_history(self) -> None:
        scenario = BehaviorEvalCase(
            name="noisy mixed browsing",
            events=[
                {"type": "search", "entityName": "best watch gift"},
                {"type": "search", "entityName": "watch books for beginners"},
                {"type": "watch_view", "entityName": "Overseas Chronograph"},
            ],
            available_brands=["Patek Philippe", "Audemars Piguet", "Vacheron Constantin"],
            max_brand_count=1,
            summary_should_not_contain_any=["holy trinity", "integrated bracelet sports luxe", "independent horology"],
        )

        llm_json = {
            "preferred_brands": [],
            "preferred_materials": [],
            "preferred_dial_colors": [],
            "price_min": None,
            "price_max": None,
            "preferred_case_size": None,
            "summary": None,
        }

        with patch("routes.taste.call_llm", return_value=json.dumps(llm_json)):
            response = self.client.post(
                "/generate-dna-from-behavior",
                json={"events": scenario.events, "available_brands": scenario.available_brands},
            )

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        assert_behavior_eval_case(self, scenario, payload)


@unittest.skipUnless(
    os.getenv("RUN_LIVE_TASTE_EVAL") == "1",
    "Set RUN_LIVE_TASTE_EVAL=1 to run live Watch DNA model evaluation against the configured ai-service model.",
)
class TasteBehaviorLiveEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from core.runtime import create_runtime

        runtime = create_runtime()
        app = create_taste_app(runtime)
        cls.client = app.test_client()

    def run_scenario(self, scenario: BehaviorEvalCase) -> dict[str, Any]:
        response = self.client.post(
            "/generate-dna-from-behavior",
            json={"events": scenario.events, "available_brands": scenario.available_brands},
        )
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        payload = response.get_json()
        assert_behavior_eval_case(self, scenario, payload)
        return payload

    def test_conservative_short_burst_stays_narrow(self) -> None:
        scenario = BehaviorEvalCase(
            name="short burst curiosity",
            events=[
                {"type": "brand_view", "entityName": "Patek Philippe"},
                {"type": "watch_view", "entityName": "Calatrava 6119G"},
                {"type": "search", "entityName": "dress watch"},
            ],
            available_brands=["Jaeger-LeCoultre", "Patek Philippe", "Audemars Piguet", "Vacheron Constantin"],
            max_brand_count=1,
            summary_should_not_contain_any=["Holy Trinity", "integrated bracelet", "independent horology"],
        )

        self.run_scenario(scenario)

    def test_blue_dress_watch_scenario_keeps_price_and_color_signal(self) -> None:
        scenario = BehaviorEvalCase(
            name="blue dress watches under 30k",
            events=[
                {"type": "watch_view", "entityName": "Reverso Tribute"},
                {"type": "collection_view", "entityName": "Calatrava"},
                {"type": "search", "entityName": "blue dial dress watch under 30k"},
                {"type": "brand_view", "entityName": "Patek Philippe"},
            ],
            available_brands=["Jaeger-LeCoultre", "Patek Philippe", "Audemars Piguet"],
            required_brands_any=["Patek Philippe", "Jaeger-LeCoultre"],
            expected_dial_colors_any=["blue"],
            expected_price_max=30000,
            max_brand_count=2,
            summary_should_contain_any=["dress", "refined", "calatrava", "reverso"],
        )

        self.run_scenario(scenario)

    def test_integrated_sports_luxe_scenario_mentions_the_right_direction(self) -> None:
        scenario = BehaviorEvalCase(
            name="integrated bracelet sports luxe",
            events=[
                {"type": "watch_view", "entityName": "Royal Oak Selfwinding"},
                {"type": "watch_view", "entityName": "Nautilus 5711/1A"},
                {"type": "collection_view", "entityName": "Overseas"},
                {"type": "search", "entityName": "integrated bracelet steel sports watch blue dial"},
                {"type": "brand_view", "entityName": "Audemars Piguet"},
            ],
            available_brands=["Audemars Piguet", "Patek Philippe", "Vacheron Constantin", "Jaeger-LeCoultre"],
            required_brands_any=["Audemars Piguet", "Patek Philippe", "Vacheron Constantin"],
            expected_dial_colors_any=["blue"],
            max_brand_count=3,
            summary_should_contain_any=["integrated", "sports luxe", "holy trinity", "sport watches"],
        )

        self.run_scenario(scenario)

    def test_noisy_search_heavy_scenario_stays_conservative(self) -> None:
        scenario = BehaviorEvalCase(
            name="noisy search heavy history",
            events=[
                {"type": "search", "entityName": "best luxury watch gift"},
                {"type": "search", "entityName": "watch podcast recommendations"},
                {"type": "search", "entityName": "how to start collecting watches"},
                {"type": "watch_view", "entityName": "Overseas Chronograph"},
            ],
            available_brands=["Patek Philippe", "Audemars Piguet", "Vacheron Constantin", "Jaeger-LeCoultre"],
            max_brand_count=1,
            summary_should_not_contain_any=["holy trinity", "independent horology", "grand complication"],
        )

        self.run_scenario(scenario)

    def test_large_high_end_dress_scenario_keeps_gold_and_price_signal(self) -> None:
        scenario = BehaviorEvalCase(
            name="large high-end dress watches",
            events=[
                {"type": "search", "entityName": "large dress watch over 200k blue dial white gold"},
                {"type": "watch_view", "entityName": "Royal Oak Jumbo Extra-Thin"},
                {"type": "watch_view", "entityName": "Calatrava 6119G"},
                {"type": "brand_view", "entityName": "Audemars Piguet"},
                {"type": "brand_view", "entityName": "Patek Philippe"},
                {"type": "collection_view", "entityName": "Patrimony"},
            ],
            available_brands=["Audemars Piguet", "Patek Philippe", "Vacheron Constantin", "Jaeger-LeCoultre"],
            required_brands_any=["Audemars Piguet", "Patek Philippe", "Vacheron Constantin"],
            expected_materials_any=["white gold", "yellow gold"],
            expected_dial_colors_any=["blue", "black"],
            expected_price_max=200000,
            expected_case_size="large",
            max_brand_count=3,
            summary_should_contain_any=["dress", "high-end", "haute", "collector"],
        )

        self.run_scenario(scenario)
