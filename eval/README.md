# Smart Search evaluation harness

Measures whether the Smart Search pipeline (deterministic SQL → pgvector → LLM rerank) actually
retrieves better results than the keyword search it replaced, on a labelled set of queries.

Without this, every claim about search quality is an impression. With it, the claim is a number
with a confidence interval attached, reproducible by anyone who clones the repo.

## Running

```bash
make up                                    # backend must be reachable
node eval/run-eval.mjs --inspect           # what the catalogue actually contains
node eval/run-eval.mjs --validate          # label health only, no search calls
node eval/run-eval.mjs                     # full run, both arms
node eval/run-eval.mjs --scope=spec --arms=keyword,smart,vector,hybrid   # facet queries
node eval/run-eval.mjs --scope=semantic --arms=keyword,concierge         # open-ended briefs
```

Set `WatchFinderSettings:DisableLimitInDev=true` first, otherwise the daily quota rejects the run
after 5 queries. Each scope holds 50 queries and runs sequentially per arm. The `vector` and
`hybrid` arms embed every query in-process, which takes a few seconds each on CPU.

| Flag | Default | Purpose |
|---|---|---|
| `--base-url` / `BASE_URL` | `http://localhost:5248` | Target backend |
| `--arms` | `keyword,smart` | Which arms to score: `keyword`, `vector`, `hybrid`, `smart`, `concierge` |
| `--scope` | `all` | `spec` for facet queries, `semantic` for open-ended briefs |
| `--rrf-k` | `60` | Rank constant for the `hybrid` arm's fusion |
| `--k` | `10` | Cutoff for recall, MRR, nDCG, hit rate |
| `--pk` | `5` | Cutoff for precision |
| `--max-share` | `0.25` | Reject labels matching more than this share of the catalogue |
| `--passes` | `1` | Repeat the set; pass 2 shows the semantic cache warm |
| `--limit` | all | Score only the first N queries (smoke runs) |
| `--delay` | `0` | Milliseconds between requests |

Each run writes a full per-query JSON record to `eval/results/`.

## The arms

| Arm | What it calls | What it isolates |
|---|---|---|
| `keyword` | `GET /api/search` | Lexical matching over name, description, brand and collection. |
| `vector` | `POST /api/watch/find` with `mode=vector` | The embedding index alone: no parser, no rerank, no cache. |
| `hybrid` | both of the above, fused | Whether combining the two rankings beats either on its own. |
| `smart` | `POST /api/watch/find` | The deterministic parser that serves facet queries. |
| `concierge` | `POST /api/chat/message` | The chat path, which owns the open-ended briefs. |

`hybrid` fuses the lexical and vector rankings with reciprocal rank fusion: an id scores
`1 / (k + rank)` in each list it appears in, and the scores are summed. Only positions are used,
because an ILike relevance score and a cosine distance share no scale and normalising them would
invent one. `k` sets how much one first place is worth against agreement between both retrievers:
small `k` lets a single top hit dominate, large `k` rewards ids both lists returned.

`--scope` is what keeps the comparison fair once search and chat own different query types:
`spec` for the facet queries the parser serves, `semantic` for the briefs the concierge serves.
Scoring an arm on the half it no longer claims measures a scope decision, not retrieval quality.

## How ground truth is built

The weak point of any retrieval evaluation is the labels. Two rules keep them honest here.

**Labels are predicates, not id lists.** Each query states *what a correct answer is*
(`{ styleAny: ['dress'], diameterMax: 40 }`), and the harness derives the relevant id set by
scanning the live catalogue. Adding watches never invalidates a label, and a reviewer can argue
with the definition instead of having to trust a hand-picked list.

**Labels are written without looking at the output.** The truth spec for "something understated
for the office" is decided from the brief alone. Labelling by eyeballing what the pipeline
returned would score the pipeline against itself.

The set is 100 queries, split evenly by the subsystem that owns them:

| Scope | Owner | n | Categories |
|---|---|---|---|
| `spec` | Smart Search | 50 | reference, brand, brand alias, collection, brand + budget, budget, material, size, dial, complication, water resistance, movement, style, exclusion, compound |
| `semantic` | concierge | 50 | occasion, persona, aesthetic, lifestyle, collector, fit, budget with a vibe |

The split follows what the query needs, not how it is worded. "Something that can time a lap" is a
chronograph and "a proper strong diver" is a water-resistance floor, so both are `spec`: resolving
everyday wording to a facet is the parser's vocabulary job. `semantic` keeps only briefs that name no
facet at all, where the label is a judgement a knowledgeable salesperson would make.

Two sources feed the set:

- `HANDWRITTEN` — 89 queries, each with a comment recording why its label reads the brief the way
  it does, so a reviewer can argue with the reasoning rather than with a list of ids.
- `buildGenerated` — mechanical facet queries derived from the catalogue at runtime (exact
  reference lookup, brand, brand + budget, size band, material, dial, complication). Exact by
  construction, seeded so the sample is identical on every run, and capped by `GENERATED_CAPS`
  so repetitive facet lookups do not crowd out the handwritten wording.

`--validate` rejects four kinds of bad label before scoring: **invalid_key** (a truth key the
matcher does not read, which would silently widen the label), **empty** (no catalogue match, so
the label is wrong), **too_broad** (matches over `--max-share` of the catalogue, so any arm scores
well and the metric discriminates nothing), and **thin** (under 2 matches, so recall jumps between
0 and 0.5 on a single result).

One data rule the harness enforces: **price 0 is "Price on Request", not free**. Those watches
stay in the catalogue but can never satisfy a budget constraint, because their price is unknown.

## The metrics

| Metric | Question it answers |
|---|---|
| **Recall@10** | Of everything that should have matched, how much did the user see? |
| **Precision@5** | Of the top 5, how much was actually relevant? Denominator is 5, not the result count, so returning 3 good results out of a possible 10 is not scored as perfect. |
| **MRR** | How far down was the first good result? Rewards getting one right answer to the top. |
| **nDCG@10** | Recall weighted by rank — separates "relevant but buried" from "relevant and first". |
| **Hit rate@10** | Did the user see anything useful at all? The most legible number for non-engineers. |
| **p50 / p95 latency** | What a single user waits. The mean hides the LLM rerank tail; p95 is the number worth quoting. |

Recall and precision trade off against each other, which is why both are reported. A pipeline that
returns the entire catalogue has perfect recall and useless precision.

**Why the confidence interval matters.** With 50 queries per scope a point estimate is noisy. The harness
reports a bootstrap interval on recall and a **paired** bootstrap on the arm-to-arm delta. Pairing
(scoring both arms on the same queries and bootstrapping the per-query differences) removes
query-difficulty variance, which would otherwise swamp the effect being measured. A delta whose
interval crosses zero is reported as **not significant** — it is not a result yet, and quoting it
would be quoting noise.

## Reading the output

Four blocks, in the order they matter:

1. **Golden set** — label health. Fix anything flagged before believing the scores.
2. **Retrieval quality** — the headline table, plus recall broken down by category. The breakdown
   is where the interesting story is: expect the arms to be close on `reference` and `brand`
   lookups, where a keyword index is already adequate, and far apart on plain-language facets,
   compound briefs and the semantic categories, which is what everything beyond keyword matching
   is paying for.
3. **Path distribution** — which internal path served each query, measured per request rather than
   assumed from the code. This is the evidence behind any claim about keeping queries off the LLM.
4. **smart vs keyword** — the paired delta, then every query where the new pipeline is *worse*.
   That regression list is the most useful output in the file; it is the tuning queue.

## Turning the output into a claim

The pattern that survives scrutiny is **baseline + delta + n**. Missing any of the three makes the
number unfalsifiable, and an experienced reader discounts the whole line.

> Recall@10 0.54 → 0.89 against the keyword baseline on an 80-query labelled set

not

> improved search accuracy by 40%

State the cutoff (`@10`), because recall without a cutoff is meaningless. State the set size,
because it bounds how much the number can be trusted. Name the baseline, because "better" with no
comparison is not a measurement.

If the paired interval crosses zero, the honest move is to say the pipeline matched the baseline
on quality while doing something else better — latency, cost, or one scope — rather
than quoting a delta the data does not support.

## Extending it

- **New arm**: add an entry to `ARM_IMPLS` in `run-eval.mjs` returning `{ ids, meta }`. Nothing
  else in the harness knows which arm it is scoring.
- **New label dimension**: add the field to the record in `catalogue.mjs`, then a clause in
  `matchesTruth`.
- **New queries**: append to `HANDWRITTEN`, then run `--validate` before trusting the result.
