// Orchestrates the AI Watch Finder pipeline:
// Phase 3B: embed query → vector similarity search → LLM rerank
// Fallback (embed unavailable): LLM parse → SQL filter → LLM rerank

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace backend.Services;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record WatchFinderRequest(string Query);

public record ExplainWatchRequest(string Query, int WatchId);

public class ParsedIntent
{
    public string? Occasion { get; set; }
    public string? Style { get; set; }
    public List<string> Material { get; set; } = [];
    public decimal? MaxPrice { get; set; }
    public decimal? MinPrice { get; set; }
    public double? MaxThicknessMm { get; set; }
    public double? MaxDiameterMm { get; set; }
    public string? Strap { get; set; }
    public string? Movement { get; set; }
    public List<string> Complications { get; set; } = [];
}

public class WatchMatchDetail
{
    public int Score { get; set; }
}

public class WatchFinderResult
{
    public List<WatchDto> Watches { get; set; } = [];
    public List<WatchDto> OtherCandidates { get; set; } = [];
    public Dictionary<int, WatchMatchDetail> MatchDetails { get; set; } = [];
    public object? ParsedIntent { get; set; }
}

// ── Service ───────────────────────────────────────────────────────────────────

public class WatchFinderService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly WatchFilterMapper _mapper;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly QueryCacheService _queryCache;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public WatchFinderService(
        IHttpClientFactory httpClientFactory,
        TourbillonContext context,
        WatchFilterMapper mapper,
        IServiceScopeFactory scopeFactory,
        QueryCacheService queryCache)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _mapper = mapper;
        _scopeFactory = scopeFactory;
        _queryCache = queryCache;
    }

    public async Task<WatchFinderResult> FindWatchesAsync(string query)
    {
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        // Step 0: embed query + check QueryCache.
        // nomic-embed-text (~50ms) runs independently of the LLM.
        var queryEmbedding = await EmbedQueryAsync(httpClient, query);
        if (queryEmbedding != null)
        {
            var cached = await _queryCache.LookupAsync(queryEmbedding);
            if (cached != null) return cached;
        }

        // Step 1: retrieve candidates.
        // Phase 3B — vector similarity against WatchEmbeddings (4 chunks per watch).
        // Each watch's best-matching chunk is used; top 30 by cosine distance returned.
        // Fallback to LLM parse + SQL filter if embeddings are unavailable.
        List<Watch> candidates;
        ParsedIntent? intent = null;

        if (queryEmbedding != null)
        {
            candidates = await VectorSearchAsync(queryEmbedding);
        }
        else
        {
            // Embed unavailable — fall back to Phase 2 pipeline
            var parseTask = ParseIntentAsync(httpClient, query);
            var dbTask    = _context.Watches.Include(w => w.Brand).AsNoTracking().ToListAsync();
            await Task.WhenAll(parseTask, dbTask);
            intent = await parseTask;
            var allWatches = await dbTask;
            var filtered = (intent != null ? _mapper.Apply(allWatches, intent) : allWatches).ToList();
            candidates = BrandSpread(filtered, 100);
        }

        // Base result — returned as-is if rerank fails (all candidates, no split)
        var result = new WatchFinderResult
        {
            Watches = candidates.Select(w => WatchDto.FromWatch(w)).ToList(),
            OtherCandidates = [],
            MatchDetails = [],
            ParsedIntent = intent
        };

        if (candidates.Count == 0) return result;

        // Step 4: rerank candidates via AI service
        // Send only the top 40 by vector similarity to the LLM — beyond that, quality degrades
        // and latency climbs linearly. The remaining candidates become OtherCandidates as-is.
        const int RerankLimit = 40;
        var rerankCandidates = candidates.Take(RerankLimit).ToList();
        var unscoredCandidates = candidates.Skip(RerankLimit).ToList();

        try
        {
            var payload = rerankCandidates.Select(w =>
            {
                var specs = DeserialiseSpecs(w.Specs);
                return new
                {
                    id = w.Id,
                    name = w.Name,
                    brand = w.Brand?.Name ?? "",
                    description = w.Description ?? "",
                    price = (double)w.CurrentPrice,
                    specs_summary = BuildSpecsSummary(specs)
                };
            });

            var rerankResp = await httpClient.PostAsJsonAsync("/watch-finder/rerank", new { query, watches = payload });
            if (rerankResp.IsSuccessStatusCode)
            {
                var json = await rerankResp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("ranked", out var rankedEl))
                {
                    var ranked   = JsonSerializer.Deserialize<List<RankedWatch>>(rankedEl.GetRawText(), _jsonOptions) ?? [];
                    var scoreMap = ranked.ToDictionary(r => r.WatchId);

                    // Top matches: capped at 20, minimum score 60 (fallback: relax threshold if fewer than 3)
                    const int TopMatchLimit = 20;
                    const int MinScoreThreshold = 60;

                    var scoredAndOrdered = rerankCandidates
                        .Where(w => scoreMap.ContainsKey(w.Id))
                        .OrderByDescending(w => scoreMap[w.Id].Score)
                        .ToList();

                    var topMatches = scoredAndOrdered
                        .Where(w => scoreMap[w.Id].Score >= MinScoreThreshold)
                        .Take(TopMatchLimit)
                        .ToList();

                    if (topMatches.Count < 3)
                        topMatches = scoredAndOrdered.Take(Math.Min(TopMatchLimit, scoredAndOrdered.Count)).ToList();

                    var topMatchIds = new HashSet<int>(topMatches.Select(w => w.Id));

                    result.Watches = topMatches.Select(w => WatchDto.FromWatch(w)).ToList();

                    // Non-top reranked candidates (lower-scored first), then the vector-tail that was never reranked
                    result.OtherCandidates = rerankCandidates
                        .Where(w => !topMatchIds.Contains(w.Id))
                        .OrderByDescending(w => scoreMap.ContainsKey(w.Id) ? scoreMap[w.Id].Score : -1)
                        .Concat(unscoredCandidates)
                        .Select(w => WatchDto.FromWatch(w))
                        .ToList();

                    result.MatchDetails = topMatches.ToDictionary(
                        w => w.Id,
                        w => new WatchMatchDetail
                        {
                            Score = scoreMap[w.Id].Score
                        });
                }
            }
        }
        catch { /* AI service unreachable — return unranked filtered results */ }

        // Fire-and-forget: generate embeddings for all returned watches in background.
        // A new scope is created so the background task doesn't share the request's DbContext.
        var idsToEmbed = result.Watches
            .Concat(result.OtherCandidates)
            .Select(w => w.Id)
            .ToList();

        if (idsToEmbed.Count > 0)
        {
            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var embeddingService = scope.ServiceProvider.GetRequiredService<WatchEmbeddingService>();
                await embeddingService.GenerateBulkAsync(idsToEmbed);
            });
        }

        // Fire-and-forget: store the result in the persistent query cache.
        // New scope required — cannot reuse the request's DbContext on a background thread.
        if (queryEmbedding != null)
        {
            var capturedEmbedding = queryEmbedding;
            var capturedResult = result;
            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var cacheService = scope.ServiceProvider.GetRequiredService<QueryCacheService>();
                await cacheService.StoreAsync(query, capturedEmbedding, capturedResult);
            });
        }

        return result;
    }

    // Phase 3B retrieval: cosine similarity search against all watch chunk embeddings.
    // For each watch, the best-matching chunk wins. Returns top 30 watches in similarity order.
    private async Task<List<Watch>> VectorSearchAsync(float[] queryEmbedding)
    {
        var queryVector = new Vector(queryEmbedding);

        // Order all chunks by cosine distance — best chunk per watch floats to the top.
        // Selecting only WatchId keeps the query lightweight (no 768-float vectors transferred).
        var orderedIds = await _context.WatchEmbeddings
            .Where(e => e.Embedding != null)
            .OrderBy(e => e.Embedding!.CosineDistance(queryVector))
            .Select(e => e.WatchId)
            .ToListAsync();

        // Deduplicate in memory preserving order — first occurrence = best chunk for that watch
        var seen   = new HashSet<int>();
        var topIds = new List<int>(100);
        foreach (var id in orderedIds)
        {
            if (seen.Add(id))
            {
                topIds.Add(id);
                if (topIds.Count >= 100) break;
            }
        }

        if (topIds.Count == 0)
            return [];

        // Load the Watch objects, then restore similarity order (IN clause has no guaranteed order)
        var watches   = await _context.Watches
            .Include(w => w.Brand)
            .AsNoTracking()
            .Where(w => topIds.Contains(w.Id))
            .ToListAsync();

        var watchById = watches.ToDictionary(w => w.Id);
        return topIds.Where(id => watchById.ContainsKey(id)).Select(id => watchById[id]).ToList();
    }

    // Embeds the query text using nomic-embed-text via ai-service.
    // Returns null if the embed call fails — callers treat null as cache unavailable.
    private async Task<float[]?> EmbedQueryAsync(HttpClient httpClient, string query)
    {
        try
        {
            var resp = await httpClient.PostAsJsonAsync("/embed", new { texts = new[] { query } });
            if (!resp.IsSuccessStatusCode) return null;
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            if (!json.TryGetProperty("embeddings", out var embEl)) return null;
            var embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
            return embeddings?.Count > 0 ? embeddings[0] : null;
        }
        catch { return null; }
    }

    // Parse intent from AI service — runs concurrently with DB load
    private async Task<ParsedIntent?> ParseIntentAsync(HttpClient httpClient, string query)
    {
        try
        {
            var parseResp = await httpClient.PostAsJsonAsync("/watch-finder/parse", new { query });
            if (!parseResp.IsSuccessStatusCode) return null;
            var json = await parseResp.Content.ReadFromJsonAsync<JsonElement>();
            if (json.TryGetProperty("intent", out var intentEl))
                return JsonSerializer.Deserialize<ParsedIntent>(intentEl.GetRawText(), _jsonOptions);
        }
        catch { /* AI service unreachable — continue with null intent */ }
        return null;
    }

    // Round-robin across brands to ensure variety in the candidate pool
    private static List<Watch> BrandSpread(List<Watch> watches, int max)
    {
        var byBrand = watches.GroupBy(w => w.BrandId).Select(g => g.ToList()).ToList();
        var result = new List<Watch>();
        int i = 0;
        while (result.Count < max && byBrand.Any(b => i < b.Count))
        {
            foreach (var brand in byBrand)
            {
                if (i < brand.Count) result.Add(brand[i]);
                if (result.Count >= max) break;
            }
            i++;
        }
        return result;
    }

    private static string BuildSpecsSummary(WatchSpecs? specs)
    {
        if (specs == null) return "";
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(specs.Case?.Material))   parts.Add(specs.Case.Material);
        if (!string.IsNullOrEmpty(specs.Case?.Diameter))   parts.Add(specs.Case.Diameter);
        if (!string.IsNullOrEmpty(specs.Case?.Thickness))  parts.Add($"{specs.Case.Thickness} thick");
        if (!string.IsNullOrEmpty(specs.Movement?.Type))   parts.Add(specs.Movement.Type);
        if (!string.IsNullOrEmpty(specs.Dial?.Color))      parts.Add($"{specs.Dial.Color} dial");
        if (!string.IsNullOrEmpty(specs.Strap?.Material))  parts.Add(specs.Strap.Material);
        return string.Join(", ", parts);
    }

    private static WatchSpecs? DeserialiseSpecs(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try { return JsonSerializer.Deserialize<WatchSpecs>(specsJson); }
        catch { return null; }
    }

    // Maps the ai-service rerank response shape (scores only — no explanation)
    private class RankedWatch
    {
        [JsonPropertyName("watch_id")]
        public int WatchId { get; set; }

        [JsonPropertyName("score")]
        public int Score { get; set; }
    }
}
