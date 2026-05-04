// Shared test infrastructure for ChatService, TasteProfileService, and related tests.
// Extracted to eliminate duplication across ChatServiceTests, ChatServiceRecommendationTests,
// and TasteProfileGenerationTests.
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace backend.Tests.Services;

// Suppresses WatchEmbedding and QueryCache which depend on pgvector — unavailable in-memory.
internal sealed class TestTourbillonContext : TourbillonContext
{
    public TestTourbillonContext(DbContextOptions<TourbillonContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Ignore<WatchEmbedding>();
        modelBuilder.Ignore<QueryCache>();
    }
}

internal sealed class FakeRedis : IRedisService
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

internal sealed class RecordingHandler : HttpMessageHandler
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

// Default returns "unclear"; pass a fixed intent string or a lambda for specific routing tests.
internal sealed class FakeClassifier : IIntentClassifier
{
    private readonly Func<string, IntentClassification> _classify;

    public FakeClassifier(string fixedIntent = "unclear", double confidence = 0.95)
        : this(_ => new IntentClassification(fixedIntent, confidence)) { }

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

internal sealed class TestStorageService : IStorageService
{
    public Task<(string PublicId, long Version)> UploadImageAsync(Stream stream, string filename, string folder = "watches")
        => Task.FromResult((string.IsNullOrEmpty(folder) ? filename : $"{folder}/{filename}", 1L));

    public Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches")
        => Task.FromResult(publicId.Contains('/') ? publicId : $"{folder}/{publicId}");

    public Task<bool> DeleteImageAsync(string publicId)
        => Task.FromResult(true);

    public Task<List<string>> ListAssetsByPrefixAsync(string prefix)
        => Task.FromResult(new List<string>());

    public Task<bool> RenameAssetAsync(string fromPublicId, string toPublicId)
        => Task.FromResult(true);

    public Task<(string PresignedUrl, string Key)> GeneratePresignedUploadUrlAsync(
        string fileName, string folder, string contentType, int expiryMinutes = 15)
        => Task.FromResult(($"https://s3.test/presigned/{folder}/{fileName}", $"{folder}/{fileName}"));

    public string? GetPublicUrl(string? publicId, long? version = null)
    {
        if (string.IsNullOrEmpty(publicId))
            return null;

        if (publicId.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return publicId;

        return $"https://cdn.test/{publicId}?v={version ?? 1}";
    }
}

internal static class TestContextFactory
{
    internal static TourbillonContext Create() =>
        new TestTourbillonContext(
            new DbContextOptionsBuilder<TourbillonContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

    internal static IConfiguration ChatConfig(bool disableLimit = true, int dailyLimit = 5) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ChatSettings:DisableLimitInDev"] = disableLimit ? "true" : "false",
                ["ChatSettings:DailyLimit"] = dailyLimit.ToString(),
            })
            .Build();
}
