// Unit tests for ChatService.
// These cover the deterministic routing paths that should avoid unnecessary ai-service calls.
using System.Net;
using System.Text;
using System.Text.Json;
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class ChatServiceTests
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

    private static IConfiguration CreateConfig(bool disableLimit = true, int dailyLimit = 5) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ChatSettings:DisableLimitInDev"] = disableLimit ? "true" : "false",
                ["ChatSettings:DailyLimit"] = dailyLimit.ToString(),
            })
            .Build();

    private static WatchDto ToDto(Watch watch) => WatchDto.FromWatch(watch);

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
        public List<string> RequestBodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            if (request.Content != null)
                RequestBodies.Add(await request.Content.ReadAsStringAsync(cancellationToken));
            return _responder(request);
        }
    }

    private static ChatService CreateService(
        TourbillonContext context,
        Mock<IWatchFinderService> watchFinderMock,
        RecordingHandler? handler = null,
        IRedisService? redis = null,
        IConfiguration? config = null)
    {
        var httpFactory = new Mock<IHttpClientFactory>(MockBehavior.Strict);
        if (handler != null)
        {
            var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5000") };
            httpFactory.Setup(f => f.CreateClient("ai-service")).Returns(client);
        }

        return new ChatService(
            httpFactory.Object,
            context,
            redis ?? new FakeRedis(),
            config ?? CreateConfig(),
            watchFinderMock.Object,
            NullLogger<ChatService>.Instance);
    }

    private static void AssertBrowseCatalogueAction(ChatApiResponse result)
    {
        var action = Assert.Single(result.Actions);
        Assert.Equal("search", action.Type);
        Assert.Equal("luxury watches", action.Query);
        Assert.Equal("Browse the catalogue", action.Label);
    }

    [Fact]
    public async Task HandleMessageAsync_RefusesUnrelatedRequest_WithoutCallingSearchOrAi()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "Write me a sales CV", null, "127.0.0.1");

        Assert.Contains("rephrase", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        Assert.Empty(result.WatchCards);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_RefusesAbuse_WithoutCallingSearchOrAi()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "fuck you", null, "127.0.0.1");

        Assert.Contains("Tourbillon watches", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        Assert.Empty(result.WatchCards);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_Greeting_ReturnsConciergeIntro_WithoutCallingSearchOrAi()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "yo", null, "127.0.0.1");

        Assert.Contains("Tourbillon can help compare watches", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        Assert.Empty(result.WatchCards);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_CursorCommand_ReturnsSetCursorAction_WithoutSearch()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "change the cursor to tourbillon", null, "127.0.0.1");

        Assert.Contains("cursor", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Single(result.Actions);
        Assert.Equal("set_cursor", result.Actions[0].Type);
        Assert.Equal("tourbillon", result.Actions[0].Cursor);
        Assert.Empty(result.WatchCards);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_RateLimitedProductionRequest_ReturnsQuotaMessage()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var redis = new FakeRedis();
        await redis.SetStringAsync("chat_rl:127.0.0.1", "5");
        var service = CreateService(
            context,
            watchFinder,
            redis: redis,
            config: CreateConfig(disableLimit: false, dailyLimit: 5));

        var result = await service.HandleMessageAsync("session-1", "tell me about reverso", null, "127.0.0.1");

        Assert.True(result.RateLimited);
        Assert.Equal(5, result.DailyUsed);
        Assert.Equal(5, result.DailyLimit);
        Assert.Contains("daily concierge quota of 5 messages", result.Message, StringComparison.OrdinalIgnoreCase);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_ReturnsDirectWatchLink_ForHighConfidenceExactMatch()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Nautilus", Slug = "nautilus" };
        var watch = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "5711/1A-010",
            Slug = "patek-philippe-nautilus-5711-1a-010",
            Description = "Patek Philippe Nautilus",
            CurrentPrice = 35000m,
            Image = "PP5711.png"
        };
        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.Add(watch);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("5711/1A-010"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(watch)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var service = CreateService(context, watchFinder);
        var result = await service.HandleMessageAsync("session-1", "5711/1A-010", null, "127.0.0.1");

        Assert.Contains("/watches/patek-philippe-nautilus-5711-1a-010", result.Message);
        Assert.Single(result.WatchCards);
        Assert.Equal("patek-philippe-nautilus-5711-1a-010", result.WatchCards[0].Slug);
        Assert.DoesNotContain(result.Actions, a => a.Type is "search" or "compare");
        watchFinder.Verify(f => f.FindWatchesAsync("5711/1A-010"), Times.Once);
    }

    [Fact]
    public async Task HandleMessageAsync_WrappedExactWatchRequest_StillResolvesTheWatch()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Nautilus", Slug = "nautilus" };
        var watch = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "5711/1A-010",
            Slug = "patek-philippe-nautilus-5711-1a-010",
            Description = "Patek Philippe Nautilus",
            CurrentPrice = 35000m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.Add(watch);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("5711/1A-010"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(watch)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var service = CreateService(context, watchFinder);
        var result = await service.HandleMessageAsync("session-1", "the watch named 5711/1A-010", null, "127.0.0.1");

        Assert.Contains("/watches/patek-philippe-nautilus-5711-1a-010", result.Message);
        Assert.Single(result.WatchCards);
        Assert.Equal("patek-philippe-nautilus-5711-1a-010", result.WatchCards[0].Slug);
        watchFinder.Verify(f => f.FindWatchesAsync("5711/1A-010"), Times.Once);
    }

    [Fact]
    public async Task HandleMessageAsync_WatchNamedFollowUp_UsesStoredCanonicalEntityContext()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Historiques", Slug = "historiques" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "4200H/222A-B934 222",
            Slug = "vacheron-constantin-historiques-4200h-222a-b934-222",
            Description = "Vacheron Constantin Historiques",
            CurrentPrice = 0m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "4200H/222J-B935 222",
            Slug = "vacheron-constantin-historiques-4200h-222j-b935-222",
            Description = "Vacheron Constantin Historiques",
            CurrentPrice = 0m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("222"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Tourbillon stayed anchored to the 222 results.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        await service.HandleMessageAsync("session-1", "introduce me the 222", null, "127.0.0.1");
        var followUp = await service.HandleMessageAsync("session-1", "the watch named 222", null, "127.0.0.1");

        Assert.Equal(2, followUp.WatchCards.Count);
        Assert.All(followUp.WatchCards, card => Assert.Contains("222", card.Name, StringComparison.OrdinalIgnoreCase));
        Assert.True(handler.CallCount >= 1);
        watchFinder.Verify(f => f.FindWatchesAsync("222"), Times.Once);
    }

    [Fact]
    public async Task HandleMessageAsync_ReturnsCompareAction_ForResolvedSpecificWatches()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var otherBrand = new Brand { Id = 2, Name = "Audemars Piguet", Slug = "audemars-piguet" };
        var nautilus = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Nautilus", Slug = "nautilus" };
        var royalOak = new Collection { Id = 20, BrandId = 2, Brand = otherBrand, Name = "Royal Oak", Slug = "royal-oak" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = nautilus,
            Name = "5711/1A-010",
            Slug = "patek-philippe-nautilus-5711-1a-010",
            Description = "Patek Philippe Nautilus",
            CurrentPrice = 35000m
        };
        var second = new Watch
        {
            Id = 200,
            BrandId = 2,
            Brand = otherBrand,
            CollectionId = 20,
            Collection = royalOak,
            Name = "16202ST",
            Slug = "audemars-piguet-royal-oak-16202st",
            Description = "Audemars Piguet Royal Oak",
            CurrentPrice = 42000m
        };
        context.Brands.AddRange(brand, otherBrand);
        context.Collections.AddRange(nautilus, royalOak);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("5711/1A-010"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });
        watchFinder.Setup(f => f.FindWatchesAsync("16202ST"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(second)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var service = CreateService(context, watchFinder);
        var result = await service.HandleMessageAsync("session-1", "Compare 5711/1A-010 vs 16202ST", null, "127.0.0.1");

        var compareAction = Assert.Single(result.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(
            ["patek-philippe-nautilus-5711-1a-010", "audemars-piguet-royal-oak-16202st"],
            compareAction.Slugs);
        Assert.Equal(2, result.WatchCards.Count);
    }

    [Fact]
    public async Task HandleMessageAsync_BrandInfoQueryCallsAi_WithoutWebSearchFlag()
    {
        using var context = CreateContext();
        var brand = new Brand
        {
            Id = 2,
            Name = "Vacheron Constantin",
            Slug = "vacheron-constantin",
            Description = "Historic Geneva maison.",
            Summary = "Known for elegant finishing."
        };
        context.Brands.Add(brand);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"[Vacheron Constantin](/brands/vacheron-constantin) is one of Tourbillon's key maisons.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Tell me about Vacheron Constantin", null, "127.0.0.1");

        Assert.Equal(1, handler.CallCount);
        Assert.Contains("Vacheron Constantin", handler.RequestBodies[0]);
        Assert.DoesNotContain("enableWebSearch", handler.RequestBodies[0], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("/brands/vacheron-constantin", result.Message);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_CollectionGuidanceQuery_DoesNotEmitSearchAction()
    {
        using var context = CreateContext();
        var brand = new Brand
        {
            Id = 1,
            Name = "Jaeger-LeCoultre",
            Slug = "jaeger-lecoultre",
            Description = "Known for elegant mechanical watchmaking."
        };
        var collection = new Collection
        {
            Id = 10,
            BrandId = 1,
            Brand = brand,
            Name = "Reverso",
            Slug = "reverso",
            Description = "Art Deco icon with a reversible case."
        };
        var watch = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q397846J",
            Slug = "jaeger-lecoultre-reverso-q397846j",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 11400m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.Add(watch);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Reverso](/collections/reverso) is a timeless Jaeger-LeCoultre line.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Tell me about Reverso", null, "127.0.0.1");

        Assert.DoesNotContain(result.Actions, a => a.Type == "search");
        Assert.Contains("/collections/reverso", result.Message);
        Assert.Equal(1, handler.CallCount);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_CollectionStyleQuestion_UsesEntityInfoWithoutSearchAction()
    {
        using var context = CreateContext();
        var brand = new Brand
        {
            Id = 1,
            Name = "Jaeger-LeCoultre",
            Slug = "jaeger-lecoultre",
            Description = "Known for elegant mechanical watchmaking."
        };
        var collection = new Collection
        {
            Id = 10,
            BrandId = 1,
            Brand = brand,
            Name = "Reverso",
            Slug = "reverso",
            Description = "Art Deco icon with a reversible case."
        };
        var watch = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q397846J",
            Slug = "jaeger-lecoultre-reverso-q397846j",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 11400m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.Add(watch);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Reverso](/collections/reverso) is a strong everyday line from Jaeger-LeCoultre.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "should i wear reverso?", null, "127.0.0.1");

        Assert.DoesNotContain(result.Actions, a => a.Type == "search");
        Assert.Contains("/collections/reverso", result.Message);
        Assert.Equal(1, handler.CallCount);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_DiscoveryQueryReturnsSearchAction()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Rolex", Slug = "rolex" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Datejust", Slug = "datejust" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "126234",
            Slug = "rolex-datejust-126234",
            Description = "Rolex Datejust",
            CurrentPrice = 12000m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "126200",
            Slug = "rolex-datejust-126200",
            Description = "Rolex Datejust",
            CurrentPrice = 9000m
        };
        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("Find me a slim steel dress watch under 15k"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"[Rolex Datejust 126234](/watches/rolex-datejust-126234) is a strong Tourbillon match.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Find me a slim steel dress watch under 15k", null, "127.0.0.1");

        Assert.Contains(result.Actions, a => a.Type == "search" && a.Query == "Rolex Datejust slim steel dress watch under 15k");
        Assert.NotEmpty(result.WatchCards);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_DiscoveryQueryPrefersAiDesignedSearchAction()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Jaeger-LeCoultre", Slug = "jaeger-lecoultre" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Reverso", Slug = "reverso" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q397846J",
            Slug = "jaeger-lecoultre-reverso-q397846j",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 0m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q389257J",
            Slug = "jaeger-lecoultre-reverso-q389257j",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 0m
        };
        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("yo, suggest me some reversos"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Jaeger-LeCoultre Reverso Q397846J](/watches/jaeger-lecoultre-reverso-q397846j) is a strong match.\",\"actions\":[{\"type\":\"search\",\"query\":\"Jaeger-LeCoultre Reverso pink gold\",\"label\":\"Open Smart Search\"}]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "yo, suggest me some reversos", null, "127.0.0.1");

        var searchActions = result.Actions.Where(a => a.Type == "search").ToList();
        Assert.Single(searchActions);
        Assert.Equal("Jaeger-LeCoultre Reverso", searchActions[0].Query);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_NonWatchSearchPath_ReturnsSpecialistRefusal()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("watch podcast recommendations"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [],
                OtherCandidates = [],
                SearchPath = "non_watch"
            });

        var service = CreateService(context, watchFinder);
        var result = await service.HandleMessageAsync("session-1", "watch podcast recommendations", null, "127.0.0.1");

        Assert.Contains("rephrase", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        Assert.Empty(result.WatchCards);
        watchFinder.Verify(f => f.FindWatchesAsync("watch podcast recommendations"), Times.Once);
    }

    [Fact]
    public async Task HandleMessageAsync_NoCloseCatalogueMatch_RoutesToAiWithHelpfulContext()
    {
        // When the watch finder returns 0 results, the concierge now routes to AI so it can
        // give a helpful "try narrowing the brief" response instead of a dead-end refusal.
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        watchFinder.Setup(f => f.FindWatchesAsync("show me a ceramic moonphase reverso under 2k"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [],
                OtherCandidates = [],
                SearchPath = "vector"
            });
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"No exact match for a ceramic moonphase Reverso under 2k. Try a different reference or adjust your price range.\",\"actions\":[]}",
                Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "show me a ceramic moonphase reverso under 2k", null, "127.0.0.1");

        Assert.Contains("reference", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        Assert.Empty(result.WatchCards);
        watchFinder.Verify(f => f.FindWatchesAsync("show me a ceramic moonphase reverso under 2k"), Times.Once);
        watchFinder.VerifyNoOtherCalls();
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_NonAsciiOutOfScope_RoutesToAiWithLanguageHint()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Xin chao. Tourbillon chi ho tro dong ho va bo suu tap.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "máy uế hiểu nói gì không", null, "127.0.0.1");

        Assert.Equal(1, handler.CallCount);
        Assert.Contains("non-English language", handler.RequestBodies[0], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Xin chao", result.Message, StringComparison.OrdinalIgnoreCase);
        AssertBrowseCatalogueAction(result);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DiscoveryResponse_HasCompareChip_AndBrandNavigateChip()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Rolex", Slug = "rolex" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Datejust", Slug = "datejust" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "126234",
            Slug = "rolex-datejust-126234",
            Description = "Rolex Datejust",
            CurrentPrice = 12000m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "126200",
            Slug = "rolex-datejust-126200",
            Description = "Rolex Datejust",
            CurrentPrice = 9000m
        };
        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("Find me a slim steel dress watch under 15k"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Rolex Datejust 126234](/watches/rolex-datejust-126234) is a strong Tourbillon match.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Find me a slim steel dress watch under 15k", null, "127.0.0.1");

        Assert.Contains(result.Actions, a => a.Type == "compare"
            && a.Slugs != null
            && a.Slugs.SequenceEqual(["rolex-datejust-126234", "rolex-datejust-126200"]));
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/rolex");
    }

    [Fact]
    public async Task EntityInfoResponse_NoCompareChip_HasBrandNavigateChip()
    {
        using var context = CreateContext();
        var brand = new Brand
        {
            Id = 1,
            Name = "Vacheron Constantin",
            Slug = "vacheron-constantin",
            Description = "Historic Geneva maison."
        };
        var collection = new Collection
        {
            Id = 10,
            BrandId = 1,
            Brand = brand,
            Name = "Overseas",
            Slug = "overseas",
            Description = "Sport-luxury travel collection."
        };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "4520V/210A-B128",
            Slug = "vacheron-constantin-overseas-4520v-210a-b128",
            Description = "Vacheron Constantin Overseas",
            CurrentPrice = 38000m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "7920V/210A-B334",
            Slug = "vacheron-constantin-overseas-7920v-210a-b334",
            Description = "Vacheron Constantin Overseas",
            CurrentPrice = 41000m
        };
        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Overseas](/collections/overseas) is the modern sport-luxury line from Vacheron Constantin.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "tell me about the Overseas", null, "127.0.0.1");

        Assert.DoesNotContain(result.Actions, a => a.Type == "compare");
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/vacheron-constantin");
    }

    [Fact]
    public async Task CompareResponse_NoExtraCompareChip_HasBrandChipsPerBrand()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var ap = new Brand { Id = 2, Name = "Audemars Piguet", Slug = "audemars-piguet" };
        var nautilus = new Collection { Id = 10, BrandId = 1, Brand = patek, Name = "Nautilus", Slug = "nautilus" };
        var royalOak = new Collection { Id = 20, BrandId = 2, Brand = ap, Name = "Royal Oak", Slug = "royal-oak" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = patek,
            CollectionId = 10,
            Collection = nautilus,
            Name = "5711/1A-010",
            Slug = "patek-philippe-nautilus-5711-1a-010",
            Description = "Patek Philippe Nautilus",
            CurrentPrice = 35000m
        };
        var second = new Watch
        {
            Id = 200,
            BrandId = 2,
            Brand = ap,
            CollectionId = 20,
            Collection = royalOak,
            Name = "16202ST",
            Slug = "audemars-piguet-royal-oak-16202st",
            Description = "Audemars Piguet Royal Oak",
            CurrentPrice = 33000m
        };
        context.Brands.AddRange(patek, ap);
        context.Collections.AddRange(nautilus, royalOak);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("5711/1A-010"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });
        watchFinder.Setup(f => f.FindWatchesAsync("16202ST"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(second)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var service = CreateService(context, watchFinder);
        var result = await service.HandleMessageAsync("session-1", "Compare 5711/1A-010 vs 16202ST", null, "127.0.0.1");

        Assert.Single(result.Actions.Where(a => a.Type == "compare"));
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/patek-philippe");
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/audemars-piguet");
    }

    [Fact]
    public async Task RefusalResponse_HasFallbackDiscoveryChip()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "Write me a sales CV", null, "127.0.0.1");

        AssertBrowseCatalogueAction(result);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GreetingResponse_HasFallbackDiscoveryChip()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "hi", null, "127.0.0.1");

        AssertBrowseCatalogueAction(result);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_CompareByRelativeCardOrder_UsesPreviousChatCards()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var overseas = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Overseas", Slug = "overseas" };
        var historiques = new Collection { Id = 20, BrandId = 1, Brand = brand, Name = "Historiques", Slug = "historiques" };

        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = overseas,
            Name = "4200H/222A-B934",
            Slug = "vacheron-constantin-overseas-4200h-222a-b934",
            Description = "Vacheron Constantin 222",
            CurrentPrice = 55500m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 20,
            Collection = historiques,
            Name = "4200H/222J-B935",
            Slug = "vacheron-constantin-historiques-4200h-222j-b935",
            Description = "Vacheron Constantin Historiques",
            CurrentPrice = 131000m
        };
        var third = new Watch
        {
            Id = 102,
            BrandId = 1,
            Brand = brand,
            CollectionId = 20,
            Collection = historiques,
            Name = "1100S/000R-B430",
            Slug = "vacheron-constantin-historiques-1100s-000r-b430",
            Description = "Vacheron Constantin Historiques",
            CurrentPrice = 60000m
        };

        context.Brands.Add(brand);
        context.Collections.AddRange(overseas, historiques);
        context.Watches.AddRange(first, second, third);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("show me some vacheron options"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second), ToDto(third)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"[Vacheron Constantin](/brands/vacheron-constantin) has a few strong matches here.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var discovery = await service.HandleMessageAsync("session-1", "show me some vacheron options", null, "127.0.0.1");
        Assert.Equal(3, discovery.WatchCards.Count);

        var compare = await service.HandleMessageAsync("session-1", "compare the first one and third one", null, "127.0.0.1");

        var compareAction1 = Assert.Single(compare.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(
            ["vacheron-constantin-overseas-4200h-222a-b934", "vacheron-constantin-historiques-1100s-000r-b430"],
            compareAction1.Slugs);
        Assert.Equal(2, compare.WatchCards.Count);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_CompareFirstTwoForMe_UsesPreviousChatCards()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Jaeger-LeCoultre", Slug = "jaeger-lecoultre" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Reverso", Slug = "reverso" };

        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q397846J",
            Slug = "jaeger-lecoultre-reverso-q397846j",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 11400m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q2458422",
            Slug = "jaeger-lecoultre-reverso-q2458422",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 15600m
        };
        var third = new Watch
        {
            Id = 102,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Q3988482",
            Slug = "jaeger-lecoultre-reverso-q3988482",
            Description = "Jaeger-LeCoultre Reverso",
            CurrentPrice = 18900m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second, third);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("show me some reversos"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second), ToDto(third)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"These Reversos cover a classic small seconds option and a fuller second timezone take.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var discovery = await service.HandleMessageAsync("session-1", "show me some reversos", null, "127.0.0.1");
        Assert.Equal(3, discovery.WatchCards.Count);

        var compare = await service.HandleMessageAsync("session-1", "compare the first 2 for me", null, "127.0.0.1");

        var compareAction2 = Assert.Single(compare.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(
            ["jaeger-lecoultre-reverso-q397846j", "jaeger-lecoultre-reverso-q2458422"],
            compareAction2.Slugs);
        Assert.Equal(2, compare.WatchCards.Count);
    }

    [Fact]
    public async Task HandleMessageAsync_OrdinalFollowUpWithoutCompare_UsesPreviousChatCards()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "F.P.Journe", Slug = "fp-journe" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "lineSport", Slug = "fp-journe-linesport" };

        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "elegante 40 mm Tititalyt",
            Slug = "fp-journe-linesport-elegante-40mm-titalyt",
            Description = "F.P.Journe lineSport",
            CurrentPrice = 0m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "Chronometre Souverain",
            Slug = "fp-journe-linesport-chronometre-souverain",
            Description = "F.P.Journe Souverain",
            CurrentPrice = 0m
        };
        var third = new Watch
        {
            Id = 102,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "131.30.41.21.99.001 Meteorite Dial",
            Slug = "fp-journe-linesport-131-30-41-21-99-001-meteorite-dial",
            Description = "F.P.Journe lineSport",
            CurrentPrice = 17225m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second, third);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("show me some journe options"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second), ToDto(third)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"The first card is [F.P.Journe lineSport elegante 40 mm Tititalyt](/watches/fp-journe-linesport-elegante-40mm-titalyt), and the third is [F.P.Journe lineSport 131.30.41.21.99.001 Meteorite Dial](/watches/fp-journe-linesport-131-30-41-21-99-001-meteorite-dial).\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var discovery = await service.HandleMessageAsync("session-1", "show me some journe options", null, "127.0.0.1");
        Assert.Equal(3, discovery.WatchCards.Count);

        var followUp = await service.HandleMessageAsync("session-1", "what is the first and third one", null, "127.0.0.1");

        // Ordinal follow-up: no search action emitted, correct cards selected
        Assert.DoesNotContain(followUp.Actions, a => a.Type == "search");
        Assert.Equal(2, followUp.WatchCards.Count);
        Assert.Equal(
            ["fp-journe-linesport-elegante-40mm-titalyt", "fp-journe-linesport-131-30-41-21-99-001-meteorite-dial"],
            followUp.WatchCards.Select(card => card.Slug).ToList());
        Assert.Contains("first card", followUp.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_BareAffirmativeFollowUp_ReusesPreviousWatchCards()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Calatrava", Slug = "calatrava" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "6119G-001",
            Slug = "patek-philippe-calatrava-6119g-001",
            Description = "Patek Philippe Calatrava",
            CurrentPrice = 47000m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = collection,
            Name = "5227G-010",
            Slug = "patek-philippe-calatrava-5227g-010",
            Description = "Patek Philippe Calatrava",
            CurrentPrice = 52000m
        };

        context.Brands.Add(brand);
        context.Collections.Add(collection);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("show me some calatravas"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first), ToDto(second)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"These two Calatravas cover a more classic silver option and a fuller officer-style case.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var discovery = await service.HandleMessageAsync("session-1", "show me some calatravas", null, "127.0.0.1");
        Assert.Equal(2, discovery.WatchCards.Count);

        var followUp = await service.HandleMessageAsync("session-1", "yes", null, "127.0.0.1");

        Assert.Equal(2, followUp.WatchCards.Count);
        Assert.Equal(
            ["patek-philippe-calatrava-6119g-001", "patek-philippe-calatrava-5227g-010"],
            followUp.WatchCards.Select(card => card.Slug).ToList());
        Assert.DoesNotContain("specialise", followUp.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_BareAffirmativeFollowUp_AfterCompare_KeepsCompareAction()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var otherBrand = new Brand { Id = 2, Name = "Audemars Piguet", Slug = "audemars-piguet" };
        var nautilus = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Nautilus", Slug = "nautilus" };
        var royalOak = new Collection { Id = 20, BrandId = 2, Brand = otherBrand, Name = "Royal Oak", Slug = "royal-oak" };
        var first = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = brand,
            CollectionId = 10,
            Collection = nautilus,
            Name = "5711/1A-010",
            Slug = "patek-philippe-nautilus-5711-1a-010",
            Description = "Patek Philippe Nautilus",
            CurrentPrice = 35000m
        };
        var second = new Watch
        {
            Id = 101,
            BrandId = 2,
            Brand = otherBrand,
            CollectionId = 20,
            Collection = royalOak,
            Name = "16202ST",
            Slug = "audemars-piguet-royal-oak-16202st",
            Description = "Audemars Piguet Royal Oak",
            CurrentPrice = 42000m
        };

        context.Brands.AddRange(brand, otherBrand);
        context.Collections.AddRange(nautilus, royalOak);
        context.Watches.AddRange(first, second);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("5711/1A-010"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(first)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });
        watchFinder.Setup(f => f.FindWatchesAsync("16202ST"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(second)],
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"The Nautilus stays calmer and more discreet, while the Royal Oak feels more assertive on wrist.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var initial = await service.HandleMessageAsync("session-1", "Compare 5711/1A-010 vs 16202ST", null, "127.0.0.1");
        Assert.Single(initial.Actions.Where(a => a.Type == "compare").ToList());

        var followUp = await service.HandleMessageAsync("session-1", "yes", null, "127.0.0.1");

        var followUpCompare = Assert.Single(followUp.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(
            ["patek-philippe-nautilus-5711-1a-010", "audemars-piguet-royal-oak-16202st"],
            followUpCompare.Slugs);
        Assert.Equal(2, followUp.WatchCards.Count);
        Assert.DoesNotContain("specialise", followUp.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_CollectionCompare_ReturnsStableRepresentativeCompareSet()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var vacheron = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var aquanaut = new Collection { Id = 10, BrandId = 1, Brand = patek, Name = "Aquanaut", Slug = "patek-philippe-aquanaut" };
        var overseas = new Collection { Id = 20, BrandId = 2, Brand = vacheron, Name = "Overseas", Slug = "vacheron-constantin-overseas" };

        var aquanautHero = new Watch
        {
            Id = 100,
            BrandId = 1,
            Brand = patek,
            CollectionId = 10,
            Collection = aquanaut,
            Name = "5167A-001",
            Slug = "patek-philippe-aquanaut-5167a-001",
            Description = "Patek Philippe Aquanaut",
            CurrentPrice = 42000m,
            Image = "aquanaut.png",
            Specs = "{\"productionStatus\":\"Current\"}"
        };
        var aquanautSecondary = new Watch
        {
            Id = 101,
            BrandId = 1,
            Brand = patek,
            CollectionId = 10,
            Collection = aquanaut,
            Name = "5968A-001",
            Slug = "patek-philippe-aquanaut-5968a-001",
            Description = "Patek Philippe Aquanaut",
            CurrentPrice = 0m,
            Specs = "{\"productionStatus\":\"Discontinued\"}"
        };
        var overseasHero = new Watch
        {
            Id = 200,
            BrandId = 2,
            Brand = vacheron,
            CollectionId = 20,
            Collection = overseas,
            Name = "4520V/210A-B128",
            Slug = "vacheron-constantin-overseas-4520v-210a-b128",
            Description = "Vacheron Constantin Overseas",
            CurrentPrice = 38000m,
            Image = "overseas.png",
            Specs = "{\"productionStatus\":\"Current\"}"
        };
        var overseasSecondary = new Watch
        {
            Id = 201,
            BrandId = 2,
            Brand = vacheron,
            CollectionId = 20,
            Collection = overseas,
            Name = "5500V/110A-B148",
            Slug = "vacheron-constantin-overseas-5500v-110a-b148",
            Description = "Vacheron Constantin Overseas",
            CurrentPrice = 0m,
            Specs = "{\"productionStatus\":\"Discontinued\"}"
        };

        context.Brands.AddRange(patek, vacheron);
        context.Collections.AddRange(aquanaut, overseas);
        context.Watches.AddRange(aquanautHero, aquanautSecondary, overseasHero, overseasSecondary);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"[Aquanaut](/collections/patek-philippe-aquanaut) feels more relaxed, while [Overseas](/collections/vacheron-constantin-overseas) leans more versatile in daily wear.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Compare the Aquanaut and the Overseas", null, "127.0.0.1");

        var resultCompare = Assert.Single(result.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(
            ["patek-philippe-aquanaut-5167a-001", "vacheron-constantin-overseas-4520v-210a-b128"],
            resultCompare.Slugs);
        Assert.Equal(resultCompare.Slugs, result.WatchCards.Select(card => card.Slug).ToList());
        Assert.Equal(0, handler.CallCount);
        Assert.Contains("Aquanaut", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Overseas", result.Message, StringComparison.OrdinalIgnoreCase);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_CollectionCompareFollowUp_UsesStoredScopeForRandomPerCollection()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var vacheron = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var aquanaut = new Collection { Id = 10, BrandId = 1, Brand = patek, Name = "Aquanaut", Slug = "patek-philippe-aquanaut" };
        var overseas = new Collection { Id = 20, BrandId = 2, Brand = vacheron, Name = "Overseas", Slug = "vacheron-constantin-overseas" };

        var watches = new[]
        {
            new Watch { Id = 100, BrandId = 1, Brand = patek, CollectionId = 10, Collection = aquanaut, Name = "5167A-001", Slug = "patek-philippe-aquanaut-5167a-001", Description = "Patek Philippe Aquanaut", CurrentPrice = 42000m, Image = "a1.png", Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 101, BrandId = 1, Brand = patek, CollectionId = 10, Collection = aquanaut, Name = "5968A-001", Slug = "patek-philippe-aquanaut-5968a-001", Description = "Patek Philippe Aquanaut", CurrentPrice = 50000m, Image = "a2.png", Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 102, BrandId = 1, Brand = patek, CollectionId = 10, Collection = aquanaut, Name = "5268/200R-001", Slug = "patek-philippe-aquanaut-5268-200r-001", Description = "Patek Philippe Aquanaut", CurrentPrice = 68000m, Image = "a3.png", Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 200, BrandId = 2, Brand = vacheron, CollectionId = 20, Collection = overseas, Name = "4520V/210A-B128", Slug = "vacheron-constantin-overseas-4520v-210a-b128", Description = "Vacheron Constantin Overseas", CurrentPrice = 38000m, Image = "o1.png", Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 201, BrandId = 2, Brand = vacheron, CollectionId = 20, Collection = overseas, Name = "5500V/110A-B148", Slug = "vacheron-constantin-overseas-5500v-110a-b148", Description = "Vacheron Constantin Overseas", CurrentPrice = 47000m, Image = "o2.png", Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 202, BrandId = 2, Brand = vacheron, CollectionId = 20, Collection = overseas, Name = "5520V/210A-B148", Slug = "vacheron-constantin-overseas-5520v-210a-b148", Description = "Vacheron Constantin Overseas", CurrentPrice = 52000m, Image = "o3.png", Specs = "{\"productionStatus\":\"Current\"}" },
        };

        context.Brands.AddRange(patek, vacheron);
        context.Collections.AddRange(aquanaut, overseas);
        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"Tourbillon has the comparison ready.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);

        var initial = await service.HandleMessageAsync("session-1", "Compare the Aquanaut and the Overseas", null, "127.0.0.1");
        Assert.Equal(2, initial.Actions[0].Slugs?.Count);

        var followUp = await service.HandleMessageAsync("session-1", "compare 2 randoms from each collection", null, "127.0.0.1");

        var followUpCompare = Assert.Single(followUp.Actions.Where(a => a.Type == "compare").ToList());
        Assert.Equal(4, followUpCompare.Slugs?.Count);
        Assert.Equal(4, followUp.WatchCards.Count);
        Assert.All(followUp.WatchCards, card =>
            Assert.Contains(card.Slug, watches.Where(w => w.CollectionId is 10 or 20).Select(w => w.Slug)));
        var collectionIds = await context.Watches
            .Where(w => followUpCompare.Slugs!.Contains(w.Slug))
            .Select(w => w.CollectionId)
            .Distinct()
            .ToListAsync();
        Assert.Equal(2, collectionIds.Count);
        Assert.Equal(0, handler.CallCount);
        watchFinder.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleMessageAsync_DiscoveryResponse_HasCompareChip_AndBrandNavigateChip()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var watches = new[]
        {
            new Watch { Id = 100, BrandId = 1, Brand = patek, Name = "Nautilus", Slug = "nautilus", CurrentPrice = 50000m, Specs = "{\"productionStatus\":\"Current\"}" },
            new Watch { Id = 101, BrandId = 1, Brand = patek, Name = "Aquanaut", Slug = "aquanaut", CurrentPrice = 40000m, Specs = "{\"productionStatus\":\"Current\"}" }
        };

        context.Brands.Add(patek);
        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        watchFinder.Setup(f => f.FindWatchesAsync(It.IsAny<string>()))
            .ReturnsAsync(new WatchFinderResult { Watches = watches.Select(w => new WatchDto { Id = w.Id, Name = w.Name, Slug = w.Slug }).ToList() });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"Here are two Patek Philippe models.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Find me a patek philippe", null, "127.0.0.1");

        // Primary actions: the UI will have appended compare and navigate chips
        Assert.Contains(result.Actions, a => a.Type == "compare" && a.Slugs != null && a.Slugs.Contains("nautilus"));
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/patek-philippe");
    }

    [Fact]
    public async Task HandleMessageAsync_EntityInfoResponse_NoCompareChip_HasBrandNavigateChip()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var aquanaut = new Collection { Id = 10, BrandId = 1, Brand = patek, Name = "Aquanaut", Slug = "patek-philippe-aquanaut", Description = "Desc" };
        var watches = new[]
        {
            new Watch { Id = 100, BrandId = 1, Brand = patek, CollectionId = 10, Name = "W1", Slug = "w1", CurrentPrice = 1000m },
            new Watch { Id = 101, BrandId = 1, Brand = patek, CollectionId = 10, Name = "W2", Slug = "w2", CurrentPrice = 2000m }
        };

        context.Brands.Add(patek);
        context.Collections.Add(aquanaut);
        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            // Note: chat prompt no longer tells AI to emit comparisons for collections
            Content = new StringContent("{\"message\":\"The Aquanaut is great.\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Tell me about the Aquanaut collection", null, "127.0.0.1");

        Assert.DoesNotContain(result.Actions, a => a.Type == "compare");
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/patek-philippe");
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/collections/patek-philippe-aquanaut");
    }

    [Fact]
    public async Task HandleMessageAsync_CompareResponse_HasBrandNavigateChips()
    {
        using var context = CreateContext();
        var patek = new Brand { Id = 1, Name = "Patek Philippe", Slug = "patek-philippe" };
        var rolex = new Brand { Id = 2, Name = "Rolex", Slug = "rolex" };
        var watches = new[]
        {
            new Watch { Id = 100, BrandId = 1, Brand = patek, Name = "Nautilus", Slug = "nautilus", CurrentPrice = 50000m },
            new Watch { Id = 200, BrandId = 2, Brand = rolex, Name = "Submariner", Slug = "submariner", CurrentPrice = 10000m }
        };

        context.Brands.AddRange(patek, rolex);
        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        // Return each watch individually so TryResolveExactWatchAsync (requires exactly 1 result) can resolve both
        watchFinder.Setup(f => f.FindWatchesAsync(It.Is<string>(q => q.Contains("Nautilus", StringComparison.OrdinalIgnoreCase))))
            .ReturnsAsync(new WatchFinderResult { SearchPath = "direct_sql", Watches = [new WatchDto { Id = 100, Name = "Nautilus", Slug = "nautilus" }] });
        watchFinder.Setup(f => f.FindWatchesAsync(It.Is<string>(q => q.Contains("Submariner", StringComparison.OrdinalIgnoreCase))))
            .ReturnsAsync(new WatchFinderResult { SearchPath = "direct_sql", Watches = [new WatchDto { Id = 200, Name = "Submariner", Slug = "submariner" }] });
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            // The AI spits out a compare action directly
            Content = new StringContent("{\"message\":\"Both are icons.\",\"actions\":[{\"type\":\"compare\",\"slugs\":[\"nautilus\",\"submariner\"]}]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "Compare the Nautilus and the Submariner", null, "127.0.0.1");

        // UI has the compare primary action
        Assert.Contains(result.Actions, a => a.Type == "compare");
        // And two brand navigation secondary actions
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/patek-philippe");
        Assert.Contains(result.Actions, a => a.Type == "navigate" && a.Href == "/brands/rolex");
    }

    [Fact]
    public async Task HandleMessageAsync_RefusalResponse_HasFallbackDiscoveryChip()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));

        var service = CreateService(context, watchFinder, handler);
        
        // Abusive query gets a deterministic refusal
        var result = await service.HandleMessageAsync("session-1", "You are stupid", null, "127.0.0.1");

        Assert.Contains(result.Actions, a => a.Type == "search" && a.Label == "Browse the catalogue");
    }

    [Fact]
    public async Task HandleMessageAsync_GreetingResponse_HasFallbackDiscoveryChip()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        // Returns empty cards for greeting
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"message\":\"Hello! How can I help?\",\"actions\":[]}", Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        
        // Simple greeting
        var result = await service.HandleMessageAsync("session-1", "Hello", null, "127.0.0.1");

        Assert.Contains(result.Actions, a => a.Type == "search" && a.Label == "Browse the catalogue");
    }
}
