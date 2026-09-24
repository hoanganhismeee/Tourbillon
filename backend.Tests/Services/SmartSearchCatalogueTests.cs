// Tests for the model-free Smart Search path. Strict mocks on the HTTP factory and the classifier
// make any model call fail the test, which is the property this path exists to guarantee.
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class SmartSearchCatalogueTests
{
    private static readonly IStorageService Storage = new TestStorageService();

    private sealed class FixedLexicalSearch(params int[] ids) : ILexicalWatchSearch
    {
        public Task<IReadOnlyList<Bm25Hit>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Bm25Hit>>(ids.Select((id, i) => new Bm25Hit(id, 10.0 - i)).Take(limit).ToList());
    }

    private static TourbillonContext SeededContext()
    {
        var options = new DbContextOptionsBuilder<TourbillonContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new TestTourbillonContext(options);
        context.Brands.Add(new Brand { Id = 1, Name = "Omega", Slug = "omega" });
        context.Watches.AddRange(
            new Watch { Id = 1, Name = "A1", Slug = "a1", BrandId = 1, CurrentPrice = 8_000 },
            new Watch { Id = 2, Name = "A2", Slug = "a2", BrandId = 1, CurrentPrice = 0 },
            new Watch { Id = 3, Name = "A3", Slug = "a3", BrandId = 1, CurrentPrice = 50_000 });
        context.SaveChanges();
        return context;
    }

    private static WatchFinderService CreateService(TourbillonContext context, ILexicalWatchSearch? lexical)
    {
        // Strict: any attempt to create an HTTP client or classify a query throws.
        var httpFactory = new Mock<IHttpClientFactory>(MockBehavior.Strict);
        var classifier = new Mock<IIntentClassifier>(MockBehavior.Strict);
        var deterministic = new Mock<IDeterministicWatchSearchService>();
        return new WatchFinderService(
            httpFactory.Object,
            deterministic.Object,
            context,
            new WatchFilterMapper(),
            new QueryCacheService(context, NullLogger<QueryCacheService>.Instance),
            NullLogger<WatchFinderService>.Instance,
            Storage,
            classifier: classifier.Object,
            lexical: lexical);
    }

    [Fact]
    public async Task An_off_topic_query_returns_nothing_without_asking_a_model()
    {
        using var context = SeededContext();
        var service = CreateService(context, new FixedLexicalSearch(1, 2, 3));

        var result = await service.SearchCatalogueAsync("what's the weather in London");

        Assert.Empty(result.Watches);
        Assert.Equal("no_watch_signal", result.SearchPath);
    }

    [Fact]
    public async Task An_unparsed_watch_query_is_ranked_by_bm25()
    {
        using var context = SeededContext();
        var service = CreateService(context, new FixedLexicalSearch(3, 1, 2));

        var result = await service.SearchCatalogueAsync("a watch with lovely hand finishing");

        Assert.Equal("bm25_fallback", result.SearchPath);
        Assert.Equal(new[] { 3, 1, 2 }, result.Watches.Select(w => w.Id));
    }

    [Fact]
    public async Task Hard_filters_apply_to_the_bm25_ranking_and_drop_price_on_request()
    {
        using var context = SeededContext();
        var service = CreateService(context, new FixedLexicalSearch(3, 1, 2));

        var result = await service.SearchCatalogueAsync("a watch with lovely finishing under 10k");

        // 3 is over budget. 2 is Price on Request: it used to pass every budget, which is how a
        // benchmark brief asking for something under five thousand was answered with a tourbillon
        // whose price is on request. An unknown price cannot satisfy a stated one.
        Assert.Equal(new[] { 1 }, result.Watches.Select(w => w.Id));
        Assert.Equal(10_000m, result.QueryIntent?.MaxPrice);
    }

    [Fact]
    public async Task A_stated_exclusion_drops_the_watches_that_break_it()
    {
        using var context = SeededContext();
        // 1 has a date, 3 does not; both rank above the budget-less 2.
        context.Watches.Single(w => w.Id == 1).Specs = "{\"movement\":{\"functions\":[\"Hours\",\"Instantaneous date\"]}}";
        context.Watches.Single(w => w.Id == 3).Specs = "{\"movement\":{\"functions\":[\"Hours\",\"Minutes\"]}}";
        context.SaveChanges();
        var service = CreateService(context, new FixedLexicalSearch(1, 3));

        var result = await service.SearchCatalogueAsync("I hate date windows");

        // Complications live in the Specs JSON, so no SQL filter reaches them: before this, the
        // benchmark brief was answered with five dated watches.
        Assert.Equal(new[] { 3 }, result.Watches.Select(w => w.Id));
    }

    [Fact]
    public async Task No_lexical_match_is_an_empty_result_not_an_error()
    {
        using var context = SeededContext();
        var service = CreateService(context, new FixedLexicalSearch());

        var result = await service.SearchCatalogueAsync("a watch with lovely hand finishing");

        Assert.Empty(result.Watches);
        Assert.Equal("bm25_no_match", result.SearchPath);
    }
}
