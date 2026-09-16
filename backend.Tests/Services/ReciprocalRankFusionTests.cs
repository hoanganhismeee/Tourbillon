// Tests for reciprocal rank fusion. The fused order is what the hybrid mode returns, so a fault
// here surfaces as a plausible ranking rather than as an error; each rule is pinned on its own.
using backend.Services;

namespace backend.Tests.Services;

public class ReciprocalRankFusionTests
{
    private static IReadOnlyList<int> Fuse(double k = ReciprocalRankFusion.DefaultK, double[]? weights = null,
        params int[][] lists) =>
        ReciprocalRankFusion.Fuse(lists, k, weights);

    [Fact]
    public void A_single_list_keeps_its_order()
    {
        Assert.Equal(new[] { 3, 1, 2 }, Fuse(lists: [[3, 1, 2]]));
    }

    [Fact]
    public void Agreement_between_lists_beats_one_list_s_top_pick()
    {
        // 2 is second in both lists; 1 and 3 are each first in one list only.
        Assert.Equal(2, Fuse(lists: [[1, 2], [3, 2]])[0]);
    }

    [Fact]
    public void K_decides_whether_a_single_first_place_or_agreement_wins()
    {
        int[][] lists = [[1, 90, 2], [91, 92, 2]];

        Assert.Equal(1, Fuse(k: 0.5, lists: lists)[0]);
        Assert.Equal(2, Fuse(k: 60, lists: lists)[0]);
    }

    [Fact]
    public void Weights_let_one_retriever_count_for_more()
    {
        int[][] lists = [[1, 2], [2, 1]];

        Assert.Equal(1, Fuse(weights: [2, 1], lists: lists)[0]);
        Assert.Equal(2, Fuse(weights: [1, 2], lists: lists)[0]);
    }

    [Fact]
    public void A_repeated_id_is_scored_once_at_its_best_position()
    {
        // Collapsed, 5 sits at rank 2 and ties with 7; counted raw it would be rank 3 and fall
        // behind 7, giving 4, 6, 7, 5, 8 instead.
        Assert.Equal(new[] { 4, 6, 5, 7, 8 }, Fuse(lists: [[4, 4, 5], [6, 7, 8]]));
    }

    [Fact]
    public void Empty_lists_are_ignored()
    {
        Assert.Equal(new[] { 1 }, Fuse(lists: [[], [1]]));
        Assert.Empty(Fuse(lists: [[], []]));
    }

    [Fact]
    public void Equal_scores_break_ties_on_best_rank_then_id()
    {
        Assert.Equal(new[] { 2, 10 }, Fuse(lists: [[10, 2], [2, 10]]));
    }

    [Fact]
    public void Invalid_arguments_are_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Fuse(k: 0, lists: [[1]]));
        Assert.Throws<ArgumentException>(() => Fuse(weights: [1], lists: [[1], [2]]));
    }
}
