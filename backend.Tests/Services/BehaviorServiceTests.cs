using backend.Database;
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Tests.Services;

public class BehaviorServiceTests
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

    [Fact]
    public async Task FlushEventsAsync_DeduplicatesAgainstStoredEvents_InSameIdentityEntityTypeAndHour()
    {
        using var context = CreateContext();
        var service = new BehaviorService(context);
        var timestamp = new DateTime(2026, 4, 10, 10, 15, 0, DateTimeKind.Utc);

        var firstBatch = new List<BrowsingEventItemDto>
        {
            new()
            {
                EventType = "watch_view",
                EntityId = 10,
                EntityName = "Reverso Tribute",
                BrandId = 3,
                Timestamp = timestamp,
            }
        };

        var secondBatch = new List<BrowsingEventItemDto>
        {
            new()
            {
                EventType = "watch_view",
                EntityId = 10,
                EntityName = "Reverso Tribute",
                BrandId = 3,
                Timestamp = timestamp.AddMinutes(20),
            }
        };

        await service.FlushEventsAsync(null, "anon-1", firstBatch);
        await service.FlushEventsAsync(null, "anon-1", secondBatch);

        var stored = await context.UserBrowsingEvents.ToListAsync();
        Assert.Single(stored);
        Assert.Equal("anon-1", stored[0].AnonymousId);
        Assert.Null(stored[0].UserId);
    }

    [Fact]
    public async Task MergeAnonymousAsync_ReassignsOnlyMatchingAnonymousEvents()
    {
        using var context = CreateContext();
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                AnonymousId = "anon-1",
                UserId = null,
                EventType = "brand_view",
                EntityId = 1,
                EntityName = "Patek Philippe",
                Timestamp = DateTime.UtcNow,
            },
            new UserBrowsingEvent
            {
                AnonymousId = "anon-2",
                UserId = null,
                EventType = "collection_view",
                EntityId = 2,
                EntityName = "Nautilus",
                Timestamp = DateTime.UtcNow,
            },
            new UserBrowsingEvent
            {
                AnonymousId = "anon-1",
                UserId = 55,
                EventType = "search",
                EntityName = "blue dial",
                Timestamp = DateTime.UtcNow,
            });
        await context.SaveChangesAsync();

        var service = new BehaviorService(context);
        await service.MergeAnonymousAsync(42, "anon-1");

        var events = await context.UserBrowsingEvents.OrderBy(e => e.Id).ToListAsync();
        Assert.Equal(42, events[0].UserId);
        Assert.Null(events[1].UserId);
        Assert.Equal(55, events[2].UserId);
    }
}
