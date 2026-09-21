// A cached concierge answer quotes prices and names, so any catalogue write has to retire it. The
// bump lives in the DbContext rather than in each endpoint, and these tests hold that line: a watch
// edited anywhere invalidates, and writes that are not catalogue writes do not.
using backend.Database;
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class CatalogueCacheInvalidationTests
{
    private static TourbillonContext CreateContext(IRedisService redis) => TestContextFactory.CreateWithRedis(redis);

    [Fact]
    public async Task EditingAWatchRetiresTheCachedAnswers()
    {
        var redis = new FakeRedis();
        using var context = CreateContext(redis);
        var watch = new Watch { Id = 1, Name = "5711/1A-010", Slug = "patek-philippe-nautilus-5711-1a-010", CurrentPrice = 100000m };
        context.Watches.Add(watch);
        await context.SaveChangesAsync();
        var afterInsert = await redis.GetCounterAsync(ChatCacheKeys.ResponseVersion);

        watch.CurrentPrice = 120000m;
        await context.SaveChangesAsync();

        Assert.Equal(1, afterInsert);
        Assert.Equal(2, await redis.GetCounterAsync(ChatCacheKeys.ResponseVersion));
    }

    [Fact]
    public async Task EditingABrandOrCollectionRetiresThemToo()
    {
        var redis = new FakeRedis();
        using var context = CreateContext(redis);
        context.Brands.Add(new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" });
        context.Collections.Add(new Collection { Id = 1, BrandId = 1, Name = "Nautilus", Slug = "patek-philippe-nautilus" });
        await context.SaveChangesAsync();

        Assert.Equal(1, await redis.GetCounterAsync(ChatCacheKeys.ResponseVersion));
    }

    [Fact]
    public async Task AWriteThatIsNotTheCatalogueLeavesTheCacheAlone()
    {
        var redis = new FakeRedis();
        using var context = CreateContext(redis);
        context.UserBrowsingEvents.Add(new UserBrowsingEvent { UserId = 7, EventType = "view", Timestamp = DateTime.UtcNow });
        await context.SaveChangesAsync();

        Assert.Null(await redis.GetCounterAsync(ChatCacheKeys.ResponseVersion));
    }
}
