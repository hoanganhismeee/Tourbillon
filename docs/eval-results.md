# Measured results

Every number the README and the case study page quote, with the run it came from and the commit it
was measured at. A number without a date is an impression; this file is where each claim is
anchored. How the harness works — arms, labels, metrics, significance — is in
[eval/README.md](../eval/README.md) (English) and [eval/FRAMEWORK.md](../eval/FRAMEWORK.md)
(Vietnamese).

## What each table was measured on

| Table | Query set | Run file | Measured |
|---|---|---|---|
| Smart Search | 50 facet queries | `eval-2026-09-18T18-41-54-976Z.json` | 2026-09-18 |
| Concierge, Claude Haiku 4.5 and BM25 | 50 open-ended briefs | `eval-2026-09-21T15-07-46-450Z.json` | 2026-09-21, tree as at commit `ebecdba` |
| Concierge, Qwen 2.5 7B local | 50 open-ended briefs | `eval-2026-09-18T22-06-31-987Z.json` | 2026-09-18 |
| Choosing the retriever | both sets | `full-pool-spec.log`, `full-pool-semantic.log` | 2026-09-18 |

Run files live in `eval/results/`, which is gitignored: they are large and reproducible, so this
file is the record that travels with the repository. Re-print one without spending anything:
`node eval/run-eval.mjs --from=eval/results/<file>.json`.

## Smart Search, 50 facet queries

Deterministic parser and BM25F, no model.

| Metric | Smart Search | BM25 alone | Old search bar |
|---|---|---|---|
| nDCG@10 | **0.73** | 0.57 | 0.44 |
| Precision@5 | **0.69** | 0.54 | 0.39 |
| Recall@10, share of ceiling | **76%** | 61% | 51% |
| MRR | 0.79 | 0.70 | 0.55 |
| Hit rate@10 | 84% | 84% | 78% |
| Latency, p95 | 29 ms | 7 ms | 159 ms |

Bold is better than the BM25 baseline with 95% confidence on a paired bootstrap; the rest are
within noise. Slot F1 of the parser is 0.81.

## Concierge, 50 open-ended briefs

The same pipeline on two models, each against BM25 on the same briefs. Every value is over all 50
briefs. Against BM25 the concierge is significantly better on recall (+0.028, 95% CI [0.005,
0.057]); precision, MRR and nDCG are higher but inside the interval, which 50 briefs cannot
separate from noise.

| Metric | Claude Haiku 4.5 | Qwen 2.5 7B, local | BM25 alone |
|---|---|---|---|
| MRR | 0.46 | 0.30 | 0.32 |
| Precision@5 | 0.28 | 0.16 | 0.21 |
| nDCG@10 | 0.24 | 0.14 | 0.17 |
| Recall@10, share of ceiling | 21% | 14% | 12% |
| Hit rate@10 | 72% | 48% | 66% |
| Replies with a relevant action | 48% | 38% | - |
| Latency, p50 | 4.5 s | - | 6 ms |
| Latency, p95 | 10.8 s | - | 8 ms |

The local model's latency is left out: the laptop GPU throttled during its run, so the figure
would describe the cooling rather than the model.

**Stage timing, Haiku, 50 replies** (the wording and the action planner run in parallel)

| Stage | Ran on | p50 | p95 |
|---|---|---|---|
| classify | 50/50 | 820 ms | 1,244 ms |
| parse (beside the classifier) | 48/50 | 1,119 ms | 1,570 ms |
| parse wait | 33/50 | 144 ms | 712 ms |
| retrieval (SQL, vector, BM25F) | 50/50 | < 30 ms | < 40 ms |
| wording | 50/50 | 3,071 ms | 6,769 ms |
| action planner | 50/50 | 2,086 ms | 2,668 ms |
| **total** | 50/50 | **4,439 ms** | **10,772 ms** |

## What changed since the previous concierge run

2026-09-19 (`eval-2026-09-19T14-41-50-677Z.json`) → 2026-09-21, same model, same 50 briefs.

| | Before | After | Why |
|---|---|---|---|
| Retrieval metrics | 0.46 / 0.28 / 0.24 | identical | nothing in retrieval changed |
| Latency p50 / p95 | 3.9 s / 7.1 s | 4.5 s / 10.8 s | the reply now runs to its 180-token ceiling instead of being cut at 140; the planner got faster |
| Replies with a relevant action | 58% | 48% | the Smart Search chip is now offered only when Smart Search can read a filter from the message |
| Smart Search chips | 50, 24% relevant | 13, 38% relevant | 21 of the old chips opened a page with no results at all |
| Planner replies cut at the token ceiling | 48/48 | 12/50 | the planner no longer writes a `reason` per chip |
| Wording cut at the token ceiling | 52/54 | 38/58 | ceiling raised from 140 to 180 tokens |

The action figure is the honest cost of the chip rule: five of the removed hand-offs would have
landed on results that satisfied the brief, while twenty-one opened an empty page. The metric sees
the first and not the second.

## Re-measure after the links moved to the backend

2026-09-22, Haiku 4.5, ten of the same fifty briefs, one per category, paired against their own rows
in the run above. The change under test: the model names watches in plain words and the backend
attaches the links, so none of the reply's tokens go on URLs.

| | Before | After |
|---|---|---|
| Wording stage, median of the ten | 3,268 ms | 3,169 ms |
| Total, median of the ten | 4,333 ms | 5,732 ms |
| Output tokens per reply | ~170 | ~150 |
| Replies stopped at the ceiling | 38 of 58 | 10 of 10 |
| Replies that read as finished | 20 of 58 | 10 of 10 |

The wording stage did not move: 3% on ten briefs is well inside the variance of the API itself,
which swung one brief from 2.9 s to 5.4 s between the two runs. The total looks worse for the same
reason and on the same ten briefs, so **the table above still stands and is not re-stated from ten
samples**.

What did change is what the tokens buy. Haiku writes to whatever ceiling it is given — asking for
"two or three sentences" instead of "at most 60 words" changed nothing, all ten replies still
stopped at the ceiling — so the ceiling is the control and the reply used to spend about 40 tokens
per link on an address the reader never sees. Those tokens are now sentences, and a reply cut at
the ceiling ends at its last complete clause rather than mid-thought.

## Labels v2: how the open-ended half is judged

2026-09-24. The semantic labels were conjunctions of facets, most of them invented by the label
author: "something for a black tie gala" demanded gold and 39 mm, neither stated by the brief, so a
white-gold 40 mm dress watch scored as low as a dive watch. Each brief now states only what the user
stated (`must`) and reads the rest as grades 3/2/1 with the sentence the tier is argued from.

On the same 50 briefs, scored on the free arms, this moves the numbers a long way — not because
retrieval improved, but because a near miss is no longer counted as a failure:

| Metric | v1 labels (BM25) | v2 labels (BM25) |
|---|---|---|
| Precision@5 / mean grade | 0.21 | 0.44 |
| MRR | 0.32 | 0.63 |
| nDCG@10 | 0.17 | 0.30 |
| Hit rate@10 | 66% | 86% |
| Constraint violations in the top 10 | not measured | 13% |

**v1 and v2 numbers cannot be compared.** Everything published before 2026-09-24 is v1.

**The rubrics were checked blind.** `eval/judge-pool.mjs` pools candidates from BM25, the fused
retriever and three random watches, hides which system found what, and asks Haiku to grade them
against the rubric's own sentences. On 64 judgements across 12 briefs the first pass agreed exactly
59% of the time and within one grade 92%, with five two-grade disagreements. Three were the rubric's
fault and were moved: "light enough for golf" had matched a 43 mm ceramic chronograph, black tie
scored a 43.5 mm white-gold piece as zero, and "around five thousand" had been read more tightly
than the catalogue allows. After those fixes: **55% exact, 94% within one grade, one two-grade
disagreement left** — a 300 m Polaris the judge called "not sports" for a brief that says "not a
sports watch". That one is the rubric standing its ground, and it is why a stated constraint is a
constraint rather than a preference.

The judge costs $0.02 a pass and is a second opinion, never the source of truth.

## Known gaps in these numbers
- **One request took 134 s** during the run, an API stall rather than pipeline work. It is the
  maximum, not the p95, so the table is unaffected.
- **Labels are one person's judgement**, and 50 queries per half detects large effects rather
  than small ones.

## Reproducing the concierge run

```bash
# .env: LLM_BASE_URL=https://api.anthropic.com, LLM_MODEL=claude-haiku-4-5, LLM_API_KEY=...
#       CHAT_PREFETCH_PARSE=true
# Cold caches: Postgres semantic cache, Redis reply cache, and the ai-service process.
docker compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d --no-deps --force-recreate ai-service
node eval/run-eval.mjs --scope=semantic --arms=bm25,concierge
curl -s http://localhost:5000/usage      # what the run cost
```

The 2026-09-21 run cost **$0.74** on Haiku 4.5 for 50 briefs: 209 calls, 579k input and 31k output
tokens. Set `LLM_BUDGET_USD` on the ai-service to cap it; the cap refuses calls rather than
truncating the run cleanly, so leave headroom above the expected cost.
