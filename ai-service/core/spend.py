# Metered spend on the paid model, with an optional hard cap.
# Every Anthropic response reports its token usage; this prices it and keeps a running total for the
# process. With LLM_BUDGET_USD set, a call is refused before it is sent once the total reaches the cap.
import os
import threading

# USD per million tokens: (input, output). A cache write costs 1.25x input and a cache read 0.1x.
PRICES = {
    "claude-haiku-4-5": (1.00, 5.00),
}


class BudgetExceeded(RuntimeError):
    """Raised instead of sending a call once the spend cap is reached."""


_lock = threading.Lock()
_totals = {"usd": 0.0, "calls": 0, "input_tokens": 0, "output_tokens": 0, "refused": 0}


def budget() -> float | None:
    raw = os.getenv("LLM_BUDGET_USD", "").strip()
    return float(raw) if raw else None


def check(model: str) -> None:
    """Refuse the call when a cap is set and already reached. Calls already in flight still finish,
    so the total can pass the cap by at most the few calls one reply runs in parallel."""
    cap = budget()
    if cap is None:
        return
    if model not in PRICES:
        raise BudgetExceeded(f"No price for {model}, so LLM_BUDGET_USD cannot be enforced")
    with _lock:
        if _totals["usd"] >= cap:
            _totals["refused"] += 1
            raise BudgetExceeded(f"LLM budget of ${cap:.2f} reached; ${_totals['usd']:.4f} spent")


def charge(model: str, usage) -> float:
    """Add one response's cost to the running total and return it."""
    price = PRICES.get(model)
    tokens = {
        name: getattr(usage, name, 0) or 0
        for name in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
    }
    cost = 0.0
    if price is not None:
        input_price, output_price = price
        cost = (
            tokens["input_tokens"] * input_price
            + tokens["cache_creation_input_tokens"] * input_price * 1.25
            + tokens["cache_read_input_tokens"] * input_price * 0.1
            + tokens["output_tokens"] * output_price
        ) / 1_000_000
    with _lock:
        _totals["usd"] += cost
        _totals["calls"] += 1
        _totals["input_tokens"] += tokens["input_tokens"]
        _totals["output_tokens"] += tokens["output_tokens"]
    return cost


def snapshot() -> dict:
    with _lock:
        return {**_totals, "usd": round(_totals["usd"], 6), "budget_usd": budget()}


def reset() -> None:
    with _lock:
        for key in _totals:
            _totals[key] = 0.0 if key == "usd" else 0
