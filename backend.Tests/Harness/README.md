# Concierge harness

Review concierge reply quality without rebuilding the backend container or opening the site.

The harness runs the **real** `ChatService`, `ChatIntentClassifier`, and `ActionPlannerService`
in-process against a seeded in-memory catalogue and a live ai-service. Because
`backend.Tests` references `backend.csproj` directly, `dotnet test` compiles your C# changes
itself — `make back` is not needed, and the model stays loaded between runs.

## Requirements

Only ai-service needs to be reachable (default `http://localhost:5000`, override with
`AI_SERVICE_URL`). No backend container, no Postgres, no Redis.

## Running

Harness tests are skipped unless `CONCIERGE_HARNESS=1`, so CI and a normal `dotnet test`
never touch them.

```powershell
# PowerShell
$env:CONCIERGE_HARNESS = "1"
$env:CONCIERGE_PROMPT  = "a dress watch under 40k"
dotnet test --filter "FullyQualifiedName~SinglePrompt" -l "console;verbosity=detailed"
```

```bash
# Git Bash
CONCIERGE_HARNESS=1 CONCIERGE_PROMPT="a dress watch under 40k" \
  dotnet test --filter "FullyQualifiedName~SinglePrompt" -l "console;verbosity=detailed"
```

`-l "console;verbosity=detailed"` is required — without it xUnit swallows the output.

## The three entry points

| Test | Purpose | Override with |
|---|---|---|
| `SinglePrompt` | Fastest loop — one prompt, one reply | `CONCIERGE_PROMPT` |
| `PromptSuite` | Sweep across intents, fresh session each | `CONCIERGE_PROMPTS` (`a \|\| b \|\| c`) |
| `Conversation` | Multi-turn on one session — context carry-over, brand rejection | `CONCIERGE_CONVERSATION` |

## Reading the output

```
[1] > a dress watch under 40k
      intent=discovery (1.00)  path=classifier_discovery  finder=harness_catalogue  15155ms
```

`intent`/`confidence` come from the live `/classify` call, `path` is the `RoutingPath` the
turn resolved through, `finder` is the search path. These are recovered from ChatService's
structured logs — `ChatApiResponse` does not carry them — so a wrong-looking reply can be
traced to the branch that produced it without adding logging.

## What is real and what is not

| Real | Substituted |
|---|---|
| `ChatService` routing, session state, validation, retry | Catalogue — 5 brands, 8 collections, 12 watches (`ConciergeCatalogue`) |
| `/classify`, `/chat`, `/plan-actions` on ai-service | `WatchFinderService` — `CatalogueWatchFinder` filters on brand, collection, style, price cap |
| Chip planning and backend chip validation | Redis — in-memory `FakeRedis`, so each run starts with a clean session |

`CatalogueWatchFinder` has no embeddings and no vector search, so it is right for judging
**wording, routing, and chip quality** and wrong for judging **retrieval relevance**. When
retrieval is what you need to review, pass the real service:

```csharp
using var harness = new ConciergeHarness(watchFinder: realWatchFinderService);
```

Reply caching is bypassed by default (`BypassResponseCache = true`), so re-running an
identical prompt after a prompt edit actually re-runs the pipeline.

## Adding catalogue data

Edit `ConciergeCatalogue.cs`. It deliberately includes a price-0 entry
(`5811/1G-001`) so "Price on Request" handling stays visible in every sweep.
