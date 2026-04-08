// Unit tests for WatchFinderService query parsing helpers.
// These cover deterministic fallback behavior used when AI intent parsing is unavailable.
using backend.Services;
using backend.Models;

namespace backend.Tests.Services;

public class WatchFinderServiceTests
{
    public static IEnumerable<object[]> RegexQueryCases()
    {
        yield return
        [
            "Sport Watches Under 100k",
            (decimal?)null,
            100_000m,
            (double?)null,
            (double?)null,
            "sport",
            new[] { "Price on Request", "Under $5k", "$5k \u2013 $10k", "$10k \u2013 $25k", "$25k \u2013 $50k", "$50k \u2013 $100k" },
            Array.Empty<string>(),
            Array.Empty<string>()
        ];
        yield return
        [
            "sports watches between 50-100k",
            50_000m,
            100_000m,
            (double?)null,
            (double?)null,
            "sport",
            new[] { "Price on Request", "$50k \u2013 $100k" },
            Array.Empty<string>(),
            Array.Empty<string>()
        ];
        yield return
        [
            "Vacheron Dress Watch 39 to 40mm Dial Above 200k",
            200_000m,
            (decimal?)null,
            39d,
            40d,
            "dress",
            new[] { "Price on Request", "Over $100k" },
            new[] { "39mm", "40mm" },
            Array.Empty<string>()
        ];
        yield return
        [
            "diver watch 300m under 20k",
            (decimal?)null,
            20_000m,
            (double?)null,
            (double?)null,
            "diver",
            new[] { "Price on Request", "Under $5k", "$5k \u2013 $10k", "$10k \u2013 $25k" },
            Array.Empty<string>(),
            new[] { "150m \u2013 300m", "600m+" }
        ];
        yield return
        [
            "40mm dress watch under 50k",
            (decimal?)null,
            50_000m,
            40d,
            40d,
            "dress",
            new[] { "Price on Request", "Under $5k", "$5k \u2013 $10k", "$10k \u2013 $25k", "$25k \u2013 $50k" },
            new[] { "40mm" },
            Array.Empty<string>()
        ];
    }

    [Theory]
    [MemberData(nameof(RegexQueryCases))]
    public void ApplyRegexFilters_ProducesExpectedFilterBarState(
        string query,
        decimal? expectedMinPrice,
        decimal? expectedMaxPrice,
        double? expectedMinDiameter,
        double? expectedMaxDiameter,
        string? expectedStyle,
        string[] expectedPriceBuckets,
        string[] expectedDiameterBuckets,
        string[] expectedWaterBuckets)
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters(query, intent);
        var state = WatchFinderService.BuildFilterStateForDiagnostics(intent);

        Assert.Equal(expectedMinPrice, intent.MinPrice);
        Assert.Equal(expectedMaxPrice, intent.MaxPrice);
        Assert.Equal(expectedMinDiameter, intent.MinDiameterMm);
        Assert.Equal(expectedMaxDiameter, intent.MaxDiameterMm);
        Assert.Equal(expectedStyle, intent.Style);
        Assert.Equal(expectedPriceBuckets, state.PriceBuckets);
        Assert.Equal(expectedDiameterBuckets, state.DiameterBuckets);
        Assert.Equal(expectedWaterBuckets, state.WaterResistances);
    }

    [Fact]
    public void ApplyRegexFilters_ParsesToDiameterRangeAndMinPrice()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters(
            "Vacheron Dress Watch 39 to 40mm Dial Above 200k",
            intent);

        Assert.Equal("dress", intent.Style);
        Assert.Equal(39d, intent.MinDiameterMm);
        Assert.Equal(40d, intent.MaxDiameterMm);
        Assert.Equal(200_000m, intent.MinPrice);
        Assert.Null(intent.MaxPrice);
        Assert.Empty(intent.WaterResistanceBuckets);
        Assert.Null(intent.WaterResistance);
    }

    [Fact]
    public void ApplyRegexFilters_ParsesHyphenDiameterRange()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("dress watch 36-38mm under 50k", intent);

        Assert.Equal("dress", intent.Style);
        Assert.Equal(36d, intent.MinDiameterMm);
        Assert.Equal(38d, intent.MaxDiameterMm);
        Assert.Equal(50_000m, intent.MaxPrice);
    }

    [Fact]
    public void ApplyRegexFilters_Under100KIsPriceOnly()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("Sport Watches Under 100k", intent);

        Assert.Equal("sport", intent.Style);
        Assert.Equal(100_000m, intent.MaxPrice);
        Assert.Null(intent.MinPrice);
        Assert.Empty(intent.WaterResistanceBuckets);
        Assert.Null(intent.WaterResistance);
    }

    [Fact]
    public void ApplyRegexFilters_DoesNotTreatMillimetresAsWaterResistance()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("40mm dress watch", intent);

        Assert.Equal(40d, intent.MinDiameterMm);
        Assert.Equal(40d, intent.MaxDiameterMm);
        Assert.Empty(intent.WaterResistanceBuckets);
        Assert.Null(intent.WaterResistance);
    }

    [Fact]
    public void ApplyRegexFilters_ParsesExplicitWaterResistance()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("100m water resistance", intent);

        Assert.Equal("100", intent.WaterResistance);
        Assert.Equal(["50m \u2013 120m", "150m \u2013 300m", "600m+"], intent.WaterResistanceBuckets);
    }

    [Fact]
    public void IsLikelyReferenceQuery_MatchesDottedReference()
    {
        Assert.True(WatchFinderService.IsLikelyReferenceQuery("434.20.40.20.02.001"));
    }

    [Fact]
    public void IsLikelyReferenceQuery_MatchesRolexStyleReference()
    {
        Assert.True(WatchFinderService.IsLikelyReferenceQuery("M126710BLRO-0001"));
    }

    [Fact]
    public void ApplyRegexFilters_DoesNotTreatDottedReferenceAsSpecs()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("434.20.40.20.02.001", intent);

        Assert.Null(intent.MinPrice);
        Assert.Null(intent.MaxPrice);
        Assert.Null(intent.MinDiameterMm);
        Assert.Null(intent.MaxDiameterMm);
        Assert.Null(intent.WaterResistance);
    }

    [Fact]
    public void HasWatchDomainSignal_ReturnsFalseForBreakfast()
    {
        Assert.False(WatchFinderService.HasWatchDomainSignal("what's for breakfast?"));
    }

    [Fact]
    public void BuildFilterStateForDiagnostics_MapsMultiBrandAndCollectionIds()
    {
        var intent = new QueryIntent
        {
            BrandIds = [2, 12],
            CollectionIds = [46, 6],
            MaxPrice = 100_000m,
            Style = "diver"
        };

        var state = WatchFinderService.BuildFilterStateForDiagnostics(intent);

        Assert.Equal([2, 12], state.BrandIds);
        Assert.Equal([46, 6], state.CollectionIds);
        Assert.Equal(
            ["Price on Request", "Under $5k", "$5k \u2013 $10k", "$10k \u2013 $25k", "$25k \u2013 $50k", "$50k \u2013 $100k"],
            state.PriceBuckets);
    }

    [Fact]
    public void DirectSqlScore_PrioritisesExactReference()
    {
        var intent = new QueryIntent();
        var exact = new Watch { Name = "M126710BLRO-0001", CurrentPrice = 20_100m, BrandId = 9 };
        var other = new Watch { Name = "M126200-0003", CurrentPrice = 14_050m, BrandId = 9 };

        var exactScore = WatchFinderService.DirectSqlScore("M126710BLRO-0001", exact, intent, true);
        var otherScore = WatchFinderService.DirectSqlScore("M126710BLRO-0001", other, intent, true);

        Assert.True(exactScore > otherScore);
        Assert.True(exactScore >= 900);
    }

    [Fact]
    public void ResolveFuzzyCollections_MatchesSmallTyposAcrossCollections()
    {
        var collections = new List<Collection>
        {
            new() { Id = 10, Name = "Seamaster", BrandId = 1 },
            new() { Id = 20, Name = "Overseas", BrandId = 2 },
            new() { Id = 30, Name = "Patrimony", BrandId = 2 },
        };

        var matches = WatchFinderService.ResolveFuzzyCollections("seamastr oversea", collections, []);

        Assert.Equal([10, 20], matches.Select(c => c.Id).Order().ToArray());
    }

    [Fact]
    public void ResolveFuzzyCollections_RespectsMatchedBrandScope()
    {
        var collections = new List<Collection>
        {
            new() { Id = 10, Name = "Seamaster", BrandId = 1 },
            new() { Id = 20, Name = "Overseas", BrandId = 2 },
        };

        var matches = WatchFinderService.ResolveFuzzyCollections("seamastr oversea", collections, [2]);

        Assert.Equal([20], matches.Select(c => c.Id).ToArray());
    }

    [Fact]
    public void ResolveFuzzyCollections_DoesNotMatchGenericStyleTerms()
    {
        var collections = new List<Collection>
        {
            new() { Id = 10, Name = "Sport Collection", BrandId = 1 },
            new() { Id = 20, Name = "Heritage Collection", BrandId = 1 },
        };

        var matches = WatchFinderService.ResolveFuzzyCollections("sport watches under 100k", collections, []);

        Assert.Empty(matches);
    }

    [Fact]
    public void ResolveFuzzyCollections_MatchesPunctuationInsensitiveNames()
    {
        var collections = new List<Collection>
        {
            new() { Id = 10, Name = "Reverso", BrandId = 1 },
            new() { Id = 20, Name = "Day-Date", BrandId = 2 },
            new() { Id = 30, Name = "Seamaster", BrandId = 3 },
            new() { Id = 40, Name = "Datejust", BrandId = 2 },
        };

        var matches = WatchFinderService.ResolveFuzzyCollections(
            "JLC Reverso, Rolex Daydate, Omega Seamaster under 50k with good water resistance",
            collections,
            [1, 2, 3]);

        Assert.Equal([10, 20, 30], matches.Select(c => c.Id).Order().ToArray());
    }
}
