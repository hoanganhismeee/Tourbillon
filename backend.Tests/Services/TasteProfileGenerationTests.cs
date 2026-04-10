// Integration-style tests around TasteProfileService.GenerateFromBehaviorAsync.
// These verify the deterministic contract: threshold, refresh behavior, request payload,
// and persistence of the ai-service response. They do not judge whether the LLM summary
// is semantically correct for real browsing patterns.
using System.Net;
using System.Text;
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace backend.Tests.Services;

public class TasteProfileGenerationTests
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

    private static TasteProfileService CreateService(
        TourbillonContext context,
        RecordingHandler handler)
    {
        var httpFactory = new Mock<IHttpClientFactory>(MockBehavior.Strict);
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5000") };
        httpFactory.Setup(f => f.CreateClient("ai-service")).Returns(client);

        var behaviorService = new BehaviorService(context);
        return new TasteProfileService(context, httpFactory.Object, behaviorService);
    }

    private static void SeedBrands(TourbillonContext context)
    {
        context.Brands.AddRange(
            new Brand { Id = 1, Name = "Jaeger-LeCoultre", Slug = "jaeger-lecoultre" },
            new Brand { Id = 2, Name = "Patek Philippe", Slug = "patek-philippe" },
            new Brand { Id = 3, Name = "Audemars Piguet", Slug = "audemars-piguet" });
        context.SaveChanges();
    }

    [Fact]
    public async Task GetProfileAsync_SetsHasEnoughBehaviorData_AfterThreeEvents()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent { UserId = 7, EventType = "watch_view", EntityId = 1, EntityName = "One", Timestamp = DateTime.UtcNow.AddMinutes(-3) },
            new UserBrowsingEvent { UserId = 7, EventType = "brand_view", EntityId = 2, EntityName = "Two", Timestamp = DateTime.UtcNow.AddMinutes(-2) },
            new UserBrowsingEvent { UserId = 7, EventType = "search", EntityName = "blue dial", Timestamp = DateTime.UtcNow.AddMinutes(-1) });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(context, handler);

        var profile = await service.GetProfileAsync(7);

        Assert.True(profile.HasEnoughBehaviorData);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_DoesNotCallAi_WhenFewerThanThreeEvents()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserTasteProfiles.Add(new UserTasteProfile
        {
            UserId = 7,
            Summary = "Existing summary",
            BehaviorAnalyzedAt = DateTime.UtcNow.AddHours(-10),
        });
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent { UserId = 7, EventType = "watch_view", EntityId = 1, EntityName = "One", Timestamp = DateTime.UtcNow.AddMinutes(-2) },
            new UserBrowsingEvent { UserId = 7, EventType = "brand_view", EntityId = 2, EntityName = "Two", Timestamp = DateTime.UtcNow.AddMinutes(-1) });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(context, handler);

        var profile = await service.GenerateFromBehaviorAsync(7);

        Assert.Equal(0, handler.CallCount);
        Assert.True(profile.HasBehaviorAnalysis);
        Assert.False(profile.HasEnoughBehaviorData);
        Assert.Equal("Existing summary", profile.BehaviorSummary);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_SendsMixedBrowsingActions_AndPersistsReturnedProfile()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                UserId = 11,
                EventType = "watch_view",
                EntityId = 101,
                EntityName = "Reverso Tribute",
                BrandId = 1,
                Timestamp = DateTime.UtcNow.AddMinutes(-4),
            },
            new UserBrowsingEvent
            {
                UserId = 11,
                EventType = "collection_view",
                EntityId = 202,
                EntityName = "Calatrava",
                BrandId = 2,
                Timestamp = DateTime.UtcNow.AddMinutes(-3),
            },
            new UserBrowsingEvent
            {
                UserId = 11,
                EventType = "search",
                EntityName = "blue dial dress watch under 30k",
                Timestamp = DateTime.UtcNow.AddMinutes(-2),
            },
            new UserBrowsingEvent
            {
                UserId = 11,
                EventType = "brand_view",
                EntityId = 2,
                EntityName = "Patek Philippe",
                BrandId = 2,
                Timestamp = DateTime.UtcNow.AddMinutes(-1),
            });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""
            {
              "preferred_brands": ["Patek Philippe"],
              "preferred_materials": ["stainless steel"],
              "preferred_dial_colors": ["blue"],
              "price_min": null,
              "price_max": 30000,
              "preferred_case_size": "medium",
              "summary": "Recent browsing leans toward refined dress watches with a strong pull toward Patek Philippe."
            }
            """, Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, handler);
        var profile = await service.GenerateFromBehaviorAsync(11);
        var persisted = await context.UserTasteProfiles.SingleAsync(p => p.UserId == 11);

        Assert.Equal(1, handler.CallCount);
        Assert.Contains("\"type\":\"watch_view\"", handler.RequestBodies[0]);
        Assert.Contains("\"type\":\"collection_view\"", handler.RequestBodies[0]);
        Assert.Contains("\"type\":\"brand_view\"", handler.RequestBodies[0]);
        Assert.Contains("\"type\":\"search\"", handler.RequestBodies[0]);
        Assert.Contains("blue dial dress watch under 30k", handler.RequestBodies[0]);

        Assert.True(profile.HasEnoughBehaviorData);
        Assert.True(profile.HasBehaviorAnalysis);
        Assert.Equal("Recent browsing leans toward refined dress watches with a strong pull toward Patek Philippe.", profile.BehaviorSummary);
        Assert.Equal([2], profile.BehaviorPreferredBrandIds);
        Assert.Equal(["stainless steel"], profile.BehaviorPreferredMaterials);
        Assert.Equal(["blue"], profile.BehaviorPreferredDialColors);
        Assert.Equal(30000, profile.BehaviorPriceMax);
        Assert.Equal("medium", profile.BehaviorPreferredCaseSize);

        Assert.Contains("2", persisted.BehaviorPreferredBrandIds);
        Assert.Contains("stainless steel", persisted.BehaviorPreferredMaterials);
        Assert.Contains("blue", persisted.BehaviorPreferredDialColors);
        Assert.Equal(30000, persisted.BehaviorPriceMax);
        Assert.Equal("medium", persisted.BehaviorPreferredCaseSize);
        Assert.NotNull(persisted.BehaviorAnalyzedAt);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_DoesNotRefresh_WhenNoNewEventsPastCooldown()
    {
        using var context = CreateContext();
        SeedBrands(context);
        var analyzedAt = DateTime.UtcNow.AddHours(-1);

        context.UserTasteProfiles.Add(new UserTasteProfile
        {
            UserId = 19,
            Summary = "Existing behavior summary",
            BehaviorPreferredBrandIds = "[2]",
            BehaviorAnalyzedAt = analyzedAt,
        });
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                UserId = 19,
                EventType = "watch_view",
                EntityId = 1,
                EntityName = "Calatrava",
                BrandId = 2,
                Timestamp = analyzedAt.AddMinutes(-10),
            },
            new UserBrowsingEvent
            {
                UserId = 19,
                EventType = "brand_view",
                EntityId = 2,
                EntityName = "Patek Philippe",
                BrandId = 2,
                Timestamp = analyzedAt.AddMinutes(-9),
            },
            new UserBrowsingEvent
            {
                UserId = 19,
                EventType = "search",
                EntityName = "dress watch",
                Timestamp = analyzedAt.AddMinutes(-8),
            });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var service = CreateService(context, handler);

        var profile = await service.GenerateFromBehaviorAsync(19);

        Assert.Equal(0, handler.CallCount);
        Assert.Equal("Existing behavior summary", profile.BehaviorSummary);
        Assert.Equal([2], profile.BehaviorPreferredBrandIds);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_PersistsAiSummaryVerbatim_WithoutSemanticValidation()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                UserId = 23,
                EventType = "watch_view",
                EntityId = 101,
                EntityName = "Reverso Tribute",
                BrandId = 1,
                Timestamp = DateTime.UtcNow.AddMinutes(-4),
            },
            new UserBrowsingEvent
            {
                UserId = 23,
                EventType = "brand_view",
                EntityId = 1,
                EntityName = "Jaeger-LeCoultre",
                BrandId = 1,
                Timestamp = DateTime.UtcNow.AddMinutes(-3),
            },
            new UserBrowsingEvent
            {
                UserId = 23,
                EventType = "search",
                EntityName = "rectangular dress watch",
                Timestamp = DateTime.UtcNow.AddMinutes(-2),
            });
        await context.SaveChangesAsync();

        const string aiSummary = "A narrow but elegant signal is forming around rectangular dress watches.";
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent($$"""
            {
              "preferred_brands": ["Jaeger-LeCoultre"],
              "preferred_materials": ["stainless steel"],
              "preferred_dial_colors": ["silver"],
              "price_min": null,
              "price_max": null,
              "preferred_case_size": "medium",
              "summary": "{{aiSummary}}"
            }
            """, Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, handler);
        var profile = await service.GenerateFromBehaviorAsync(23);
        var persisted = await context.UserTasteProfiles.SingleAsync(p => p.UserId == 23);

        Assert.Equal(aiSummary, profile.BehaviorSummary);
        Assert.Equal(aiSummary, persisted.Summary);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_IgnoresBrandsThatAreNotInTheCatalog()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                UserId = 29,
                EventType = "watch_view",
                EntityId = 101,
                EntityName = "Royal Oak Selfwinding",
                BrandId = 3,
                Timestamp = DateTime.UtcNow.AddMinutes(-4),
            },
            new UserBrowsingEvent
            {
                UserId = 29,
                EventType = "brand_view",
                EntityId = 3,
                EntityName = "Audemars Piguet",
                BrandId = 3,
                Timestamp = DateTime.UtcNow.AddMinutes(-3),
            },
            new UserBrowsingEvent
            {
                UserId = 29,
                EventType = "search",
                EntityName = "integrated bracelet sports watch",
                Timestamp = DateTime.UtcNow.AddMinutes(-2),
            });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""
            {
              "preferred_brands": ["Rolex", "Audemars Piguet"],
              "preferred_materials": ["stainless steel"],
              "preferred_dial_colors": ["blue"],
              "price_min": null,
              "price_max": null,
              "preferred_case_size": null,
              "summary": "Recent browsing points toward integrated sports watches."
            }
            """, Encoding.UTF8, "application/json")
        });

        var service = CreateService(context, handler);
        var profile = await service.GenerateFromBehaviorAsync(29);

        Assert.Equal([3], profile.BehaviorPreferredBrandIds);
    }

    [Fact]
    public async Task GenerateFromBehaviorAsync_PreservesExistingBehaviorProfile_WhenAiCallFails()
    {
        using var context = CreateContext();
        SeedBrands(context);
        context.UserTasteProfiles.Add(new UserTasteProfile
        {
            UserId = 31,
            Summary = "Existing behavior summary",
            BehaviorPreferredBrandIds = "[2]",
            BehaviorPreferredMaterials = "[\"rose gold\"]",
            BehaviorPreferredDialColors = "[\"silver\"]",
            BehaviorPriceMax = 50000,
            BehaviorPreferredCaseSize = "medium",
            BehaviorAnalyzedAt = DateTime.UtcNow.AddHours(-12),
        });
        context.UserBrowsingEvents.AddRange(
            new UserBrowsingEvent
            {
                UserId = 31,
                EventType = "watch_view",
                EntityId = 1,
                EntityName = "Calatrava",
                BrandId = 2,
                Timestamp = DateTime.UtcNow.AddMinutes(-4),
            },
            new UserBrowsingEvent
            {
                UserId = 31,
                EventType = "brand_view",
                EntityId = 2,
                EntityName = "Patek Philippe",
                BrandId = 2,
                Timestamp = DateTime.UtcNow.AddMinutes(-3),
            },
            new UserBrowsingEvent
            {
                UserId = 31,
                EventType = "search",
                EntityName = "rose gold dress watch",
                Timestamp = DateTime.UtcNow.AddMinutes(-2),
            });
        await context.SaveChangesAsync();

        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.BadGateway));
        var service = CreateService(context, handler);

        var profile = await service.GenerateFromBehaviorAsync(31);

        Assert.Equal(1, handler.CallCount);
        Assert.Equal("Existing behavior summary", profile.BehaviorSummary);
        Assert.Equal([2], profile.BehaviorPreferredBrandIds);
        Assert.Equal(["rose gold"], profile.BehaviorPreferredMaterials);
        Assert.Equal(["silver"], profile.BehaviorPreferredDialColors);
        Assert.Equal(50000, profile.BehaviorPriceMax);
        Assert.Equal("medium", profile.BehaviorPreferredCaseSize);
    }
}
