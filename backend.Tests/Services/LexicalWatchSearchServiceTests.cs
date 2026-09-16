// Tests for the singleton that owns the BM25 index. The index is cached between requests, so the
// test pins the documented trade-off: edits stay invisible until the index lifetime passes.
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Services;

public class LexicalWatchSearchServiceTests
{
    private sealed class ManualClock(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _now = start;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now += by;
    }

    [Fact]
    public async Task The_index_is_reused_until_its_lifetime_passes()
    {
        var options = new DbContextOptionsBuilder<TourbillonContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using (var seed = new TestTourbillonContext(options))
        {
            seed.Brands.Add(new Brand { Id = 1, Name = "Omega", Slug = "omega" });
            seed.Watches.Add(new Watch { Id = 1, Name = "Speedmaster", Slug = "speedmaster", BrandId = 1 });
            await seed.SaveChangesAsync();
        }

        var services = new ServiceCollection();
        services.AddScoped<TourbillonContext>(_ => new TestTourbillonContext(options));
        await using var provider = services.BuildServiceProvider();
        var clock = new ManualClock(DateTimeOffset.Parse("2026-09-16T00:00:00Z"));
        var search = new LexicalWatchSearchService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<LexicalWatchSearchService>.Instance,
            clock);

        Assert.Equal(new[] { 1 }, (await search.SearchAsync("speedmaster", 10)).Select(h => h.Id));

        await using (var edit = new TestTourbillonContext(options))
        {
            edit.Watches.Add(new Watch { Id = 2, Name = "Seamaster", Slug = "seamaster", BrandId = 1 });
            await edit.SaveChangesAsync();
        }

        Assert.Empty(await search.SearchAsync("seamaster", 10));

        clock.Advance(LexicalWatchSearchService.IndexLifetime + TimeSpan.FromSeconds(1));
        Assert.Equal(new[] { 2 }, (await search.SearchAsync("seamaster", 10)).Select(h => h.Id));
    }
}
