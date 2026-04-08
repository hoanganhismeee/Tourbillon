// Unit tests for WatchFinderService query parsing helpers.
// These cover deterministic fallback behavior used when AI intent parsing is unavailable.
using backend.Services;
using backend.Models;

namespace backend.Tests.Services;

public class WatchFinderServiceTests
{
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
