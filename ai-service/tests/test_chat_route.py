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

from routes.chat import (  # noqa: E402
    _cleanup_markdown_artifacts,
    _extract_actions,
    _filter_actions,
    _filter_internal_links,
    _truncate_chat_response,
)


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

    def test_filter_actions_rejects_compare_actions_with_fewer_than_two_allowed_slugs(self) -> None:
        actions = _filter_actions(
            [{"type": "compare", "slugs": ["allowed-watch", "missing-watch"], "label": "Compare"}],
            ['Watch "Allowed Watch" (Slug: allowed-watch): Brand Test; Collection Test; Price Price on Request; Description Test; Specs {}'],
        )

        self.assertEqual([], actions)

    def test_filter_internal_links_removes_unknown_catalogue_paths(self) -> None:
        filtered = _filter_internal_links(
            "Compare [Allowed Watch](/watches/allowed-watch) with [Unknown Watch](/watches/missing-watch)",
            ['Watch "Allowed Watch" (Slug: allowed-watch): Brand Test; Collection Test; Price Price on Request; Description Test; Specs {}'],
        )

        self.assertEqual("Compare [Allowed Watch](/watches/allowed-watch) with Unknown Watch", filtered)

    def test_filter_internal_links_removes_unknown_collection_paths(self) -> None:
        filtered = _filter_internal_links(
            "Try [Sport Collection](/collections/sport-collection) instead of [Imaginary Atelier](/collections/imaginary-atelier)",
            ['Collection "Sport Collection" (Slug: sport-collection): Technical Grand Seiko sport line'],
        )

        self.assertEqual("Try [Sport Collection](/collections/sport-collection) instead of Imaginary Atelier", filtered)

    def test_cleanup_markdown_artifacts_degrades_truncated_links_to_plain_text(self) -> None:
        cleaned = _cleanup_markdown_artifacts("Compare [Overseas](/collections/vacheron-constantin-overseas")

        self.assertEqual("Compare Overseas.", cleaned)

    def test_cleanup_markdown_artifacts_strips_heading_markers(self) -> None:
        cleaned = _cleanup_markdown_artifacts("### Comparison:\nThe first watch is slimmer.")

        self.assertEqual("Comparison:\nThe first watch is slimmer.", cleaned)

    def test_extract_actions_strips_action_lines_even_when_more_text_follows(self) -> None:
        text, actions = _extract_actions(
            "ACTIONS: [{\"type\":\"compare\",\"slugs\":[\"one\",\"two\"]}]\n"
            "These two Reversos share the same rectangular DNA."
        )

        self.assertEqual("These two Reversos share the same rectangular DNA.", text)
        self.assertEqual([{"type": "compare", "slugs": ["one", "two"]}], actions)

    def test_truncate_chat_response_drops_incomplete_trailing_sentence(self) -> None:
        cleaned = _truncate_chat_response(
            "Certainly! Let's compare the first two. The second watch is larger at 49.4 x 29"
        )

        self.assertEqual("Certainly! Let's compare the first two.", cleaned)


if __name__ == "__main__":
    unittest.main()
