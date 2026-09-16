// Reciprocal rank fusion for the hybrid retrieval arm. Merges several ranked id lists into one
// ranking using only each id's position, never its score, so a lexical relevance score and a
// cosine distance can be combined without ever being put on the same scale.

/// Fused score for each id: sum over lists of weight / (k + rank), rank 1-based.
/// k damps how much a single first place is worth: small k lets one list's top hit dominate,
/// large k rewards ids that several lists agree on. 60 is the value from the original paper.
export function rrfScores(lists, { k = 60, weights = null } = {}) {
  if (!Array.isArray(lists)) throw new TypeError('lists must be an array of ranked id arrays');
  if (weights != null && weights.length !== lists.length) {
    throw new Error(`weights length ${weights.length} does not match lists length ${lists.length}`);
  }
  if (k <= 0) throw new Error('k must be greater than 0');

  const scores = new Map();
  const bestRank = new Map();

  for (const [listIndex, list] of lists.entries()) {
    if (!Array.isArray(list)) continue;
    const weight = weights ? weights[listIndex] : 1;
    // A list that returns the same id twice must not be paid twice for it: only the best
    // position counts, the same way a result grid shows one card per watch.
    const seen = new Set();
    let rank = 0;
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      rank += 1;
      scores.set(id, (scores.get(id) ?? 0) + weight / (k + rank));
      bestRank.set(id, Math.min(bestRank.get(id) ?? Infinity, rank));
    }
  }

  return { scores, bestRank };
}

/// Ranked id list, best first. Ties break on best position across the lists and then on the
/// id itself, so two runs over the same inputs always produce the same ranking to score.
export function reciprocalRankFusion(lists, options = {}) {
  const { scores, bestRank } = rrfScores(lists, options);
  return [...scores.entries()]
    .sort((a, b) =>
      b[1] - a[1]
      || (bestRank.get(a[0]) - bestRank.get(b[0]))
      || compareIds(a[0], b[0]))
    .map(([id]) => id);
}

function compareIds(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}
