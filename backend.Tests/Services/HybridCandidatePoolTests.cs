// Tests for the concierge's fused candidate pool and the path label that reports it. The pool is
// what the reranker chooses from, so the order and the hard filters are pinned exactly.
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class HybridCandidatePoolTests
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
        foreach (var (id, price) in new[] { (1, 5_000m), (2, 6_000m), (3, 7_000m), (4, 90_000m) })
            context.Watches.Add(new Watch { Id = id, Name = $"W{id}", Slug = $"w{id}", BrandId = 1, CurrentPrice = price });
        context.SaveChanges();
        return context;
    }

    private static WatchFinderService CreateService(TourbillonContext context, ILexicalWatchSearch? lexical) =>
        new(
            new Mock<IHttpClientFactory>(MockBehavior.Strict).Object,
            new Mock<IDeterministicWatchSearchService>().Object,
            context,
            new WatchFilterMapper(),
            new QueryCacheService(context, NullLogger<QueryCacheService>.Instance),
            NullLogger<WatchFinderService>.Instance,
            Storage,
            lexical: lexical);

    private static List<Watch> Load(TourbillonContext context, params int[] ids) =>
        ids.Select(id => context.Watches.Single(w => w.Id == id)).ToList();

    [Fact]
    public async Task The_pool_fuses_both_rankings_and_keeps_the_lexical_side_inside_hard_filters()
    {
        using var context = SeededContext();
        var service = CreateService(context, new FixedLexicalSearch(3, 1, 4));

        var (pool, fused) = await service.FuseLexicalCandidatesAsync(
            "steel watch", new QueryIntent { MaxPrice = 10_000 }, Load(context, 1, 2));

        // 1 is in both lists; 3 is first in the lexical list only; 2 is second in the vector list
        // only; 4 is over budget and never enters the pool.
        Assert.True(fused);
        Assert.Equal(new[] { 1, 3, 2 }, pool.Select(w => w.Id));
    }

    [Fact]
    public async Task Nothing_lexical_leaves_the_vector_pool_untouched()
    {
        using var context = SeededContext();
        var vectorPool = Load(context, 2, 1);

        var (noHits, fusedNoHits) = await CreateService(context, new FixedLexicalSearch())
            .FuseLexicalCandidatesAsync("steel watch", null, vectorPool);
        var (allFiltered, fusedFiltered) = await CreateService(context, new FixedLexicalSearch(4))
            .FuseLexicalCandidatesAsync("steel watch", new QueryIntent { MaxPrice = 10_000 }, vectorPool);
        var (noIndex, fusedNoIndex) = await CreateService(context, lexical: null)
            .FuseLexicalCandidatesAsync("steel watch", null, vectorPool);

        Assert.False(fusedNoHits);
        Assert.False(fusedFiltered);
        Assert.False(fusedNoIndex);
        Assert.Same(vectorPool, noHits);
        Assert.Same(vectorPool, allFiltered);
        Assert.Same(vectorPool, noIndex);
    }

    [Fact]
    public void The_bm25_marker_does_not_disturb_the_widening_kinds()
    {
        Assert.Equal(new[] { "relevance" },
            WatchFinderService.GetWidenedSearchKinds("vector_llm_rerank+bm25+widened:relevance"));
        Assert.False(WatchFinderService.HasWidenedSearchPath("vector_llm_rerank+bm25"));
    }
}
