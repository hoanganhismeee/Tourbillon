import sys
import unittest
from pathlib import Path
from types import ModuleType


AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

try:
    import openai  # type: ignore # noqa: F401
except ModuleNotFoundError:
    stub = ModuleType("openai")

    class _OpenAIStub:
        def __init__(self, *args, **kwargs) -> None:
            raise RuntimeError("openai package is required for live chat evaluation")

    stub.OpenAI = _OpenAIStub
    sys.modules["openai"] = stub

from routes.chat import _filter_actions  # noqa: E402


class ChatRouteActionFilterTests(unittest.TestCase):
    def test_filter_actions_allows_supported_cursor_actions(self) -> None:
        actions = _filter_actions(
            [{"type": "set_cursor", "cursor": "tourbillon", "label": "Switch cursor"}],
            [],
        )

        self.assertEqual(
            [{"type": "set_cursor", "cursor": "tourbillon", "label": "Switch cursor"}],
            actions,
        )

    def test_filter_actions_rejects_search_queries_that_echo_ui_commands(self) -> None:
        actions = _filter_actions(
            [{"type": "search", "query": "change the cursor to tourbillon", "label": "Open Smart Search"}],
            [],
        )

        self.assertEqual([], actions)


if __name__ == "__main__":
    unittest.main()
