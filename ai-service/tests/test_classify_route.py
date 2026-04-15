# Tests for the /classify intent classifier endpoint.
# These tests exercise the route logic and prompt helper functions directly,
# without making live LLM calls.
import json
import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

try:
    import openai  # type: ignore # noqa: F401
except ModuleNotFoundError:
    stub = ModuleType("openai")

    class _OpenAIStub:
        def __init__(self, *args, **kwargs) -> None:
            raise RuntimeError("openai package is required for live evaluation")

    stub.OpenAI = _OpenAIStub
    sys.modules["openai"] = stub

from routes.classify import VALID_INTENTS, _safe_classify  # noqa: E402


def _mock_runtime(response_text: str) -> MagicMock:
    """Build a minimal runtime mock that returns response_text from the LLM."""
    choice = MagicMock()
    choice.message.content = response_text
    completion = MagicMock()
    completion.choices = [choice]
    client = MagicMock()
    client.chat.completions.create.return_value = completion
    runtime = MagicMock()
    runtime.client = client
    runtime.llm_model = "test-model"
    return runtime


class ClassifyRouteTests(unittest.TestCase):

    def _classify(self, intent: str, confidence: float = 0.95,
                  follow_up_mode: str = "none", last_card_count: int = 0,
                  brands: list | None = None, collections: list | None = None,
                  session_brands: list | None = None) -> dict:
        runtime = _mock_runtime(json.dumps({"intent": intent, "confidence": confidence}))
        session = {"followUpMode": follow_up_mode, "brandIds": session_brands or []}
        last_cards = [{}] * last_card_count
        entities = {"brands": brands or [], "collections": collections or []}
        return _safe_classify(runtime, "test query", session, last_cards, entities)

    def test_valid_intent_returned_unchanged(self) -> None:
        result = self._classify("discovery")
        self.assertEqual("discovery", result["intent"])
        self.assertAlmostEqual(0.95, result["confidence"])

    def test_all_valid_intents_accepted(self) -> None:
        for intent in VALID_INTENTS:
            with self.subTest(intent=intent):
                result = self._classify(intent)
                self.assertEqual(intent, result["intent"])

    def test_unknown_intent_replaced_with_unclear(self) -> None:
        result = self._classify("hallucinated_intent")
        self.assertEqual("unclear", result["intent"])
        self.assertEqual(0.0, result["confidence"])

    def test_llm_exception_returns_unclear_fallback(self) -> None:
        runtime = MagicMock()
        runtime.client.chat.completions.create.side_effect = RuntimeError("LLM down")
        runtime.llm_model = "test-model"
        result = _safe_classify(runtime, "hello", {}, [], {})
        self.assertEqual("unclear", result["intent"])
        self.assertEqual(0.0, result["confidence"])
        self.assertIn("error", result)

    def test_malformed_json_returns_unclear(self) -> None:
        runtime = _mock_runtime("not valid json at all")
        result = _safe_classify(runtime, "hello", {}, [], {})
        self.assertEqual("unclear", result["intent"])

    def test_markdown_fenced_json_parsed_correctly(self) -> None:
        runtime = _mock_runtime('```json\n{"intent": "brand_info", "confidence": 0.88}\n```')
        result = _safe_classify(runtime, "tell me about Patek", {}, [], {"brands": ["Patek Philippe"]})
        self.assertEqual("brand_info", result["intent"])

    def test_prompt_includes_session_context(self) -> None:
        """Classifier is called with session follow-up mode and card count."""
        runtime = _mock_runtime('{"intent": "expansion_request", "confidence": 0.9}')
        session = {"followUpMode": "watch_cards", "brandIds": [1, 2]}
        last_cards = [{}, {}, {}]
        entities = {"brands": [], "collections": []}
        result = _safe_classify(runtime, "show me more", session, last_cards, entities)
        self.assertEqual("expansion_request", result["intent"])
        # Verify the prompt contained card count info
        call_args = runtime.client.chat.completions.create.call_args
        messages = call_args.kwargs.get("messages") or (call_args.args[0] if call_args.args else [])
        user_content = next((m["content"] for m in messages if m["role"] == "user"), "")
        self.assertIn("3", user_content)  # last_card_count = 3
        self.assertIn("watch_cards", user_content)  # follow_up_mode

    def test_max_tokens_is_small(self) -> None:
        """Classifier should request at most 100 tokens — it only needs a short JSON blob."""
        runtime = _mock_runtime('{"intent": "discovery", "confidence": 0.8}')
        _safe_classify(runtime, "find a dress watch", {}, [], {})
        call_args = runtime.client.chat.completions.create.call_args
        max_tokens = call_args.kwargs.get("max_tokens") or (call_args.args[2] if len(call_args.args) > 2 else None)
        self.assertLessEqual(max_tokens, 100)

    def test_temperature_is_zero(self) -> None:
        """Classifier must be deterministic — temperature must be 0."""
        runtime = _mock_runtime('{"intent": "discovery", "confidence": 0.8}')
        _safe_classify(runtime, "recommend a watch", {}, [], {})
        call_args = runtime.client.chat.completions.create.call_args
        temperature = call_args.kwargs.get("temperature")
        self.assertEqual(0.0, temperature)


if __name__ == "__main__":
    unittest.main()
