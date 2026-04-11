// Unit tests for ChatService.
// These cover the deterministic routing paths that should avoid unnecessary ai-service calls.
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

    private static IConfiguration CreateConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ChatSettings:DisableLimitInDev"] = "true",
                ["ChatSettings:DailyLimit"] = "5",
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
        RecordingHandler? handler = null)
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
            new FakeRedis(),
            CreateConfig(),
            watchFinderMock.Object,
            NullLogger<ChatService>.Instance);
    }

    [Fact]
    public async Task HandleMessageAsync_RefusesUnrelatedRequest_WithoutCallingSearchOrAi()
    {
        using var context = CreateContext();
        var watchFinder = new Mock<IWatchFinderService>(MockBehavior.Strict);
        var service = CreateService(context, watchFinder);

        var result = await service.HandleMessageAsync("session-1", "Write me a sales CV", null, "127.0.0.1");

        Assert.Contains("specialise", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(result.Actions);
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
        Assert.Empty(result.Actions);
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
        Assert.Empty(result.Actions);
        watchFinder.Verify(f => f.FindWatchesAsync("5711/1A-010"), Times.Once);
    }

    [Fact]
    public async Task HandleMessageAsync_DirectEntityLikeRequest_UsesCanonicalEntitySearchInsteadOfRefusal()
    {
        using var context = CreateContext();
        var brand = new Brand { Id = 1, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var historiques = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Historiques", Slug = "historiques" };
        var duometre = new Collection { Id = 20, BrandId = 1, Brand = brand, Name = "Duometre", Slug = "duometre" };

        var watches = new[]
        {
            new Watch
            {
                Id = 100,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = historiques,
                Name = "4200H/222A-B934 222",
                Slug = "vacheron-constantin-historiques-4200h-222a-b934-222",
                Description = "Vacheron Constantin Historiques",
                CurrentPrice = 0m
            },
            new Watch
            {
                Id = 101,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = historiques,
                Name = "4200H/222J-B935 222",
                Slug = "vacheron-constantin-historiques-4200h-222j-b935-222",
                Description = "Vacheron Constantin Historiques",
                CurrentPrice = 0m
            },
            new Watch
            {
                Id = 102,
                BrandId = 1,
                Brand = brand,
                CollectionId = 20,
                Collection = duometre,
                Name = "Q622252J 222",
                Slug = "jaeger-lecoultre-duometre-q622252j-222",
                Description = "Jaeger-LeCoultre Duometre",
                CurrentPrice = 0m
            }
        };

        context.Brands.Add(brand);
        context.Collections.AddRange(historiques, duometre);
        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("222"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = watches.Select(ToDto).ToList(),
                OtherCandidates = [],
                SearchPath = "direct_sql_merged"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Tourbillon found three catalogue matches built around 222.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "introduce me the 222", null, "127.0.0.1");

        Assert.DoesNotContain("specialise", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(3, result.WatchCards.Count);
        Assert.All(result.WatchCards, card => Assert.Contains("222", card.Name, StringComparison.OrdinalIgnoreCase));
        watchFinder.Verify(f => f.FindWatchesAsync("222"), Times.Once);
        Assert.Equal(1, handler.CallCount);
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

        Assert.Single(result.Actions);
        Assert.Equal("compare", result.Actions[0].Type);
        Assert.Equal(
            ["patek-philippe-nautilus-5711-1a-010", "audemars-piguet-royal-oak-16202st"],
            result.Actions[0].Slugs);
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
        Assert.Equal("Jaeger-LeCoultre Reverso pink gold", searchActions[0].Query);
        Assert.Equal(1, handler.CallCount);
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

        Assert.Single(compare.Actions);
        Assert.Equal("compare", compare.Actions[0].Type);
        Assert.Equal(
            ["vacheron-constantin-overseas-4200h-222a-b934", "vacheron-constantin-historiques-1100s-000r-b430"],
            compare.Actions[0].Slugs);
        Assert.Equal(2, compare.WatchCards.Count);
        Assert.Equal(2, handler.CallCount);
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

        Assert.Empty(followUp.Actions);
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

        Assert.Single(result.Actions);
        Assert.Equal("compare", result.Actions[0].Type);
        Assert.Equal(
            ["patek-philippe-aquanaut-5167a-001", "vacheron-constantin-overseas-4520v-210a-b128"],
            result.Actions[0].Slugs);
        Assert.Equal(result.Actions[0].Slugs, result.WatchCards.Select(card => card.Slug).ToList());
        Assert.Equal(1, handler.CallCount);
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

        Assert.Single(followUp.Actions);
        Assert.Equal(4, followUp.Actions[0].Slugs?.Count);
        Assert.Equal(4, followUp.WatchCards.Count);
        Assert.All(followUp.WatchCards, card =>
            Assert.Contains(card.Slug, watches.Where(w => w.CollectionId is 10 or 20).Select(w => w.Slug)));
        var collectionIds = await context.Watches
            .Where(w => followUp.Actions[0].Slugs!.Contains(w.Slug))
            .Select(w => w.CollectionId)
            .Distinct()
            .ToListAsync();
        Assert.Equal(2, collectionIds.Count);
        Assert.Equal(2, handler.CallCount);
        watchFinder.VerifyNoOtherCalls();
    }
}
