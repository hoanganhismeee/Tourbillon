// Tests for negation in a query — "not gold", "except a chronograph", "without a date".
// The ordering matters more than the patterns: negations are cut out of the query before the
// positive matchers run, because "not gold" left in place is read as a request for gold, which
// returns the exact opposite of what was asked.
using backend.Services;

namespace backend.Tests.Services;

public class WatchFinderExclusionTests
{
    private static QueryIntent Parse(string query)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);
        return intent;
    }

    // -- The inversion this exists to prevent ----------------------------------

    [Fact]
    public void NotGoldIsAnExclusion_NotARequestForGold()
    {
        var intent = Parse("a dress watch under 40mm, but definitely not gold");

        Assert.Contains("gold", intent.ExcludedMaterials);
        Assert.Null(intent.CaseMaterial);
    }

    [Fact]
    public void ExceptAChronographIsAnExclusion_NotARequestForOne()
    {
        var intent = Parse("a sports watch, anything except a chronograph");

        Assert.Contains("chronograph", intent.ExcludedComplications);
        Assert.DoesNotContain("chronograph", intent.Complications);
    }

    // -- The rest of the sentence still has to parse ---------------------------

    [Fact]
    public void FiltersOutsideTheNegationSurvive()
    {
        var intent = Parse("a dress watch under 40mm, but definitely not gold");

        Assert.Equal("dress", intent.Style);
        Assert.Equal(40, intent.MaxDiameterMm);
        Assert.Contains("gold", intent.ExcludedMaterials);
    }

    [Fact]
    public void APositiveMaterialAndANegatedComplicationCoexist()
    {
        var intent = Parse("steel watch without a chronograph");

        Assert.Equal("Steel", intent.CaseMaterial);
        Assert.Contains("chronograph", intent.ExcludedComplications);
    }

    // -- Phrasings ---------------------------------------------------------------

    [Theory]
    [InlineData("dress watch but not gold")]
    [InlineData("dress watch, no gold")]
    [InlineData("dress watch without gold")]
    [InlineData("dress watch excluding gold")]
    [InlineData("dress watch other than gold")]
    [InlineData("dress watch, anything but gold")]
    public void CommonNegationPhrasingsAreRecognised(string query)
    {
        Assert.Contains("gold", Parse(query).ExcludedMaterials);
    }

    [Fact]
    public void TheMoreSpecificMetalWins()
    {
        var intent = Parse("a watch but not rose gold");

        Assert.Contains("rose gold", intent.ExcludedMaterials);
    }

    // -- No false positives --------------------------------------------------------

    [Theory]
    [InlineData("gold dress watch")]
    [InlineData("rose gold chronograph")]
    [InlineData("steel watch with a chronograph")]
    public void PlainRequestsAreNotTreatedAsExclusions(string query)
    {
        var intent = Parse(query);

        Assert.Empty(intent.ExcludedMaterials);
        Assert.Empty(intent.ExcludedComplications);
    }

    // An exclusion on its own is enough to serve the query from SQL: "anything but a
    // chronograph" is a filter, even though it names nothing the user wants.
    [Fact]
    public void AnExclusionAloneCountsAsAFilter()
    {
        var intent = Parse("anything except a chronograph");

        Assert.NotEmpty(intent.ExcludedComplications);
    }

    [Fact]
    public void ExtractExclusionsReturnsTheQueryWithTheNegatedSpanRemoved()
    {
        var intent = new QueryIntent();
        var remaining = WatchFinderService.ExtractExclusions("dress watch but not gold", intent);

        Assert.DoesNotContain("gold", remaining, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dress watch", remaining, StringComparison.OrdinalIgnoreCase);
    }
}
