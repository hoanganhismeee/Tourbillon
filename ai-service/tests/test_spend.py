# Tests for metered model spend and the LLM_BUDGET_USD cap. The cap is what makes the cost of an
# evaluation run a limit rather than an estimate, so pricing and refusal are pinned exactly.
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from core import spend  # noqa: E402

HAIKU = "claude-haiku-4-5"


def usage(inp=0, out=0, cache_write=0, cache_read=0):
    return SimpleNamespace(
        input_tokens=inp,
        output_tokens=out,
        cache_creation_input_tokens=cache_write,
        cache_read_input_tokens=cache_read,
    )


class SpendTests(unittest.TestCase):
    def setUp(self):
        spend.reset()
        self._budget = os.environ.pop("LLM_BUDGET_USD", None)

    def tearDown(self):
        os.environ.pop("LLM_BUDGET_USD", None)
        if self._budget is not None:
            os.environ["LLM_BUDGET_USD"] = self._budget
        spend.reset()

    def test_prices_input_output_and_cache_tokens(self):
        cost = spend.charge(HAIKU, usage(inp=1_000_000, out=100_000, cache_write=100_000, cache_read=1_000_000))
        # 1.00 input + 0.50 output + 0.125 cache write + 0.10 cache read
        self.assertAlmostEqual(cost, 1.725)
        self.assertEqual(spend.snapshot()["calls"], 1)

    def test_no_budget_never_refuses(self):
        spend.charge(HAIKU, usage(inp=10_000_000))
        spend.check(HAIKU)

    def test_refuses_once_the_budget_is_reached(self):
        os.environ["LLM_BUDGET_USD"] = "0.01"
        spend.check(HAIKU)
        spend.charge(HAIKU, usage(inp=6_000, out=1_000))  # $0.011
        with self.assertRaises(spend.BudgetExceeded):
            spend.check(HAIKU)
        self.assertEqual(spend.snapshot()["refused"], 1)

    def test_an_unpriced_model_cannot_run_under_a_budget(self):
        os.environ["LLM_BUDGET_USD"] = "1"
        with self.assertRaises(spend.BudgetExceeded):
            spend.check("some-other-model")


if __name__ == "__main__":
    unittest.main()
