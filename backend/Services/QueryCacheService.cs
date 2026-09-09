// Persistent semantic query cache.
// Stores WatchFinderResult indexed by query embedding. On lookup, finds the nearest
// cached query by cosine similarity — if above threshold, returns the stored result
// without running the LLM pipeline. Threshold 0.92 allows near-identical phrasings
// to hit the cache while keeping results accurate for genuinely different queries.

using System.Text.Json;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace backend.Services;

public class QueryCacheService
{
    private readonly TourbillonContext _context;
    private readonly ILogger<QueryCacheService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // Minimum cosine similarity to count as a cache hit — 0.92 catches near-identical
    // phrasings but rejects queries with genuinely different intent.
    private const float SimilarityThreshold = 0.92f;

    // Bump this whenever the retrieval pipeline or the embedding model changes. Entries stamped
    // with any other version are invisible to lookups, so a deploy invalidates its own stale
    // results without anyone remembering to call the admin clear endpoint. Overridable via
    // QueryCache:Version to force invalidation from configuration alone.
    // v3: dial colour became a deterministic filter dimension, so dial queries are answered
    // by SQL rather than by vector similarity and return a different result set.
    // v2: generation moved from qwen2.5:7b to claude-haiku-4-5.
    private const string DefaultPipelineVersion = "v3-dialcolour-haiku-nomic-768";

    // Backstop for drift no version bump accounts for — a repriced watch, a re-scrape. Entries
    // older than this are ignored even when the version still matches.
    private const int DefaultMaxAgeDays = 30;

    private readonly string _pipelineVersion;
    private readonly TimeSpan _maxAge;

    public QueryCacheService(TourbillonContext context, ILogger<QueryCacheService> logger,
        IConfiguration? config = null)
    {
        _context = context;
        _logger = logger;
        _pipelineVersion = config?["QueryCache:Version"] ?? DefaultPipelineVersion;
        _maxAge = TimeSpan.FromDays(
            config?.GetValue<int?>("QueryCache:MaxAgeDays") ?? DefaultMaxAgeDays);
    }

    /// Finds the nearest cached result by cosine similarity, scoped to a feature.
    /// Returns null on miss or if similarity is below threshold.
    public async Task<WatchFinderResult?> LookupAsync(float[] queryEmbedding, string feature = "watch_finder")
    {
        var queryVector = new Vector(queryEmbedding);

        // ORDER BY cosine distance within the feature scope — pgvector translates to <=> operator.
        // FirstOrDefaultAsync handles the empty-set case directly, no need for a separate CountAsync.
        // Version and age filter before the nearest-neighbour scan, not after: an expired or
        // wrong-version entry must not win the ordering and shadow a valid one behind it.
        var cutoff = DateTime.UtcNow - _maxAge;
        var nearest = await _context.QueryCaches
            .Where(q => q.Feature == feature
                && q.PipelineVersion == _pipelineVersion
                && q.CreatedAt >= cutoff)
            .OrderBy(q => q.QueryEmbedding.CosineDistance(queryVector))
            .FirstOrDefaultAsync();

        if (nearest?.QueryEmbedding == null) return null;

        // Verify threshold in C# — cosine similarity = 1 - cosine distance
        var similarity = CosineSimilarity(nearest.QueryEmbedding.Memory.Span, queryEmbedding);
        if (similarity < SimilarityThreshold)
        {
            _logger.LogInformation(
                "QueryCache near-miss similarity={Similarity:F3} threshold={Threshold:F2} feature={Feature}",
                similarity, SimilarityThreshold, feature);
            return null;
        }

        _logger.LogInformation("QueryCache hit similarity={Similarity:F3} feature={Feature}",
            similarity, feature);
        return JsonSerializer.Deserialize<WatchFinderResult>(nearest.ResultJson, _jsonOptions);
    }

    /// Stores a query result in the cache, tagged by feature. Skips if a very similar entry already exists.
    public async Task StoreAsync(string queryText, float[] queryEmbedding, WatchFinderResult result, string feature = "watch_finder")
    {
        try
        {
            // Don't duplicate if already cached (similarity > 0.99 = near-identical)
            var existing = await LookupAsync(queryEmbedding, feature);
            if (existing != null) return;

            // Strip ParsedIntent — it's object? and complicates serialisation
            var toCache = new WatchFinderResult
            {
                Watches = result.Watches,
                OtherCandidates = result.OtherCandidates,
                MatchDetails = result.MatchDetails,
                ParsedIntent = null,
                // Keep the originating path so a later cache hit can report what produced it.
                SearchPath = result.SearchPath,
            };

            _context.QueryCaches.Add(new QueryCache
            {
                QueryText = queryText,
                QueryEmbedding = new Vector(queryEmbedding),
                ResultJson = JsonSerializer.Serialize(toCache, _jsonOptions),
                Feature = feature,
                PipelineVersion = _pipelineVersion,
                CreatedAt = DateTime.UtcNow,
            });

            await _context.SaveChangesAsync();
            _logger.LogDebug("Cached result for '{Query}'", queryText);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to cache query '{Query}': {Err}", queryText, ex.Message);
        }
    }

    /// Returns total number of cached queries, optionally scoped to a feature.
    public async Task<int> GetCountAsync(string? feature = null) =>
        feature == null
            ? await _context.QueryCaches.CountAsync()
            : await _context.QueryCaches.Where(q => q.Feature == feature).CountAsync();

    /// Clears all cached query results.
    public async Task ClearAsync()
    {
        _context.QueryCaches.RemoveRange(_context.QueryCaches);
        await _context.SaveChangesAsync();
    }

    // Cosine similarity from pre-normalised vectors (nomic-embed-text outputs L2-normalised vectors).
    private static float CosineSimilarity(ReadOnlySpan<float> a, float[] b)
    {
        float dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot   += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        var denom = MathF.Sqrt(normA) * MathF.Sqrt(normB);
        return denom == 0 ? 0 : dot / denom;
    }
}
