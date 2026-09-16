// Reciprocal rank fusion: merges ranked id lists using position alone.
// A BM25 score and a cosine distance share no scale, and normalising them would invent one, so
// only ranks are combined. Pure and deterministic so the fused order can be tested exactly.
namespace backend.Services;

public static class ReciprocalRankFusion
{
    /// The constant from the original paper (Cormack, Clarke and Buettcher, 2009). Small values let
    /// one list's first place dominate; large values reward ids that several lists agree on.
    public const double DefaultK = 60;

    /// Fused ranking: each id scores weight / (k + rank) in every list it appears in, summed.
    public static IReadOnlyList<int> Fuse(
        IReadOnlyList<IReadOnlyList<int>> lists,
        double k = DefaultK,
        IReadOnlyList<double>? weights = null)
    {
        ArgumentNullException.ThrowIfNull(lists);
        if (k <= 0)
            throw new ArgumentOutOfRangeException(nameof(k), k, "k must be greater than 0");
        if (weights != null && weights.Count != lists.Count)
            throw new ArgumentException($"weights has {weights.Count} entries for {lists.Count} lists", nameof(weights));

        var scores = new Dictionary<int, double>();
        var bestRank = new Dictionary<int, int>();
        for (var listIndex = 0; listIndex < lists.Count; listIndex++)
        {
            var list = lists[listIndex];
            if (list == null)
                continue;

            var weight = weights?[listIndex] ?? 1.0;
            var seen = new HashSet<int>();
            var rank = 0;
            foreach (var id in list)
            {
                // A list naming the same id twice is paid once, at its best position.
                if (!seen.Add(id))
                    continue;
                rank++;
                scores[id] = scores.GetValueOrDefault(id) + weight / (k + rank);
                bestRank[id] = Math.Min(bestRank.GetValueOrDefault(id, int.MaxValue), rank);
            }
        }

        // Ties break on best position, then on id, so the same inputs always rank the same way.
        return scores
            .OrderByDescending(score => score.Value)
            .ThenBy(score => bestRank[score.Key])
            .ThenBy(score => score.Key)
            .Select(score => score.Key)
            .ToList();
    }
}
