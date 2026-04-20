// Recommendation-path tests for ChatService.
// Broad discovery requests should surface up to ten in-store matches by default.
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
        public List<string> RequestBodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            if (request.Content != null)
                RequestBodies.Add(await request.Content.ReadAsStringAsync(cancellationToken));
            return _responder(request);
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

    // Default classifier returns "unclear"; tests that rely on semantic follow-up
    // routing should inject the explicit intent they expect production to classify.
    private sealed class FakeClassifier : IIntentClassifier
    {
        private readonly Func<string, IntentClassification> _classify;

        public FakeClassifier()
            : this(_ => new IntentClassification("unclear", 0.0)) { }

        public FakeClassifier(Func<string, IntentClassification> classify) => _classify = classify;

        public Task<IntentClassification> ClassifyAsync(
            string query,
            IReadOnlyList<string> entityBrands,
            IReadOnlyList<string> entityCollections,
            string followUpMode,
            int lastCardCount,
            IReadOnlyList<int> sessionBrandIds)
            => Task.FromResult(_classify(query));
    }

    private static ChatService CreateService(
        TourbillonContext context,
        Mock<IWatchFinderService> watchFinderMock,
        RecordingHandler handler,
        IIntentClassifier? classifier = null,
        IActionPlanner? planner = null)
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
            NullLogger<ChatService>.Instance,
            classifier ?? new FakeClassifier(),
            planner ?? new ActionPlannerFake());
    }

    private static WatchDto ToDto(Watch watch) => WatchDto.FromWatch(watch);

    [Fact]
    public async Task HandleMessageAsync_BroadRecommendation_ShowsUpToTenMatchedProductsByDefault()
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
                "{\"message\":\"Here are several strong Tourbillon matches from [Omega](/brands/omega).\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var classifier = new FakeClassifier(query =>
            query.Contains("show me something else", StringComparison.OrdinalIgnoreCase)
                ? new IntentClassification("revision_request", 0.95)
                : new IntentClassification("unclear", 0.0));

        var service = CreateService(context, watchFinder, handler, classifier);
        var result = await service.HandleMessageAsync("session-1", "Recommend me a versatile Omega", null, "127.0.0.1");

        Assert.Equal(6, result.WatchCards.Count);
        Assert.Equal(watches.Select(w => w.Slug), result.WatchCards.Select(w => w.Slug));
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

        var classifier = new FakeClassifier(query =>
            query.Contains("show me something else", StringComparison.OrdinalIgnoreCase)
                ? new IntentClassification("revision_request", 0.95)
                : new IntentClassification("unclear", 0.0));

        var service = CreateService(context, watchFinder, handler, classifier);
        var result = await service.HandleMessageAsync("session-1", "yo, suggest me a couple of reversos for me under 50k", null, "127.0.0.1");

        Assert.Contains(result.Actions, action => action.Type == "search" && action.Query == "Jaeger-LeCoultre Reverso under 50k");
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_DiscoveryIgnoresAiReturnedActions()
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
                "{\"message\":\"[Jaeger-LeCoultre Reverso Q397846J](/watches/jaeger-lecoultre-reverso-q397846j) is a refined starting point.\",\"actions\":[{\"type\":\"search\",\"query\":\"browse the web for Omega history\",\"label\":\"Bad search\"},{\"type\":\"set_cursor\",\"cursor\":\"tourbillon\",\"label\":\"Bad cursor\"}]}",
                Encoding.UTF8,
                "application/json")
        });

        var classifier = new FakeClassifier(query =>
            query.Contains("show me something else", StringComparison.OrdinalIgnoreCase)
                ? new IntentClassification("revision_request", 0.95)
                : new IntentClassification("unclear", 0.0));

        var service = CreateService(context, watchFinder, handler, classifier);
        var result = await service.HandleMessageAsync("session-1", "yo, suggest me a couple of reversos for me under 50k", null, "127.0.0.1");

        var searchAction = Assert.Single(result.Actions.Where(action => action.Type == "search"));
        Assert.Equal("Jaeger-LeCoultre Reverso under 50k", searchAction.Query);
        Assert.DoesNotContain(result.Actions, action => action.Type == "set_cursor");
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_RecommendationCorrection_ReplacesVisibleCards()
    {
        using var context = CreateContext();

        var brand = new Brand { Id = 1, Name = "Omega", Slug = "omega" };
        var collection = new Collection { Id = 10, BrandId = 1, Brand = brand, Name = "Seamaster", Slug = "seamaster" };
        context.Brands.Add(brand);
        context.Collections.Add(collection);

        var watches = Enumerable.Range(1, 7)
            .Select(i => new Watch
            {
                Id = i,
                BrandId = 1,
                Brand = brand,
                CollectionId = 10,
                Collection = collection,
                Name = $"Seamaster {i}",
                Slug = $"omega-seamaster-{i}",
                Description = "Omega Seamaster",
                CurrentPrice = 5000m + i
            })
            .ToList();

        context.Watches.AddRange(watches);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("Recommend me sporty watches"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = watches.Take(5).Select(ToDto).ToList(),
                OtherCandidates = watches.Skip(5).Select(ToDto).ToList(),
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Here are the strongest sport-led options Tourbillon surfaced.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var classifier = new FakeClassifier(query =>
            query.Contains("show me something else", StringComparison.OrdinalIgnoreCase)
                ? new IntentClassification("revision_request", 0.95)
                : new IntentClassification("unclear", 0.0));

        var service = CreateService(context, watchFinder, handler, classifier);

        var initial = await service.HandleMessageAsync("session-1", "Recommend me sporty watches", null, "127.0.0.1");
        var revised = await service.HandleMessageAsync("session-1", "show me something else", null, "127.0.0.1");

        var initialSlugs = initial.WatchCards.Select(card => card.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);
        Assert.Equal(5, initial.WatchCards.Count);
        Assert.Equal(2, revised.WatchCards.Count);
        Assert.All(revised.WatchCards, card => Assert.DoesNotContain(card.Slug, initialSlugs));
        Assert.Equal(2, handler.CallCount);

        var revisionPayload = JsonDocument.Parse(handler.RequestBodies[1]).RootElement;
        var revisionContext = string.Join("\n", revisionPayload.GetProperty("context").EnumerateArray().Select(item => item.GetString()));
        Assert.Contains("Recommendation revision request", revisionContext, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task HandleMessageAsync_MixedBrief_DiversifiesAcrossDiveAndArtDirections()
    {
        using var context = CreateContext();

        var omega = new Brand { Id = 1, Name = "Omega", Slug = "omega" };
        var vacheron = new Brand { Id = 2, Name = "Vacheron Constantin", Slug = "vacheron-constantin" };
        var seamaster = new Collection
        {
            Id = 10,
            BrandId = 1,
            Brand = omega,
            Name = "Seamaster",
            Slug = "omega-seamaster",
            Styles = ["diver"],
            Description = "Omega diver line"
        };
        var metiers = new Collection
        {
            Id = 20,
            BrandId = 2,
            Brand = vacheron,
            Name = "Métiers d'Art",
            Slug = "vacheron-constantin-metiers-d-art",
            Styles = ["art"],
            Description = "Decorative arts and artisanal craftsmanship"
        };
        context.Brands.AddRange(omega, vacheron);
        context.Collections.AddRange(seamaster, metiers);

        var diveWatches = new[]
        {
            new Watch { Id = 1, BrandId = 1, Brand = omega, CollectionId = 10, Collection = seamaster, Name = "Diver 300M", Slug = "omega-seamaster-diver-300m", Description = "Omega Seamaster", CurrentPrice = 7000m },
            new Watch { Id = 2, BrandId = 1, Brand = omega, CollectionId = 10, Collection = seamaster, Name = "Planet Ocean", Slug = "omega-seamaster-planet-ocean", Description = "Omega Seamaster", CurrentPrice = 8200m }
        };
        var artWatches = new[]
        {
            new Watch { Id = 3, BrandId = 2, Brand = vacheron, CollectionId = 20, Collection = metiers, Name = "Les Aérostiers", Slug = "vacheron-constantin-metiers-d-art-les-aerostiers", Description = "Vacheron Constantin Métiers d'Art", CurrentPrice = 0m },
            new Watch { Id = 4, BrandId = 2, Brand = vacheron, CollectionId = 20, Collection = metiers, Name = "Tribute to Great Civilisations", Slug = "vacheron-constantin-metiers-d-art-great-civilisations", Description = "Vacheron Constantin Métiers d'Art", CurrentPrice = 0m }
        };

        context.Watches.AddRange(diveWatches);
        context.Watches.AddRange(artWatches);
        await context.SaveChangesAsync();

        var initialQuery = "i want dive watches and art watches, recommend me some";
        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync(It.IsAny<string>()))
            .ReturnsAsync((string query) =>
            {
                var normalized = query.ToLowerInvariant();
                if (normalized == initialQuery)
                {
                    return new WatchFinderResult
                    {
                        Watches = diveWatches.Select(ToDto).ToList(),
                        OtherCandidates = [],
                        SearchPath = "vector"
                    };
                }

                if (normalized.Contains("art watches", StringComparison.OrdinalIgnoreCase))
                {
                    return new WatchFinderResult
                    {
                        Watches = artWatches.Select(ToDto).ToList(),
                        OtherCandidates = [],
                        SearchPath = "vector"
                    };
                }

                if (normalized.Contains("dive watches", StringComparison.OrdinalIgnoreCase))
                {
                    return new WatchFinderResult
                    {
                        Watches = diveWatches.Select(ToDto).ToList(),
                        OtherCandidates = [],
                        SearchPath = "vector"
                    };
                }

                return new WatchFinderResult
                {
                    Watches = diveWatches.Select(ToDto).ToList(),
                    OtherCandidates = [],
                    SearchPath = "vector"
                };
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"Here is a balanced mixed shortlist.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", initialQuery, null, "127.0.0.1");

        Assert.True(result.WatchCards.Count >= 4);
        Assert.Contains(result.WatchCards, card => string.Equals(card.CollectionSlug, seamaster.Slug, StringComparison.OrdinalIgnoreCase));
        Assert.Contains(result.WatchCards, card => string.Equals(card.CollectionSlug, metiers.Slug, StringComparison.OrdinalIgnoreCase));
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task HandleMessageAsync_DiscoveryReplyThatMentionsUnsupportedBrands_FallsBackToGroundedMessage()
    {
        using var context = CreateContext();

        var omega = new Brand { Id = 1, Name = "Omega", Slug = "omega" };
        var seamaster = new Collection
        {
            Id = 10,
            BrandId = 1,
            Brand = omega,
            Name = "Seamaster",
            Slug = "omega-seamaster",
            Styles = ["diver"],
            Description = "Omega diver line"
        };
        var watch = new Watch
        {
            Id = 1,
            BrandId = 1,
            Brand = omega,
            CollectionId = 10,
            Collection = seamaster,
            Name = "Diver 300M",
            Slug = "omega-seamaster-diver-300m",
            Description = "Omega Seamaster",
            CurrentPrice = 7000m
        };
        context.Brands.Add(omega);
        context.Collections.Add(seamaster);
        context.Watches.Add(watch);
        await context.SaveChangesAsync();

        var watchFinder = new Mock<IWatchFinderService>();
        watchFinder.Setup(f => f.FindWatchesAsync("show me a diver"))
            .ReturnsAsync(new WatchFinderResult
            {
                Watches = [ToDto(watch)],
                OtherCandidates = [],
                SearchPath = "vector"
            });

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"message\":\"For art watches, explore Patek Philippe Grandmaster Chime before you decide.\",\"actions\":[]}",
                Encoding.UTF8,
                "application/json")
        });

        var service = CreateService(context, watchFinder, handler);
        var result = await service.HandleMessageAsync("session-1", "show me a diver", null, "127.0.0.1");

        Assert.DoesNotContain("Patek Philippe", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Omega", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Single(result.WatchCards);
        Assert.Equal(watch.Slug, result.WatchCards[0].Slug);
    }
}
