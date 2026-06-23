# Concierge Advisory Mode — Design

Date: 2026-06-23
Status: Approved (pending spec review)

## Problem

The chat concierge is meant to *advise* — that is what differentiates it from Smart
Search (a catalogue filter) and from plain discovery. Today, advice-seeking queries
are handled as plain discovery. A query like:

> "do I suit with diving watch, female 26 years old"

is classified as `discovery`, routed straight to `WatchFinderService`, and rendered
with a templated message — e.g. *"… are the strongest catalogue matches Tourbillon
surfaced. Open Smart Search to broaden the brief, or compare the surfaced watches side
by side."* — plus a 4-to-10-wide row of cards.

The advisory dimension is never addressed: there is no judgment about whether a dive
watch suits a 26-year-old woman, no reasoning about wrist size / scale, lifestyle, or
styling. The concierge only "pulls web features" (cards) instead of acting like an
actual advisor.

## Goals

- For personal / suitability queries, the concierge **leads with genuine advisory
  reasoning**, then presents **2-3 curated picks** with one fit-reason each, and closes
  with one narrowing follow-up question.
- Pure spec briefs ("blue dial chronograph under 30k", "Rolex divers") keep today's
  plain discovery behavior — no regression.
- Reuse the existing search + grounding + validation plumbing; no new endpoint.
- Respect the architecture rule: classify by meaning in ai-service `/classify`; keep all
  prompt strings in ai-service; backend sends/receives structured data only.

## Non-Goals (v1)

- Constraint-derived re-querying (e.g. deriving a smaller-diameter filter from "slimmer
  wrist"). Noted as a future enhancement.
- A dedicated `/advise` ai-service endpoint. The existing `/chat` endpoint is reused via
  a structured `mode` flag.
- Changing discovery behavior for non-advisory queries.

## Trigger Scope

Advisor mode fires only for **personal / suitability** queries — the user seeks a
personal-fit judgment, suitability opinion, or decision help, typically carrying personal
context (age, gender, wrist, lifestyle, occasion) or phrasing like "should I / do I suit /
is X right for me / help me decide / what works for…".

| Advisor mode (`advice_request`)              | Stays as today                                  |
| -------------------------------------------- | ----------------------------------------------- |
| "do I suit a diving watch, female 26"        | "blue dial chronograph under 30k" (`discovery`) |
| "should I get gold or steel"                 | "Rolex dive watches" (`discovery`)              |
| "what works for an office job"               | "AP under 50k" (`discovery`)                    |
| "help me pick my first nice watch"           | "Rolex or Patek" (`brand_decision`)             |

Boundary discipline so the new class does not cannibalize neighbors: pure spec briefs
stay `discovery`; named 2-brand choices stay `brand_decision`; named collection/watch
compares stay as-is. `advice_request` is for personal guidance that is *not* already a
structured compare/decision between named entities.

## Response Shape

Advise first, then curate. Reference target wording:

```
A dive watch absolutely suits a 26-year-old woman — the trick is scale. On a slimmer
wrist, look for a 36-40mm case rather than the 42mm+ tool-diver norm, so it reads
refined rather than chunky. Steel bracelets dress up or down; a touch of colour on the
dial keeps it youthful.

Two from Tourbillon that fit that brief:
  [card]  [card]

Want me to lean sportier or dressier?
```

## Architecture / Flow

```
Message
  → existing pre-checks (abuse, cursor) — unchanged
  → entity resolution — unchanged
  → IIntentClassifier → POST /classify → may now return "advice_request"
  → DispatchByIntentAsync:
      case advice_request → BuildAdviceResolutionAsync
          run WatchFinderService (same as discovery, honors excludedBrandIds)
          tighten curated set to <= 3 (AdviceCardLimit)
          UseAi = true, AiMode = "advisor", advisory deterministic seed message
          no-fit path → card-less advice resolution + "Open Smart Search" action
  → ComposeValidatedAiDraftAsync → CallAiServiceAsync
          POST /chat with mode = resolution.AiMode
          ai-service: mode == "advisor" → inject ADVISOR_GUIDANCE message pair
  → existing grounding validation / link filtering / fallback — unchanged
```

## Component Changes

### 1. Classification (ai-service)

- **`core/schemas.py`** — add `"advice_request"` to the `IntentClass` `Literal`.
  `VALID_INTENTS` auto-derives via `get_args`.
- **`prompts/classify.py`** — add the `advice_request` class line to
  `CLASSIFY_SYSTEM_PROMPT`'s intent list and an example-utterance bullet. Add a rule that
  pure spec briefs and named compares/decisions stay in their existing classes.

### 2. Backend dispatch (`backend/Services/ChatService.cs`)

- Add `public const string AdviceRequest = "advice_request";` to the `ChatIntent`
  constants block.
- Add `public string? AiMode { get; set; }` to the `ChatResolution` class.
- Add `private const int AdviceCardLimit = 3;`.
- Add `case ChatIntent.AdviceRequest:` to `DispatchByIntentAsync` → new
  `BuildAdviceResolutionAsync(canonicalMessage, mentions, excludedBrandIds)`:
  - Calls `WatchFinderService.FindWatchesAsync` (with `excludedBrandIds` when present),
    same as the discovery `case`.
  - On `non_watch` search path → return the existing `UnsupportedQueryMessage` resolution.
  - On results → build a discovery-style resolution but capped at `AdviceCardLimit`
    cards, with `UseAi = true`, `AiMode = "advisor"`, and an advisory deterministic seed
    message (used only if the AI draft fails validation twice).
  - On zero results → return a card-less resolution: `UseAi = true`,
    `AiMode = "advisor"`, empty `WatchCards`, plus the existing "Open Smart Search"
    action. The advisor still gives genuine guidance and points to the broader tool.
- Thread `AiMode` through `ComposeValidatedAiDraftAsync` → `CallAiServiceAsync` into the
  `/chat` request payload as `mode` (the `resolution` object already flows into
  `ComposeValidatedAiDraftAsync`).

### 3. AI wording (ai-service)

- **`prompts/chat.py`** — add an `ADVISOR_GUIDANCE` constant instructing: lead with 2-4
  sentences of genuine personal-fit reasoning (scale / wrist size, lifestyle, occasion,
  styling) drawn from the user's stated context and the surfaced watches' real specs;
  then present the curated picks with one fit-reason each; close with one narrowing
  follow-up. Keep it tasteful — reason about wrist size and style, not demographic
  stereotypes. Includes the anti-contradiction clause (below).
- **`routes/chat.py`** — read `mode = data.get("mode")`; when `mode == "advisor"`, append
  an `ADVISOR_GUIDANCE` user/assistant message pair (same injection mechanism already
  used for the response-language rule and secondary web notes), before `history` and the
  final user query.

### 4. Grounding & consistency

- Grounding for watch / brand / collection **names is unchanged** — the advisor may only
  name entities present in the supplied context. Existing `_filter_internal_links`,
  `_collect_grounded_entities`, and the backend draft validation continue to apply.
- The advisor gains explicit latitude for **general horology advice** (sizing norms,
  styling). This was always permitted (grounding forbids external *watch names*, not
  general guidance); `ADVISOR_GUIDANCE` makes it intentional.
- **Anti-contradiction clause:** if the surfaced watches do not match the sizing / style
  the advice recommends, the advisor must acknowledge the gap honestly (e.g. "Tourbillon's
  divers here run larger at 42mm; if you'd want something more refined…") rather than
  praising cards that contradict its own advice. This resolves the "advice says 36-40mm
  but cards show 42mm Royal Oak Offshore" clash without query rewriting.

## Testing

- **`backend.Tests/Services/ChatServiceTests.cs`**
  - `FakeClassifier` returns `advice_request` for a suitability query → assert resolution
    is `UseAi == true`, `AiMode == "advisor"`, `WatchCards.Count <= AdviceCardLimit`, and
    the advisory routing path.
  - No-fit case (search yields zero watches) → assert card-less advice resolution with the
    "Open Smart Search" action.
  - `FakeClassifier` default remains `"unclear"`; `ActionPlannerFake` unchanged.
- **`ai-service/tests/test_classify_route.py`**
  - Advice-shaped utterances classify as `advice_request`.
  - Spec briefs ("blue dial chronograph under 30k") still classify as `discovery`
    (guards the boundary).
- **`test-chat-context-resilience.mjs`** — optionally add one advisory turn (optional).

## Documentation

- `CLAUDE.md` — intent count 13 → 14, list `advice_request`, add advisor dispatch to the
  Chat Concierge Architecture flow.
- `docs/ROADMAP.md` and `docs/architecture.md` — note advisory mode.

## Commit Decomposition

1. ai-service: add `advice_request` to schema + classify prompt.
2. backend: `BuildAdviceResolutionAsync` dispatch + `AiMode` threading.
3. ai-service: `ADVISOR_GUIDANCE` + `/chat` `mode` handling.
4. tests: backend `ChatServiceTests` + ai-service `test_classify_route`.
5. docs: `CLAUDE.md`, `ROADMAP.md`, `architecture.md`.
```

Each step validated (`dotnet build` / `npx tsc --noEmit` / targeted tests) and committed
on the `Dev` branch per the repo workflow.
