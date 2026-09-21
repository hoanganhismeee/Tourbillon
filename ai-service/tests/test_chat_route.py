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
    _collect_grounded_entities,
    _cleanup_markdown_artifacts,
    _filter_internal_links,
    _reply_length,
    _response_matches_language,
    _system_prompt,
    _strip_action_lines,
    _truncate_chat_response,
)


class ChatRouteResponseSanitizerTests(unittest.TestCase):
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

    def test_strip_action_lines_removes_legacy_action_payloads(self) -> None:
        text = _strip_action_lines(
            "ACTIONS: [{\"type\":\"compare\",\"slugs\":[\"one\",\"two\"]}]\n"
            "These two Reversos share the same rectangular DNA."
        )

        self.assertEqual("These two Reversos share the same rectangular DNA.", text)

    def test_truncate_chat_response_drops_incomplete_trailing_sentence(self) -> None:
        cleaned = _truncate_chat_response(
            "Certainly! Let's compare the first two. The second watch is larger at 49.4 x 29"
        )

        self.assertEqual("Certainly! Let's compare the first two.", cleaned)

    def test_collect_grounded_entities_returns_only_catalogue_mentions_from_context(self) -> None:
        grounded = _collect_grounded_entities(
            "The Patek Philippe Aquanaut 5167A-001 is the cleaner everyday pick.",
            [
                'Brand "Patek Philippe" (Slug: patek-philippe): Geneva maison',
                'Collection "Aquanaut" (Slug: aquanaut): Modern sport line',
                'Watch "5167A-001" (Slug: patek-philippe-aquanaut-5167a-001): Patek Philippe Aquanaut',
            ],
        )

        self.assertEqual(["patek-philippe-aquanaut-5167a-001"], grounded["groundedWatchSlugs"])
        self.assertEqual(["Patek Philippe"], grounded["groundedBrandNames"])
        self.assertEqual(["Aquanaut"], grounded["groundedCollectionNames"])


class ChatRouteLanguageCheckTests(unittest.TestCase):
    """The English check decides whether the reply is regenerated, so a false negative costs
    a second full LLM call."""

    def test_typographic_punctuation_and_accented_names_are_still_english(self):
        for text in (
            "For a wedding, a slim dress watch works best — the Calatrava is a classic choice.",
            "It’s a classic dress watch.",
            "The A. Lange & Söhne Saxonia is a quiet, elegant pick.",
        ):
            self.assertTrue(_response_matches_language(text, "english"), text)

    def test_vietnamese_reply_is_not_english(self):
        self.assertFalse(_response_matches_language("Đồng hồ này rất đẹp.", "english"))

    def test_french_reply_is_not_english(self):
        self.assertFalse(_response_matches_language("Cette montre est une belle pièce pour le mariage.", "english"))


class ChatRouteReplyLengthTests(unittest.TestCase):
    """The reply kind sets both what the model aims for and where it is cut off."""

    def test_explain_gets_the_long_rule(self):
        rule = _reply_length("explain")
        self.assertEqual(rule["max_tokens"], 260)
        self.assertIn("150 to 180 words", _system_prompt(rule))

    def test_everything_else_gets_the_short_rule(self):
        for value in (None, "", "short", "advice", "unknown"):
            rule = _reply_length(value)
            self.assertEqual(rule["max_tokens"], 180, value)
            self.assertIn("at most 60 words", _system_prompt(rule))

    def test_the_cut_off_sits_above_the_target(self):
        # 60 words is about 80 tokens before links and 180 words about 240; the cap leaves room to finish.
        self.assertGreater(_reply_length("short")["max_tokens"], 60 * 1.3 * 1.5)
        self.assertGreater(_reply_length("explain")["max_tokens"], 180 * 1.3)


if __name__ == "__main__":
    unittest.main()
