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
| Held-out, before the fixes | 36 held-out briefs | `eval-2026-09-23T15-48-45-911Z.json` | 2026-09-23 |
| Held-out, after the fixes | 36 held-out briefs | `eval-2026-09-24T04-07-51-860Z.json` | 2026-09-24, tree as at commit `9b7ea73` |
| Reply grades | the same 36 replies | `reply-grades.json` | 2026-09-24 |

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

## Held-out test set, 36 open-ended briefs

These 36 briefs (`eval/frozen-set.mjs`) were written after the system was built and have never been
used to decide a change, which is what makes them worth quoting. Graded labels, so a near miss
scores. Two runs, same set, same model, same labels: the first found the defects, the second was
run after they were fixed.

| Metric | Concierge, after the fixes | Concierge, before | BM25 alone |
|---|---|---|---|
| Mean grade over the top 5 | **0.49** | 0.42 | 0.42 |
| MRR | **0.76** | 0.71 | 0.68 |
| nDCG@10 | **0.36** | 0.29 | 0.30 |
| Recall@10, share of ceiling | **29%** | 15% | 19% |
| Hit rate@10, grade 2 or better | 86% | 83% | 86% |
| Top 10 breaking a stated constraint | **0%** | 13% | 15% |
| Replies with a relevant action | 83% | 78% | - |
| Latency, p50 / p95 | 5.2 s / 8.5 s | 4.8 s / 10.7 s | 7 ms / 11 ms |

After: 2026-09-24, `eval-2026-09-24T04-07-51-860Z.json`, **$0.477**, tree as at commit `9b7ea73`.
Before: 2026-09-23, `eval-2026-09-23T15-48-45-911Z.json`, $0.51.

**Against BM25, nothing clears the 95% interval**: recall +0.039 [-0.028, 0.116], precision +0.070
[-0.074, 0.215], MRR +0.072 [-0.113, 0.249], nDCG +0.057 [-0.059, 0.183]. Every one of them moved
the right way and every one of them is inside noise on 36 briefs, so the claim the numbers support
is that the concierge is **at least the equal of a keyword baseline at retrieval while doing the
part the baseline cannot** — reading the brief, answering in prose, attaching a next step that is
useful 83% of the time — and that it no longer shows results the brief ruled out.

The violation row is the exception to that reading, because it is a count rather than an average:
**0 of the 191 cards shown broke a stated constraint**, against 30 of 198 in the run before the
fixes. Raw BM25 shows 47 such results in the same top tens.

**Where the remaining loss is.** The same run, scored before and after the card cut:

| | Pool of 44 candidates | The cards shown |
|---|---|---|
| Recall of the ideal answers | 0.45 (was 0.39) | 0.11 (at 10 cards) |
| nDCG | 0.55 @50 (was 0.49) | 0.56 @3 |
| Mean grade | - | 0.68 @3 (was 0.59) |

Retrieval now puts 45% of the grade-3 watches inside 50 candidates. The shortlist that reaches the
reply still holds a fraction of them, so selection remains the next thing worth working on — but it
is selecting from a better pool than before, and it is no longer selecting anything that breaks the
brief.

## Reply quality, 36 held-out replies

2026-09-24, judged by `claude-sonnet-5` from the stored replies of the run above, **$0.32**
(`eval/judge-reply.mjs`, `reply-grades.json`). A stronger model than the one that wrote them,
because Haiku grading its own prose is not an independent opinion. It is still a model grading a
model, so this is a distribution with the low grades quoted, not a headline.

| Grade | n | What it means |
|---|---|---|
| 3 | 6 (17%) | answers what was asked, every claim supported, ends somewhere useful |
| 2 | 13 (36%) | answers it, nothing wrong, but generic or the closing line adds little |
| 1 | 10 (28%) | partly answers, or asks the customer to restate what they already said |
| 0 | 7 (19%) | answers a different question, or claims something the cards do not show |

**Mean 1.50 of 3, and six replies claim a spec the cards do not support.** This is the weakest
number on this page and the most useful, because every other metric on the page scores the cards and
none of them reads the sentence the customer actually gets. Three patterns account for the zeros:

- **Unsupported specs** (`f11`, `f15`, `f26`, `f27`, `f29`): "65+ hours power reserve", "integrated
  bracelet", "openworked" — claims the catalogue record behind the card does not carry. The
  grounding validator checks the **names** a draft uses, not the specs it asserts about them.
- **Answering past the brief** (`f13`, `f19`, `f23`): a diamond-paved High Jewellery piece for
  someone who said "instruments, not jewellery"; dress watches for the motorbike and cycling briefs.
  The cards were defensible under the rubric; the prose did not read the context around them.
- **Cut off mid-list** (`f03`, `f04`): the reply promises three picks and describes one. The token
  ceiling again, this time visible as an unfinished thought rather than an unfinished sentence.

Each is a different fix — spec-level grounding, context in the wording prompt, a ceiling that fits
the number of picks — and none of them would have been visible from the retrieval metrics.

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

**Is the new ruler better than the old one?** Not something the scores can answer: v2 reads higher
than v1 because the ruler changed, not because anything improved. What can be answered is which
version agrees with a judgement made without either ruler in view. `eval/label-versions.mjs` pools
the same candidates, asks for a 0-3 grade from the brief alone — no rubric, no predicate — and then
scores both label versions against those verdicts:

| Against a rubric-free judge, 64 watch/brief pairs | v1 (binary) | v2 (graded) |
|---|---|---|
| Exact agreement | 36% | 42% |
| Within one grade | 58% | 86% |
| Mean absolute error | 1.22 | 0.75 |
| Labelled 0 where the judge said 2 or 3 | 23 | 6 |

The last row is the one that matters: the old labels called a watch worthless 23 times out of 64
where an outside reader would have taken it seriously. That is what "the labels are too strict" looks
like when it is measured rather than argued.

## What the held-out run found, and what the fixes did

2026-09-23/24. The point of a held-out set is to find what tuning cannot. The first run found four
backend defects, all of them invisible under the v1 binary labels because a violation was scored the
same as an ordinary miss.

| Defect | What it did | Fix |
|---|---|---|
| Price on Request satisfied every budget | "under five thousand" answered with an A. Lange & Söhne tourbillon; 9 of 10 cards over budget | a stated budget requires `CurrentPrice > 0` |
| Stated spec constraints never filtered | "a green dial, nothing else matters" returned five non-green dials | `StatedConstraintFilter` over the candidate list, on both retrieval paths and Smart Search |
| A complaint was not read as a constraint | "anything over 40mm looks silly on me" set a floor of 40 mm, not a ceiling | the exclusion vocabulary reads complaints; a size complaint sets the ceiling |
| An ordinary word named a collection | "nothing else matters" resolved GMT-Master II and pinned the search to Rolex; "I hate date windows" resolved Datejust | a short name word must appear in the query, and a negated word cannot name a collection |

On the six briefs that failed, results breaking a stated constraint went **29 → 0**, with card counts
held or improved (f18 went from 0 cards to 10: the concierge had been reading the complaint as a
revision of a shortlist that did not exist, and searching nothing).

**A hypothesis that did not survive.** The brand-prestige sort was suspected of costing quality — it
promotes the most prestigious catalogue pieces into the visible cards, and Price on Request is
concentrated in those brands. Scored against the stored pools, the sort is not the problem: mean
grade over the three cards is **0.590 as shown against 0.562 in raw retrieval order**. It stays, and
the defect was the budget filter underneath it.

**Run-to-run spread.** The `bm25`, `hybrid` and `vector` arms are deterministic: two passes over the
held-out set return identical ids, so any movement between runs on those arms is a code change, not
noise. The concierge was then run twice over the same 36 briefs on the local model, with the reply
cache and the semantic cache cleared between the passes:

| Two concierge passes, Qwen 2.5 7B, held-out set | Pass A | Pass B |
|---|---|---|
| Mean grade over the top 5 | 0.467 | 0.467 |
| MRR | 0.746 | 0.746 |
| nDCG@10 | 0.344 | 0.344 |
| Hit rate@10 | 86.1% | 86.1% |
| Violations in the top 10 | 1.2% | 1.2% |
| Pool recall@50 / gain@3 | 0.389 / 0.667 | 0.389 / 0.667 |
| Latency, p50 | 23.6 s | 21.2 s |

Every card metric is identical to three decimals, and the p50 moved 10%. The model's temperature
leaves the parse and the classification the same, so what varies between two runs of this pipeline is
the prose and the wait, not the shortlist. A card metric that moves between runs is therefore a
change in the code or in the labels — which is what makes a before/after comparison readable.

**The last violation.** That 1.2% was a single brief, `f35` — "a bracelet, not a strap, I sweat
through leather" — where four of ten cards were on leather: the strap was not part of the parse at
all. Reading it needed the complaint to be cut from the sentence before the positive matcher runs,
because the word being complained about is the word the brief would otherwise be asking for. After
that fix the brief returns ten cards and no violations.

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
