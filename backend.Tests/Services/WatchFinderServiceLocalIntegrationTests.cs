// What this service does: 
using backend.Database;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Npgsql;
using Pgvector.EntityFrameworkCore;

namespace backend.Tests.Services;

public class WatchFinderServiceLocalIntegrationTests
{
    private const string LocalConnection =
        "Host=localhost;Port=5432;Database=tourbillon;Username=tourbillon;Password=31012005";

    public static IEnumerable<object[]> DeterministicQueryCases()
    {
        yield return
        [
            "Omega Seamaster 300",
            "direct_sql_deterministic",
            true,
            new[] { 12 },
            new[] { 46 },
            Array.Empty<string>(),
            Array.Empty<string>()
        ];
        yield return
        [
            "Vacheron above 200k",
            "direct_sql_deterministic",
            true,
            new[] { 2 },
            Array.Empty<int>(),
            new[] { "Over $100k", "Price on Request" },
            Array.Empty<string>()
        ];
        yield return
        [
            "Vacheron Dress Watch 39 to 40mm Dial Above 200k",
            "direct_sql_deterministic",
            true,
            new[] { 2 },
            null,
            new[] { "Over $100k", "Price on Request" },
            new[] { "39mm", "40mm" }
        ];
        yield return
        [
            "Sport Watches Under 100k",
            "direct_sql_deterministic",
            true,
            Array.Empty<int>(),
            Array.Empty<int>(),
            new[] { "Under $5k", "$5k – $10k", "$10k – $25k", "$25k – $50k", "$50k – $100k", "Price on Request" },
            Array.Empty<string>()
        ];
        yield return
        [
            "100m water resistance under 50k",
            "direct_sql_deterministic",
            true,
            Array.Empty<int>(),
            Array.Empty<int>(),
            new[] { "Under $5k", "$5k – $10k", "$10k – $25k", "$25k – $50k", "Price on Request" },
            Array.Empty<string>()
        ];
        yield return
        [
            "40mm dress watch under 50k",
            "direct_sql_deterministic",
            true,
            Array.Empty<int>(),
            Array.Empty<int>(),
            new[] { "Under $5k", "$5k – $10k", "$10k – $25k", "$25k – $50k", "Price on Request" },
            new[] { "40mm" }
        ];
        yield return
        [
            "what's for breakfast?",
            "non_watch",
            false,
            Array.Empty<int>(),
            Array.Empty<int>(),
            Array.Empty<string>(),
            Array.Empty<string>()
        ];
    }

    public static IEnumerable<object[]> StructuredCatalogueQueries()
    {
        yield return ["Omega Seamaster 300"];
        yield return ["Patek Philippe Calatrava under 50k"];
        yield return ["Jaeger-LeCoultre Reverso manual winding"];
        yield return ["Audemars Piguet Royal Oak 39mm"];
        yield return ["diver watch 300m under 20k"];
    }

    private static async Task<TourbillonContext?> TryCreateContextAsync()
    {
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(LocalConnection);
        dataSourceBuilder.UseVector();
        var dataSource = dataSourceBuilder.Build();

        var options = new DbContextOptionsBuilder<TourbillonContext>()
            .UseNpgsql(dataSource, npgsqlOptions => npgsqlOptions.UseVector())
            .Options;

        var context = new TourbillonContext(options);
        if (await context.Database.CanConnectAsync())
            return context;

        await context.DisposeAsync();
        return null;
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

    [Theory]
    [MemberData(nameof(DeterministicQueryCases))]
    public async Task DeterministicRoutingCorpus_ReturnsExpectedSearchPathAndFilterState(
        string query,
        string expectedSearchPath,
        bool expectResults,
        int[] expectedBrandIds,
        int[]? expectedCollectionIds,
        string[] expectedPriceBuckets,
        string[] expectedDiameterBuckets)
    {
        await using var context = await TryCreateContextAsync();
        if (context == null) return;

        var service = CreateService(context);

        var result = await service.FindWatchesAsync(query);
        var filterState = WatchFinderService.BuildFilterStateForDiagnostics(result.QueryIntent);

        Assert.Equal(expectedSearchPath, result.SearchPath);
        Assert.Equal(expectResults, result.Watches.Count > 0);
        Assert.Equal(expectedBrandIds, filterState.BrandIds);
        if (expectedCollectionIds == null)
            Assert.NotEmpty(filterState.CollectionIds);
        else
            Assert.Equal(expectedCollectionIds, filterState.CollectionIds);
        Assert.Equal(expectedPriceBuckets, filterState.PriceBuckets);
        Assert.Equal(expectedDiameterBuckets, filterState.DiameterBuckets);
    }

    [Theory]
    [MemberData(nameof(StructuredCatalogueQueries))]
    public async Task StructuredCatalogueQueryCorpus_ReturnsStructuredWatchSearchResult(string query)
    {
        await using var context = await TryCreateContextAsync();
        if (context == null) return;

        var service = CreateService(context);

        var result = await service.FindWatchesAsync(query);

        Assert.NotEqual("non_watch", result.SearchPath);
        Assert.NotNull(result.QueryIntent);
        Assert.True(
            string.Equals(result.SearchPath, "direct_sql_deterministic", StringComparison.OrdinalIgnoreCase)
            || string.Equals(result.SearchPath, "direct_sql_deterministic_fallback", StringComparison.OrdinalIgnoreCase)
            || string.Equals(result.SearchPath, "vector_structured_skip_rerank", StringComparison.OrdinalIgnoreCase)
            || string.Equals(result.SearchPath, "vector", StringComparison.OrdinalIgnoreCase)
            || string.Equals(result.SearchPath, "vector_llm_candidate", StringComparison.OrdinalIgnoreCase),
            $"Unexpected search path '{result.SearchPath}' for query '{query}'.");
        Assert.True(
            result.Watches.Count > 0 || result.OtherCandidates.Count > 0,
            $"Expected at least one candidate for structured query '{query}', got none.");
    }
}
