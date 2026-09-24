// Retrieval quality metrics for the Smart Search evaluation harness.
// Every metric takes a ranked list of watch ids and a set of ids judged relevant,
// so the same functions score the keyword baseline and the full AI pipeline identically.

/// Fraction of the relevant set that appears in the top k. Undefined (null) when
/// the query has no relevant items — callers drop those queries rather than score them 0.
export function recallAtK(ranked, relevant, k) {
  if (relevant.size === 0) return null;
  const hits = ranked.slice(0, k).filter(id => relevant.has(id)).length;
  return hits / relevant.size;
}

/// Fraction of the top k that is relevant. Denominator is k, not the result count,
/// so returning 3 good results out of a possible 10 is not scored as perfect precision.
export function precisionAtK(ranked, relevant, k) {
  if (relevant.size === 0) return null;
  const hits = ranked.slice(0, k).filter(id => relevant.has(id)).length;
  return hits / k;
}

/// 1 / rank of the first relevant result, 0 if none in the top k. Rewards putting a
/// good answer first, which matters more than raw recall for a result grid users skim.
export function reciprocalRank(ranked, relevant, k) {
  if (relevant.size === 0) return null;
  for (let i = 0; i < Math.min(ranked.length, k); i++) {
    if (relevant.has(ranked[i])) return 1 / (i + 1);
  }
  return 0;
}

/// Binary-gain nDCG@k: discounts each hit by log2(rank + 1) and normalises against
/// the ideal ordering, so it separates "relevant but buried" from "relevant and first".
export function ndcgAtK(ranked, relevant, k) {
  if (relevant.size === 0) return null;
  let dcg = 0;
  for (let i = 0; i < Math.min(ranked.length, k); i++) {
    if (relevant.has(ranked[i])) dcg += 1 / Math.log2(i + 2);
  }
  let idcg = 0;
  for (let i = 0; i < Math.min(relevant.size, k); i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? null : dcg / idcg;
}

/// True when at least one relevant result made the top k — the "did the user see
/// anything useful at all" view, which is often more legible to non-engineers than recall.
export function hitAtK(ranked, relevant, k) {
  if (relevant.size === 0) return null;
  return ranked.slice(0, k).some(id => relevant.has(id)) ? 1 : 0;
}

// -- Graded metrics -----------------------------------------------------------
//
// The open-ended half is judged 0-3 rather than right/wrong, because those briefs have no single
// right answer. These take a Map<id, grade> holding only the graded ids; anything absent is 0.

/// Gain for a grade. Exponential, so grade 3 is worth more than two grade-2 results: the point of
/// the open-ended half is what the concierge brings out first, not how much it can list.
export function gain(grade) {
  return grade > 0 ? 2 ** grade - 1 : 0;
}

/// nDCG@k over graded relevance, normalised against the best ordering the grades allow.
export function ndcgAtKGraded(ranked, grades, k) {
  if (grades.size === 0) return null;
  let dcg = 0;
  for (let i = 0; i < Math.min(ranked.length, k); i++) {
    dcg += gain(grades.get(ranked[i]) ?? 0) / Math.log2(i + 2);
  }
  const ideal = [...grades.values()].sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  for (let i = 0; i < ideal.length; i++) idcg += gain(ideal[i]) / Math.log2(i + 2);
  return idcg === 0 ? null : dcg / idcg;
}

/// Average grade over the k slots, as a share of a perfect 3. This is the graded reading of
/// precision@k: the denominator is k, so three good results out of ten slots is not a perfect score.
export function gainAtK(ranked, grades, k) {
  if (grades.size === 0) return null;
  let total = 0;
  for (let i = 0; i < k; i++) total += grades.get(ranked[i]) ?? 0;
  return total / (k * 3);
}

/// True when the top k holds something the user would actually consider — grade 2 or better.
/// Grade 1 is defensible rather than useful, so it does not count as a hit.
export function usefulHitAtK(ranked, grades, k, threshold = 2) {
  if (grades.size === 0) return null;
  return ranked.slice(0, k).some(id => (grades.get(id) ?? 0) >= threshold) ? 1 : 0;
}

/// Share of the top k that breaks a constraint the brief stated. Reported on its own line: an
/// average grade can look respectable while a third of the list is over budget.
export function violationRateAtK(ranked, violating, k) {
  const shown = ranked.slice(0, k);
  if (shown.length === 0) return null;
  return shown.filter(id => violating.has(id)).length / shown.length;
}

/// The highest recall@k this query can reach: a result list holds k items, so a label matching
/// more than k watches caps the score at k/|relevant| however good the ranking is.
///
/// Reporting raw recall without this understates the system and, worse, hides which categories
/// are actually broken — a label matching 76 watches caps recall@10 at 0.13, so 0.13 there is
/// a perfect score while 0.13 against a 20-watch label is a poor one.
export function recallCeiling(relevantCount, k) {
  if (!relevantCount || relevantCount <= 0) return null;
  return Math.min(1, k / relevantCount);
}

export function mean(values) {
  const usable = values.filter(v => v !== null && !Number.isNaN(v));
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => a + b, 0) / usable.length;
}

/// Nearest-rank percentile over an unsorted numeric array. Used for latency, where
/// p95 is the number worth quoting and the mean hides the LLM rerank tail.
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/// Percentile bootstrap confidence interval. With a golden set of ~100 queries the
/// point estimate alone is noisy; the interval is what makes a quoted delta defensible.
export function bootstrapCI(values, { iterations = 2000, alpha = 0.05, seed = 42 } = {}) {
  const usable = values.filter(v => v !== null && !Number.isNaN(v));
  if (usable.length < 2) return null;
  const rand = mulberry32(seed);
  const means = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < usable.length; j++) {
      sum += usable[Math.floor(rand() * usable.length)];
    }
    means.push(sum / usable.length);
  }
  means.sort((a, b) => a - b);
  const lo = means[Math.floor((alpha / 2) * iterations)];
  const hi = means[Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations))];
  return { lo, hi };
}

/// Paired bootstrap over per-query deltas between two arms. Answers the question an
/// interviewer will actually ask: is arm B better than arm A, or is this 80 queries of noise?
export function pairedBootstrap(armA, armB, { iterations = 2000, seed = 7 } = {}) {
  const deltas = [];
  for (let i = 0; i < armA.length; i++) {
    if (armA[i] === null || armB[i] === null) continue;
    deltas.push(armB[i] - armA[i]);
  }
  if (deltas.length < 2) return null;
  const ci = bootstrapCI(deltas, { iterations, seed });
  const observed = mean(deltas);
  const rand = mulberry32(seed + 1);
  let atOrBelowZero = 0;
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < deltas.length; j++) sum += deltas[Math.floor(rand() * deltas.length)];
    if (sum / deltas.length <= 0) atOrBelowZero++;
  }
  return { delta: observed, ci, pApprox: atOrBelowZero / iterations, n: deltas.length };
}

/// Direction of a paired delta once noise is accounted for. An interval entirely above zero is
/// a real improvement and one entirely below zero is a real regression; only an interval that
/// crosses zero is inconclusive. Checking the lower bound alone reports every regression, however
/// clear, as "not significant", which hides exactly the result a comparison exists to catch.
export function significance(ci) {
  if (!ci) return 'not significant';
  if (ci.lo > 0) return 'better';
  if (ci.hi < 0) return 'worse';
  return 'not significant';
}

/// Deterministic PRNG so every run of the harness produces identical intervals and
/// identical generated queries. Reproducibility is the point of the whole exercise.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
