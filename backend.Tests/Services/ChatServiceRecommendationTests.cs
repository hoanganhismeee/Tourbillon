// Recommendation-path tests for ChatService.
// Broad discovery requests should surface up to five in-store matches by default.
using System.Net;
using System.Text;
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class ChatServiceRecommendationTests
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

    private sealed class FakeRedis : IRedisService
    {
        private readonly Dictionary<string, string> _store = new();

        public Task<long> IncrementAsync(string key, TimeSpan? ttlOnCreate = null)
        {
            _store.TryGetValue(key, out var current);
            var next = (long.TryParse(current, out var parsed) ? parsed : 0) + 1;
            _store[key] = next.ToString();
            return Task.FromResult(next);
        }

        public Task<long?> GetCounterAsync(string key)
        {
            if (_store.TryGetValue(key, out var current) && long.TryParse(current, out var parsed))
                return Task.FromResult<long?>(parsed);
            return Task.FromResult<long?>(null);
        }

        public Task<string?> GetStringAsync(string key)
        {
            _store.TryGetValue(key, out var value);
            return Task.FromResult(value);
        }

        public Task SetStringAsync(string key, string value, TimeSpan? expiry = null)
        {
            _store[key] = value;
            return Task.CompletedTask;
        }

        public Task<bool> RemoveAsync(string key) => Task.FromResult(_store.Remove(key));

        public Task SetHashFieldAsync(string key, string field, string value, TimeSpan? expiry = null)
        {
            _store[$"{key}:{field}"] = value;
            return Task.CompletedTask;
        }

        public Task<string?> GetHashFieldAsync(string key, string field)
        {
            _store.TryGetValue($"{key}:{field}", out var value);
            return Task.FromResult(value);
        }

        public Task<bool> RemoveHashAsync(string key)
        {
            var removed = false;
            foreach (var keyToRemove in _store.Keys.Where(k => k.StartsWith($"{key}:", StringComparison.Ordinal)).ToList())
                removed |= _store.Remove(keyToRemove);
            return Task.FromResult(removed);
        }

        public Task RefreshExpiryAsync(string key, TimeSpan expiry) => Task.CompletedTask;
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(_responder(request));
        }
    }

    private static TourbillonContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TourbillonContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TestTourbillonContext(options);
    }

    private static IConfiguration CreateConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ChatSettings:DisableLimitInDev"] = "true",
                ["ChatSettings:DailyLimit"] = "5",
            })
            .Build();

    private static ChatService CreateService(
        TourbillonContext context,
        Mock<IWatchFinderService> watchFinderMock,
        RecordingHandler handler)
    {
        var httpFactory = new Mock<IHttpClientFactory>(MockBehavior.Strict);
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5000") };
        httpFactory.Setup(f => f.CreateClient("ai-service")).Returns(client);

        return new ChatService(
            httpFactory.Object,
            context,
            new FakeRedis(),
            CreateConfig(),
            watchFinderMock.Object,
            NullLogger<ChatService>.Instance);
    }

    private static WatchDto ToDto(Watch watch) => WatchDto.FromWatch(watch);

    [Fact]
    public async Task HandleMessageAsync_BroadRecommendation_ShowsUpToFiveMatchedProductsByDefault()
    {
        using var context = CreateContext();

        var brand = new Brand { Id = 1, Name = "Omega", Slug = "omega" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Seamaster", Slug = "seamaster" };
        context.Brands.Add(brand);
        context.Collections.Add(collection);

        var watches = Enumerable.Range(1, 6)
            .Select(i => new Watch
            {
                Id = i,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = collection,
                Name = $"220.{i:000}",
                Slug = $"omega-seamaster-220-{i:000}",
                Description = "Omega Seamaster",
                CurrentPrice = 6000m + i
            })
            .ToList();

        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("Recommend me a versatile Omega"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = watches.Select(ToDto).ToList(),
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Here are five strong Tourbillon matches from [Omega](/brands/omega).\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Recommend me a versatile Omega", null, "127.0.0.1");

        Assert.Equal(5, result.WatchCards.Count);
        Assert.Equal(watches.Take(5).Select(w => w.Slug), result.WatchCards.Select(w => w.Slug));
        Assert.Contains(result.Actions, a => a.Type == "search" && a.Query == "Omega Seamaster versatile");
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_MessyRecommendation_RewritesSearchActionIntoCanonicalTerms()
    {
        using var context = CreateContext();

        var brand = new Brand { Id = 1, Name = "Jaeger-LeCoultre", Slug = "jaeger-lecoultre" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Reverso", Slug = "reverso" };
        context.Brands.Add(brand);
        context.Collections.Add(collection);

        var watches = new[]
        {
            new Watch
            {
                Id = 1,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = collection,
                Name = "Q397846J",
                Slug = "jaeger-lecoultre-reverso-q397846j",
                Description = "Jaeger-LeCoultre Reverso",
                CurrentPrice = 11400m
            },
            new Watch
            {
                Id = 2,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = collection,
                Name = "Q2458422",
                Slug = "jaeger-lecoultre-reverso-q2458422",
                Description = "Jaeger-LeCoultre Reverso",
                CurrentPrice = 15600m
            }
        };

        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("yo, suggest me a couple of reversos for me under 50k"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = watches.Select(ToDto).ToList(),
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Jaeger-LeCoultre Reverso Q397846J](/watches/jaeger-lecoultre-reverso-q397846j) is a refined starting point.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "yo, suggest me a couple of reversos for me under 50k", null, "127.0.0.1");

        Assert.Contains(result.Actions, action => action.Type == "search" && action.Query == "Jaeger-LeCoultre Reverso under 50k");
        Assert.Equal(1, handler.CallCount);
    }
}
