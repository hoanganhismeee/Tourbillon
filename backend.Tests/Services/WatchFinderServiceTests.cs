// Unit tests for WatchFinderService query parsing helpers.
// These cover deterministic fallback behavior used when AI intent parsing is unavailable.
using System.Collections.Generic;
using System.Linq;
using backend.Database;
using backend.Services;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class WatchFinderServiceTests
{
    private sealed class TestTourbillonContext : TourbillonContext
    {
        public TestTourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Ignore<WatchEmbedding>();
            modelBuilder.Ignore<QueryCache>();
        }
    }

    private static TourbillonContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TourbillonContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TestTourbillonContext(options);
    }

    private static WatchFinderService CreateService(TourbillonContext context)
    {
        var httpFactory = new Mock<IHttpClientFactory>(MockBehavior.Strict);
        return new WatchFinderService(
            httpFactory.Object,
            new DeterministicWatchSearchService(context, NullLogger<DeterministicWatchSearchService>.Instance),
            context,
            new WatchFilterMapper(),
            new QueryCacheService(context, NullLogger<QueryCacheService>.Instance),
            NullLogger<WatchFinderService>.Instance);
    }

    public sealed record FilterCase(
        string Query,
        decimal? MinPrice,
        decimal? MaxPrice,
        double? MinDiameter,
        double? MaxDiameter,
        string? Style,
        string? CaseMaterial,
        string? WaterResistance,
        string[] PriceBuckets,
        string[] DiameterBuckets,
        string[] WaterBuckets,
        string[] Complications,
        string[] PowerReserves);

    public sealed record FilterComponent(string Text, Action<QueryIntent> Apply);

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

    public static IEnumerable<object[]> GeneratedFilterCaseMatrix()
    {
        var styles = new[]
        {
            new FilterComponent("sport watch", i => i.Style = "sport"),
            new FilterComponent("dress watch", i => i.Style = "dress"),
            new FilterComponent("diver watch", i => i.Style = "diver"),
            new FilterComponent("luxury watch", _ => { }),
        };

        var prices = new[]
        {
            new FilterComponent("under 20k", i => i.MaxPrice = 20_000m),
            new FilterComponent("under 50k", i => i.MaxPrice = 50_000m),
            new FilterComponent("under 100k", i => i.MaxPrice = 100_000m),
            new FilterComponent("between 50-100k", i => { i.MinPrice = 50_000m; i.MaxPrice = 100_000m; }),
        };

        var diameters = new[]
        {
            new FilterComponent("", _ => { }),
            new FilterComponent("36mm", i => { i.MinDiameterMm = 36; i.MaxDiameterMm = 36; }),
            new FilterComponent("39mm", i => { i.MinDiameterMm = 39; i.MaxDiameterMm = 39; }),
            new FilterComponent("39 to 40mm", i => { i.MinDiameterMm = 39; i.MaxDiameterMm = 40; }),
        };

        var waters = new[]
        {
            new FilterComponent("", _ => { }),
            new FilterComponent("good water resistance", i => i.WaterResistanceBuckets.AddRange(["50m – 120m", "150m – 300m", "600m+"])),
            new FilterComponent("100m water resistance", i =>
            {
                i.WaterResistance = "100";
                i.WaterResistanceBuckets.AddRange(["50m – 120m", "150m – 300m", "600m+"]);
            }),
            new FilterComponent("300m water resistance", i =>
            {
                i.WaterResistance = "300";
                i.WaterResistanceBuckets.AddRange(["150m – 300m", "600m+"]);
            }),
        };

        var materials = new[]
        {
            new FilterComponent("", _ => { }),
            new FilterComponent("steel", i => i.CaseMaterial = "Steel"),
        };

        var complications = new[]
        {
            new FilterComponent("", _ => { }),
            new FilterComponent("chronograph", i => i.Complications.Add("Chronograph")),
        };

        var powerReserves = new[]
        {
            new FilterComponent("", _ => { }),
            new FilterComponent("72h power reserve", i => i.PowerReserves.Add("72h – 100h")),
        };

        foreach (var style in styles)
        foreach (var price in prices)
        foreach (var diameter in diameters)
        foreach (var water in waters)
        foreach (var material in materials)
        foreach (var complication in complications)
        foreach (var powerReserve in powerReserves)
        {
            var parts = new[] { style.Text, material.Text, diameter.Text, water.Text, complication.Text, powerReserve.Text, price.Text }
                .Where(p => !string.IsNullOrWhiteSpace(p));
            var query = string.Join(" ", parts);

            var expected = new QueryIntent();
            style.Apply(expected);
            price.Apply(expected);
            diameter.Apply(expected);
            water.Apply(expected);
            material.Apply(expected);
            complication.Apply(expected);
            powerReserve.Apply(expected);
            var state = WatchFinderService.BuildFilterStateForDiagnostics(expected);

            yield return
            [
                new FilterCase(
                    query,
                    expected.MinPrice,
                    expected.MaxPrice,
                    expected.MinDiameterMm,
                    expected.MaxDiameterMm,
                    expected.Style,
                    expected.CaseMaterial,
                    expected.WaterResistance,
                    state.PriceBuckets.ToArray(),
                    state.DiameterBuckets.ToArray(),
                    state.WaterResistances.ToArray(),
                    state.Complications.ToArray(),
                    state.PowerReserves.ToArray())
            ];
        }
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

    [Theory]
    [MemberData(nameof(GeneratedFilterCaseMatrix))]
    public void ApplyRegexFilters_GeneratedQueryMatrixProducesExpectedState(FilterCase testCase)
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters(testCase.Query, intent);
        var state = WatchFinderService.BuildFilterStateForDiagnostics(intent);

        Assert.Equal(testCase.MinPrice, intent.MinPrice);
        Assert.Equal(testCase.MaxPrice, intent.MaxPrice);
        Assert.Equal(testCase.MinDiameter, intent.MinDiameterMm);
        Assert.Equal(testCase.MaxDiameter, intent.MaxDiameterMm);
        Assert.Equal(testCase.Style, intent.Style);
        Assert.Equal(testCase.CaseMaterial, intent.CaseMaterial);
        Assert.Equal(testCase.WaterResistance, intent.WaterResistance);
        Assert.Equal(testCase.PriceBuckets, state.PriceBuckets);
        Assert.Equal(testCase.DiameterBuckets, state.DiameterBuckets);
        Assert.Equal(testCase.WaterBuckets, state.WaterResistances);
        Assert.Equal(testCase.Complications, state.Complications);
        Assert.Equal(testCase.PowerReserves, state.PowerReserves);
    }

    [Fact]
    public void GeneratedFilterCaseMatrix_SeedsAtLeastFiveHundredQueries()
    {
        Assert.True(GeneratedFilterCaseMatrix().Count() >= 500);
    }

    [Fact]
    public void ApplyRegexFilters_RecognisesCompoundSportwatch()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("sportwatch from vc", intent);

        Assert.Equal("sport", intent.Style);
    }

    [Fact]
    public async Task ParseQueryIntentForTestsAsync_SportwatchFromVc_DerivesStyleCollections()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var sport = new Collection { Id = 10, BrandId = 2, Brand = brand, Name = "Overseas", Slug = "vacheron-constantin-overseas", Style = "sport" };
        var dress = new Collection { Id = 20, BrandId = 2, Brand = brand, Name = "Patrimony", Slug = "vacheron-constantin-patrimony", Style = "dress" };

        context.Brands.Add(brand);
        context.Collections.AddRange(sport, dress);
        await context.SaveChangesAsync();

        var service = CreateService(context);

        var intent = await service.ParseQueryIntentForTestsAsync("sportwatch from vc");

        Assert.NotNull(intent);
        Assert.Equal(2, intent!.BrandId);
        Assert.Equal("sport", intent.Style);
        Assert.True(intent.CollectionsDerivedFromStyle);
        Assert.Equal(10, intent.CollectionId);
    }

    [Fact]
    public async Task ParseQueryIntentForTestsAsync_MultiBrandStyleQuery_DoesNotTreatBrandTokenAsCollection()
    {
        using var context = CreateContext();
        var vc = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var als = new Brand { Id = 5, Name = "A. Lange & Söhne", Slug = "a-lange-sohne" };
        var overseas = new Collection { Id = 10, BrandId = 2, Brand = vc, Name = "Overseas", Slug = "vacheron-constantin-overseas", Style = "sport" };
        var lange1 = new Collection { Id = 17, BrandId = 5, Brand = als, Name = "Lange 1", Slug = "a-lange-sohne-lange-1", Style = "dress" };

        context.Brands.AddRange(vc, als);
        context.Collections.AddRange(overseas, lange1);
        await context.SaveChangesAsync();

        var service = CreateService(context);

        var intent = await service.ParseQueryIntentForTestsAsync("i want some sport watch from A. Lange & Söhne and Vacheron Constantin");

        Assert.NotNull(intent);
        Assert.Null(intent!.BrandId);
        Assert.Equal([2, 5], intent.BrandIds.OrderBy(id => id).ToArray());
        Assert.Equal("sport", intent.Style);
        Assert.True(intent.CollectionsDerivedFromStyle);
        Assert.Equal(10, intent.CollectionId);
        Assert.Empty(intent.CollectionIds);
    }

    [Fact]
    public async Task TryDirectSqlSearchForTestsAsync_MultiBrandSportQuery_PrefersSportBrandCoverage()
    {
        using var context = CreateContext();
        var vc = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var als = new Brand { Id = 5, Name = "A. Lange & Söhne", Slug = "a-lange-sohne" };
        var overseas = new Collection { Id = 10, BrandId = 2, Brand = vc, Name = "Overseas", Slug = "vacheron-constantin-overseas", Style = "sport" };
        var lange1 = new Collection { Id = 17, BrandId = 5, Brand = als, Name = "Lange 1", Slug = "a-lange-sohne-lange-1", Style = "dress" };

        var vcWatch = new Watch
        {
            Id = 100,
            BrandId = 2,
            Brand = vc,
            CollectionId = 10,
            Collection = overseas,
            Name = "4520V/210R-B967",
            Slug = "vacheron-constantin-overseas-4520v-210r-b967",
            CurrentPrice = 111000m,
            Description = "Overseas sport watch"
        };
        var alsWatch = new Watch
        {
            Id = 200,
            BrandId = 5,
            Brand = als,
            CollectionId = 17,
            Collection = lange1,
            Name = "191.039",
            Slug = "a-lange-sohne-lange-1-191-039",
            CurrentPrice = 80000m,
            Description = "Lange 1 dress watch"
        };

        context.Brands.AddRange(vc, als);
        context.Collections.AddRange(overseas, lange1);
        context.Watches.AddRange(vcWatch, alsWatch);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var intent = await service.ParseQueryIntentForTestsAsync("i want some sport watch from A. Lange & Söhne and Vacheron Constantin");

        var result = await service.TryDirectSqlSearchForTestsAsync(
            "i want some sport watch from A. Lange & Söhne and Vacheron Constantin",
            intent,
            "test_direct");

        Assert.NotNull(result);
        Assert.NotEmpty(result!.Watches);
        Assert.Equal("vacheron-constantin-overseas-4520v-210r-b967", result.Watches[0].Slug);
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
    public void ApplyRegexFilters_ParsesApproximateTargetPriceBand()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("something for daily wear around 40k", intent);

        Assert.Equal(30_000m, intent.MinPrice);
        Assert.Equal(50_000m, intent.MaxPrice);
    }

    [Fact]
    public void ApplyRegexFilters_ParsesBudgetCap()
    {
        var intent = new QueryIntent();

        WatchFinderService.ApplyRegexFilters("sport watch budget 40k", intent);

        Assert.Null(intent.MinPrice);
        Assert.Equal(40_000m, intent.MaxPrice);
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
    public void IsLikelyReferenceQuery_RejectsDiscoveryQueriesThatOnlyContainBudgetDigits()
    {
        Assert.False(WatchFinderService.IsLikelyReferenceQuery("a ceramic moonphase reverso under 2k"));
    }

    [Theory]
    [InlineData("710BL")]
    [InlineData("BLRO")]
    [InlineData("126710")]
    public void IsLikelyReferenceFragment_MatchesShortReferenceFamilyTokens(string query)
    {
        Assert.True(WatchFinderService.IsLikelyReferenceFragment(query));
        Assert.True(WatchFinderService.HasWatchDomainSignal(query));
    }

    [Theory]
    [InlineData("breakfast")]
    [InlineData("sandwich")]
    [InlineData("wedding")]
    public void IsLikelyReferenceFragment_RejectsPlainWords(string query)
    {
        Assert.False(WatchFinderService.IsLikelyReferenceFragment(query));
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
    public void HasStrictCollectionIntent_ReturnsFalseForStyleDerivedCollections()
    {
        var intent = new QueryIntent
        {
            BrandId = 2,
            CollectionIds = [5, 7],
            CollectionsDerivedFromStyle = true,
            Style = "dress"
        };

        Assert.True(WatchFinderService.HasCollectionIntent(intent));
        Assert.False(WatchFinderService.HasStrictCollectionIntent(intent));
    }

    [Fact]
    public void ShouldApplyStyleSqlFilter_ReturnsTrueForGenericStyleQueries()
    {
        var intent = new QueryIntent { Style = "dress" };

        Assert.True(WatchFinderService.ShouldApplyStyleSqlFilter(intent));
    }

    [Fact]
    public void ShouldApplyStyleSqlFilter_ReturnsFalseWhenBrandIntentExists()
    {
        var intent = new QueryIntent { Style = "dress", BrandId = 2, MinPrice = 200_000m };

        Assert.False(WatchFinderService.ShouldApplyStyleSqlFilter(intent));
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
    public void DirectSqlScore_PrioritisesReferenceFragmentContainment()
    {
        var exactFamily = new Watch { Name = "M126710BLRO-0001", CurrentPrice = 20_100m, BrandId = 9 };
        var other = new Watch { Name = "M126500LN-0001", CurrentPrice = 28_200m, BrandId = 9 };

        var fragmentScore = WatchFinderService.DirectSqlScore("710BL", exactFamily, null, true);
        var otherScore = WatchFinderService.DirectSqlScore("710BL", other, null, true);

        Assert.True(fragmentScore > otherScore);
        Assert.True(fragmentScore >= 900);
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
