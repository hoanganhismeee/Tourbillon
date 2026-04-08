// Orchestrates the AI Watch Finder pipeline:
// Phase 3B: embed query → vector similarity search → LLM rerank
// Hybrid filtering: ParseQueryIntentAsync extracts brand/collection/price as hard SQL pre-filters.
// Fallback (embed unavailable): LLM parse → SQL filter → LLM rerank

using Hangfire;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace backend.Services;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record WatchFinderRequest(string Query);

public record ExplainWatchRequest(string Query, int WatchId);

/// LLM-parsed intent from /watch-finder/parse — full structured output from the model.
/// All fields are optional; null means the query didn't mention or imply that constraint.
public class ParsedIntent
{
    public List<string> Brands { get; set; } = [];
    public string? Collection { get; set; }
    public string? Style { get; set; }
    public List<string> Material { get; set; } = [];
    public decimal? MaxPrice { get; set; }
    public decimal? MinPrice { get; set; }
    public double? MaxThicknessMm { get; set; }
    public double? MinDiameterMm { get; set; }
    public double? MaxDiameterMm { get; set; }
    public string? Strap { get; set; }
    public string? Movement { get; set; }
    public List<string> Complications { get; set; } = [];
    public int? WaterResistanceMin { get; set; }
    public int? PowerReserveHours { get; set; }
}

public class WatchMatchDetail
{
    public int Score { get; set; }
}

/// Structured intent parsed from the raw query text — used for hard SQL pre-filters
/// and returned to the frontend to pre-populate the filter bar.
public class QueryIntent
{
    public int? BrandId { get; set; }
    public int? CollectionId { get; set; }
    /// Multi-collection filter — populated when one or more collection names are matched,
    /// including fuzzy typo-tolerant matches. CollectionId remains for single exact matches.
    public List<int> CollectionIds { get; set; } = [];
    public decimal? MaxPrice { get; set; }
    public decimal? MinPrice { get; set; }
    /// Parsed diameter range in mm — frontend uses these to pre-select the Diameter filter.
    /// Not applied as SQL WHERE (diameter is stored in Watch.Specs JSON, not a column).
    public double? MinDiameterMm { get; set; }
    public double? MaxDiameterMm { get; set; }
    /// Spec-level filters — frontend uses these to pre-select filter bar dropdowns.
    /// Not applied as SQL WHERE (stored in Watch.Specs JSON, not columns).
    public string? CaseMaterial { get; set; }
    public string? MovementType { get; set; }
    public string? WaterResistance { get; set; }
    /// Style category — "sport", "dress", "diver". Resolved to collection IDs via DB taxonomy.
    /// Applied as SQL WHERE CollectionId IN (collections with matching Style).
    public string? Style { get; set; }
    /// Multi-brand filter — populated when 2+ brands are named in the query.
    /// Applied as SQL WHERE BrandId IN (ids). Exclusive with BrandId (single-brand path).
    public List<int> BrandIds { get; set; } = [];
    /// Complication labels from query text (e.g. "Chronograph", "Perpetual Calendar").
    /// Client-side filter only — complications live in Watch.Specs JSON, not a DB column.
    /// Labels must match frontend COMPLICATION_OPTIONS labels exactly.
    public List<string> Complications { get; set; } = [];
    /// Power reserve bucket labels from query text (e.g. "48h – 72h", "Over 100h").
    /// Client-side filter only. Labels must match frontend POWER_RESERVE_OPTIONS exactly.
    public List<string> PowerReserves { get; set; } = [];
    /// Water resistance bucket labels resolved from the query (e.g. "50m – 120m", "150m – 300m").
    /// When the user says "good water resistance" this contains all buckets except "Up to 30m".
    /// Client-side filter only. Labels must match frontend WATER_RESISTANCE_BUCKETS exactly.
    public List<string> WaterResistanceBuckets { get; set; } = [];
}

public record SmartSearchFilterState(
    List<int> BrandIds,
    List<int> CollectionIds,
    List<string> PriceBuckets,
    List<string> DiameterBuckets,
    List<string> WaterResistances,
    List<string> CaseMaterials,
    List<string> Complications,
    List<string> PowerReserves);

public class WatchFinderResult
{
    public List<WatchDto> Watches { get; set; } = [];
    public List<WatchDto> OtherCandidates { get; set; } = [];
    public Dictionary<int, WatchMatchDetail> MatchDetails { get; set; } = [];
    public object? ParsedIntent { get; set; }
    /// Structured intent extracted from query text — brand/collection/price hard constraints.
    public QueryIntent? QueryIntent { get; set; }
}

// ── Service ───────────────────────────────────────────────────────────────────

public class WatchFinderService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly WatchFilterMapper _mapper;
    private readonly QueryCacheService _queryCache;
    private readonly ILogger<WatchFinderService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    // Tiered routing thresholds (cosine distance: 0 = identical, 1 = orthogonal)
    private const float SkipLlmDistance  = 0.20f; // Tier 2: strong match — skip LLM rerank
    private const float MaxDistance      = 0.55f; // Tier 4: filter no-matches in DB
    private const float MinRelevance     = 0.35f; // reject results when best match is worse than this

    // Rerank sizing — smaller set = fewer LLM output tokens = faster inference
    private const int RerankLimit        = 15;    // max candidates sent to LLM (was 40)
    private const int TopMatchLimit      = 15;    // max results in Watches (was 20)
    private const int MinScoreThreshold  = 60;    // min LLM score to appear in top matches

    public WatchFinderService(
        IHttpClientFactory httpClientFactory,
        TourbillonContext context,
        WatchFilterMapper mapper,
        QueryCacheService queryCache,
        ILogger<WatchFinderService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _mapper = mapper;
        _queryCache = queryCache;
        _logger = logger;
    }

    public async Task<WatchFinderResult> FindWatchesAsync(string query)
    {
        var deterministicIntent = await ParseQueryIntentAsync(query);
        if (deterministicIntent == null && !HasWatchDomainSignal(query))
        {
            _logger.LogInformation("WatchFinder ignored non-watch query={QueryPreview}",
                query.Length > 60 ? query[..60] + "..." : query);
            return EmptyResult();
        }

        var directResult = await TryDirectSqlSearchAsync(query, deterministicIntent);
        if (directResult != null)
            return directResult;

        var httpClient = _httpClientFactory.CreateClient("ai-service");

        // Steps 0a + 0b run in parallel — LLM parse and embedding have similar latency (~200ms each).
        // LLM parse replaces the old regex approach: the model understands nuanced phrasing,
        // multi-brand queries, and all filter dimensions without hardcoded patterns.
        var parseTask = ParseIntentFromLlmAsync(httpClient, query, deterministicIntent);
        var embedTask = EmbedQueryAsync(httpClient, query);
        await Task.WhenAll(parseTask, embedTask);

        var queryIntent   = await parseTask;
        var queryEmbedding = await embedTask;

        // Skip cache when hard SQL filters are active (price or brand) — a cached
        // "dress watch" result must not be reused for "Vacheron dress watch".
        var hasHardFilters = queryIntent?.BrandId != null || queryIntent?.CollectionId != null
            || queryIntent?.MaxPrice != null || queryIntent?.MinPrice != null
            || queryIntent?.BrandIds?.Count > 0
            || queryIntent?.CollectionIds?.Count > 0;
        if (queryEmbedding != null && !hasHardFilters)
        {
            var cached = await _queryCache.LookupAsync(queryEmbedding);
            if (cached != null)
            {
                _logger.LogInformation("WatchFinder cache hit query={QueryPreview}",
                    query.Length > 60 ? query[..60] + "…" : query);
                cached.QueryIntent = queryIntent;
                return cached;
            }
        }

        // Step 1: retrieve candidates via vector similarity.
        // Hard SQL pre-filters: price, single-brand, and multi-brand constraints.
        // Everything else (style, water resistance, complications) is soft — pre-populates the
        // frontend filter bar but does not remove candidates from the pool.
        List<Watch> candidates;
        float bestDistance = float.MaxValue;

        if (queryEmbedding != null)
        {
            (candidates, bestDistance) = await VectorSearchAsync(queryEmbedding, queryIntent);

            // Brand fallback: if vector search returned nothing but a specific brand was requested,
            // the query embedding likely diverged from watch descriptions (e.g. unusual phrasing).
            // Load watches for that brand directly so the user sees something to rerank.
            if (candidates.Count == 0 && queryIntent != null
                && (queryIntent.BrandId != null || queryIntent.BrandIds.Count > 0))
            {
                var brandFilter = queryIntent.BrandId != null
                    ? new[] { queryIntent.BrandId.Value }
                    : queryIntent.BrandIds.ToArray();
                var fallbackQuery = _context.Watches
                    .Include(w => w.Brand)
                    .Include(w => w.Collection)
                    .AsNoTracking()
                    .Where(w => brandFilter.Contains(w.BrandId));

                if (queryIntent.CollectionId != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CollectionId == queryIntent.CollectionId);
                if (queryIntent.CollectionIds.Count > 0)
                    fallbackQuery = fallbackQuery.Where(w => w.CollectionId != null && queryIntent.CollectionIds.Contains(w.CollectionId.Value));
                if (queryIntent.MaxPrice != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= queryIntent.MaxPrice);
                if (queryIntent.MinPrice != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= queryIntent.MinPrice);

                if (queryIntent.Style != null && !HasCollectionIntent(queryIntent))
                {
                    var fallbackStyleCollectionIds = await _context.Collections
                        .Where(c => c.Style == queryIntent.Style)
                        .Select(c => c.Id)
                        .ToListAsync();
                    if (fallbackStyleCollectionIds.Count > 0)
                        fallbackQuery = fallbackQuery.Where(w => w.CollectionId != null && fallbackStyleCollectionIds.Contains(w.CollectionId.Value));
                }

                candidates = await fallbackQuery
                    .OrderByDescending(w => w.Id)
                    .Take(TopMatchLimit * 2)
                    .ToListAsync();
                bestDistance = 0.5f; // treat as Tier 3 so LLM rerank orders by relevance
                _logger.LogInformation(
                    "WatchFinder brand fallback — vector miss, loaded {Count} watches for brandIds=[{Ids}]",
                    candidates.Count, string.Join(",", brandFilter));
            }
        }
        else
        {
            // Embed unavailable — fall back to broad DB load ranked by intent
            _logger.LogWarning("WatchFinder Tier4 fallback — embeddings unavailable query={QueryPreview}",
                query.Length > 60 ? query[..60] + "…" : query);
            var allWatches = await _context.Watches
                .Include(w => w.Brand).Include(w => w.Collection).AsNoTracking().ToListAsync();
            // Re-use the ParsedIntent we already have from the parallel parse call (or fetch if null)
            ParsedIntent? fallbackIntent = null;
            if (queryIntent != null)
            {
                // Reconstruct a minimal ParsedIntent from QueryIntent for the mapper
                fallbackIntent = new ParsedIntent
                {
                    MaxPrice = queryIntent.MaxPrice,
                    MinPrice = queryIntent.MinPrice,
                    Style    = queryIntent.Style,
                };
            }
            var filtered = (fallbackIntent != null ? _mapper.Apply(allWatches, fallbackIntent) : allWatches).ToList();
            candidates = BrandSpread(filtered, 100);
        }

        // Base result: top TopMatchLimit by vector/filter order, rest as OtherCandidates.
        // Returned as-is for Tier 2 (strong vector match) and as LLM-fail fallback.
        var result = new WatchFinderResult
        {
            Watches = candidates.Take(TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
            OtherCandidates = candidates.Skip(TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
            MatchDetails = [],
            ParsedIntent = null
        };

        result.QueryIntent = queryIntent;
        if (candidates.Count == 0)
        {
            _logger.LogInformation("WatchFinder zero candidates query={QueryPreview}",
                query.Length > 60 ? query[..60] + "…" : query);
            return result;
        }

        // Tier routing: Tier 2 = strong vector match (skip rerank), Tier 3 = LLM rerank
        var tier = bestDistance < SkipLlmDistance ? 2 : 3;
        _logger.LogInformation(
            "WatchFinder Tier{Tier} bestDistance={BestDistance:F3} candidates={CandidateCount}",
            tier, bestDistance, candidates.Count);

        // Tier 3: LLM rerank — skipped when vector match is already decisive (Tier 2)
        if (bestDistance >= SkipLlmDistance)
        {
        var rerankCandidates   = candidates.Take(RerankLimit).ToList();
        var unscoredCandidates = candidates.Skip(RerankLimit).ToList();

        var rerankSw = System.Diagnostics.Stopwatch.StartNew();
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
                    collection = w.Collection?.Name ?? "",
                    description = w.Description ?? "",
                    price = (double)w.CurrentPrice,
                    specs_summary = BuildSpecsSummary(specs)
                };
            });

            var rerankResp = await httpClient.PostAsJsonAsync("/watch-finder/rerank", new { query, watches = payload });
            if (rerankResp.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "WatchFinder rerank {ElapsedMs}ms candidates={CandidateCount}",
                    rerankSw.ElapsedMilliseconds, rerankCandidates.Count);
                var json = await rerankResp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("ranked", out var rankedEl))
                {
                    var ranked   = JsonSerializer.Deserialize<List<RankedWatch>>(rankedEl.GetRawText(), _jsonOptions) ?? [];
                    var scoreMap = ranked.ToDictionary(r => r.WatchId);

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
        catch (Exception ex)
        {
            rerankSw.Stop();
            _logger.LogWarning(ex,
                "WatchFinder rerank threw after {ElapsedMs}ms — returning unranked results",
                rerankSw.ElapsedMilliseconds);
        }

        } // end Tier 3 rerank

        // Enqueue embedding generation for all returned watches as a durable Hangfire job.
        var idsToEmbed = result.Watches
            .Concat(result.OtherCandidates)
            .Select(w => w.Id)
            .ToList();

        if (idsToEmbed.Count > 0)
            BackgroundJob.Enqueue<WatchEmbeddingService>(x => x.GenerateBulkAsync(idsToEmbed));

        // Attach structured intent to result — frontend uses this to pre-populate filter bar.
        result.QueryIntent = queryIntent;

        // Enqueue query cache store as a durable Hangfire job.
        if (queryEmbedding != null)
            BackgroundJob.Enqueue<QueryCacheService>(x =>
                x.StoreAsync(query, queryEmbedding, result, "watch_finder"));

        return result;
    }

    private static WatchFinderResult EmptyResult(QueryIntent? intent = null) => new()
    {
        Watches = [],
        OtherCandidates = [],
        MatchDetails = [],
        ParsedIntent = null,
        QueryIntent = intent
    };

    private static bool HasCollectionIntent(QueryIntent? intent) =>
        intent?.CollectionId != null || intent?.CollectionIds.Count > 0;

    private async Task<WatchFinderResult?> TryDirectSqlSearchAsync(string query, QueryIntent? intent)
    {
        var isReferenceQuery = IsLikelyReferenceQuery(query);
        var hasEntityIntent = intent?.BrandId != null || intent?.BrandIds.Count > 0
            || intent?.CollectionId != null || intent?.CollectionIds.Count > 0;

        if (!isReferenceQuery && !hasEntityIntent)
            return null;

        var q = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .AsQueryable();

        if (intent?.BrandId != null)
            q = q.Where(w => w.BrandId == intent.BrandId);
        if (intent?.BrandIds.Count > 0)
            q = q.Where(w => intent.BrandIds.Contains(w.BrandId));
        if (intent?.CollectionId != null)
            q = q.Where(w => w.CollectionId == intent.CollectionId);
        if (intent?.CollectionIds.Count > 0)
            q = q.Where(w => w.CollectionId != null && intent.CollectionIds.Contains(w.CollectionId.Value));
        if (intent?.MaxPrice != null)
            q = q.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= intent.MaxPrice);
        if (intent?.MinPrice != null)
            q = q.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= intent.MinPrice);

        var candidates = isReferenceQuery
            ? await q.ToListAsync()
            : await q.Take(300).ToListAsync();
        if (candidates.Count == 0)
            return hasEntityIntent ? EmptyResult(intent) : null;

        var ranked = candidates
            .Select(w => new { Watch = w, Score = DirectSqlScore(query, w, intent, isReferenceQuery) })
            .Where(x => !isReferenceQuery || x.Score >= 900)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
            .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
            .Select(x => x.Watch)
            .ToList();

        if (ranked.Count == 0)
            return isReferenceQuery && !hasEntityIntent ? null : EmptyResult(intent);

        _logger.LogInformation(
            "WatchFinder direct SQL path query={QueryPreview} candidates={CandidateCount}",
            query.Length > 60 ? query[..60] + "..." : query,
            ranked.Count);

        return new WatchFinderResult
        {
            Watches = ranked.Take(TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
            OtherCandidates = ranked.Skip(TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
            MatchDetails = [],
            ParsedIntent = null,
            QueryIntent = intent
        };
    }

    internal static int DirectSqlScore(string query, Watch watch, QueryIntent? intent, bool isReferenceQuery)
    {
        var queryKey = NormaliseEntityText(query);
        var watchNameKey = NormaliseEntityText(watch.Name);
        var collectionKey = NormaliseEntityText(watch.Collection?.Name ?? "");
        var brandKey = NormaliseEntityText(watch.Brand?.Name ?? "");

        var score = 0;
        if (isReferenceQuery)
        {
            if (watchNameKey == queryKey) score += 1200;
            else if (watchNameKey.Contains(queryKey) || queryKey.Contains(watchNameKey)) score += 950;
            else if (queryKey.Length >= 8 && watchNameKey.Contains(queryKey[..Math.Min(queryKey.Length, 12)])) score += 900;
        }

        if (intent?.BrandId == watch.BrandId || intent?.BrandIds.Contains(watch.BrandId) == true)
            score += 80;
        if (watch.CollectionId != null &&
            (intent?.CollectionId == watch.CollectionId || intent?.CollectionIds.Contains(watch.CollectionId.Value) == true))
            score += 120;

        foreach (var token in TokenizeQuery(query))
        {
            if (watchNameKey.Contains(token)) score += 30;
            if (collectionKey.Contains(token)) score += 45;
            if (brandKey.Contains(token)) score += 25;
        }

        if (watch.CurrentPrice > 0) score += 5;
        return score;
    }

    // Phase 3B retrieval: cosine similarity search against watch chunk embeddings.
    // Applies hard SQL pre-filters from QueryIntent (brand/collection/price) before cosine ranking.
    // Deduplicates chunks per watch in memory and returns best distance.
    private async Task<(List<Watch> Watches, float BestDistance)> VectorSearchAsync(float[] queryEmbedding, QueryIntent? intent)
    {
        var queryVector = new Vector(queryEmbedding);

        // Base query: feature-scoped, distance-filtered, ordered by cosine similarity.
        // Join Watch via Include so brand/collection/price filters can reference Watch columns.
        var q = _context.WatchEmbeddings
            .Include(e => e.Watch)
            .Where(e => e.Feature == "watch_finder" && e.Embedding != null && e.Embedding.CosineDistance(queryVector) < MaxDistance);

        // Hard SQL pre-filters from parsed intent — eliminate irrelevant candidates entirely.
        // Price 0 = "Price on Request"; never exclude PoR watches from a price-filtered search.
        if (intent?.BrandId      != null) q = q.Where(e => e.Watch.BrandId      == intent.BrandId);
        if (intent?.BrandIds?.Count > 0)  q = q.Where(e => intent.BrandIds.Contains(e.Watch.BrandId));
        if (intent?.CollectionId != null) q = q.Where(e => e.Watch.CollectionId == intent.CollectionId);
        if (intent?.CollectionIds?.Count > 0) q = q.Where(e => e.Watch.CollectionId != null && intent.CollectionIds.Contains(e.Watch.CollectionId.Value));
        if (intent?.MaxPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice <= intent.MaxPrice);
        if (intent?.MinPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice >= intent.MinPrice);

        // Style filter: resolve style → tagged collection IDs → SQL IN.
        // Hard filter only when collection tags exist for that style — graceful degradation
        // if no collections are tagged (filter silently skips, vector + rerank handle style).
        // Untagged collections are not excluded — they surface as candidates naturally.
        List<int> styleCollectionIds = [];
        if (intent?.Style != null && !HasCollectionIntent(intent))
        {
            styleCollectionIds = await _context.Collections
                .Where(c => c.Style == intent.Style)
                .Select(c => c.Id)
                .ToListAsync();
            if (styleCollectionIds.Count > 0)
                q = q.Where(e => e.Watch.CollectionId != null
                              && styleCollectionIds.Contains((int)e.Watch.CollectionId));
        }

        // Push distance order and LIMIT to DB — project WatchId + distance in one round-trip.
        var orderedRows = await q
            .OrderBy(e => e.Embedding!.CosineDistance(queryVector))
            .Select(e => new { e.WatchId, Distance = (float)e.Embedding!.CosineDistance(queryVector) })
            .Take(150)
            .ToListAsync();

        // Deduplicate in memory preserving order — first occurrence = best chunk for that watch
        var seen      = new HashSet<int>();
        var topIds    = new List<int>(50);
        float bestDist = float.MaxValue;
        foreach (var row in orderedRows)
        {
            if (seen.Add(row.WatchId))
            {
                if (topIds.Count == 0) bestDist = row.Distance;
                topIds.Add(row.WatchId);
                if (topIds.Count >= 50) break;
            }
        }

        // When hard SQL filters narrow the pool, skip the MinRelevance quality gate
        // (that gate exists only to reject noise in fully unconstrained open queries).
        var hasHardFilters = intent?.BrandId != null || intent?.CollectionId != null
            || intent?.MaxPrice != null || intent?.MinPrice != null
            || intent?.BrandIds?.Count > 0
            || intent?.CollectionIds?.Count > 0
            || styleCollectionIds.Count > 0;

        if (topIds.Count == 0 || (!hasHardFilters && bestDist >= MinRelevance))
            return ([], float.MaxValue);

        // Load Watch objects and restore similarity order (IN has no guaranteed order)
        var watches   = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => topIds.Contains(w.Id))
            .ToListAsync();

        var watchById = watches.ToDictionary(w => w.Id);
        var ordered   = topIds.Where(id => watchById.ContainsKey(id)).Select(id => watchById[id]).ToList();
        return (ordered, bestDist);
    }

    // Brand alias map — short names users commonly type to the canonical DB brand name.
    private static readonly Dictionary<string, string> _brandAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        // Abbreviations
        ["JLC"]  = "Jaeger-LeCoultre",
        ["AP"]   = "Audemars Piguet",
        ["VC"]   = "Vacheron Constantin",
        ["PP"]   = "Patek Philippe",
        ["ALS"]  = "A. Lange & Söhne",
        ["GS"]   = "Grand Seiko",
        ["GO"]   = "Glashütte Original",
        ["FC"]   = "Frederique Constant",
        // Common shorthand (first word or popular nickname)
        ["Vacheron"]   = "Vacheron Constantin",
        ["Patek"]      = "Patek Philippe",
        ["Audemars"]   = "Audemars Piguet",
        ["Lange"]      = "A. Lange & Söhne",
        ["Glashutte"]  = "Glashütte Original",
        ["Glashütte"]  = "Glashütte Original",
        ["Frederique"] = "Frederique Constant",
        ["FP Journe"]  = "F.P.Journe",
        ["FPJourne"]   = "F.P.Journe",
        ["Journe"]     = "F.P.Journe",
    };

    // LLM-based intent extraction — calls /watch-finder/parse and maps the result to QueryIntent.
    // Runs in parallel with EmbedQueryAsync. Returns null on parse failure (graceful degradation).
    private async Task<QueryIntent?> ParseIntentFromLlmAsync(HttpClient httpClient, string query, QueryIntent? deterministicIntent = null)
    {
        if (IsLikelyReferenceQuery(query))
            return deterministicIntent ?? await ParseQueryIntentAsync(query);

        ParsedIntent? parsed = null;
        try
        {
            parsed = await ParseIntentAsync(httpClient, query);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LLM intent parse failed — using deterministic fallback");
            return await ParseQueryIntentAsync(query);
        }

        if (parsed == null) return deterministicIntent;

        // Load brands + collections for name → ID resolution
        var brands      = await _context.Brands.AsNoTracking().ToListAsync();
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

        var llmIntent = MapParsedIntentToQueryIntent(parsed, brands, collections, query);
        return MergeIntentFallback(llmIntent, deterministicIntent, collections);
    }

    // Fill missing LLM fields with deterministic regex/alias extraction. The fallback parser is
    // intentionally conservative, so this restores explicit terms when the model misses them.
    private static QueryIntent? MergeIntentFallback(QueryIntent? primary, QueryIntent? fallback, List<Collection>? collections = null)
    {
        if (primary == null) return fallback;
        if (fallback == null) return primary;

        if (primary.BrandId == null && primary.BrandIds.Count == 0)
        {
            primary.BrandId = fallback.BrandId;
            primary.BrandIds = fallback.BrandIds;
        }

        ApplyCollectionMatches(primary, IntentCollections(fallback, collections));
        primary.MaxPrice ??= fallback.MaxPrice;
        primary.MinPrice ??= fallback.MinPrice;
        if (fallback.MinDiameterMm != null || fallback.MaxDiameterMm != null)
        {
            primary.MinDiameterMm = fallback.MinDiameterMm;
            primary.MaxDiameterMm = fallback.MaxDiameterMm;
        }
        primary.CaseMaterial ??= fallback.CaseMaterial;
        primary.MovementType ??= fallback.MovementType;
        primary.WaterResistance ??= fallback.WaterResistance;
        primary.Style ??= fallback.Style;

        if (primary.Complications.Count == 0) primary.Complications = fallback.Complications;
        if (primary.PowerReserves.Count == 0) primary.PowerReserves = fallback.PowerReserves;
        if (primary.WaterResistanceBuckets.Count == 0) primary.WaterResistanceBuckets = fallback.WaterResistanceBuckets;

        ReconcileCollectionBrandScope(primary, collections);
        return primary;
    }

    // Maps a ParsedIntent (LLM output) to a QueryIntent (hard SQL + soft frontend filters).
    // Hard SQL: price (explicit) and brand(s) (named). Everything else is soft.
    // query: raw user query text, used for brand alias fallback + style keyword check.
    private static QueryIntent? MapParsedIntentToQueryIntent(
        ParsedIntent parsed, List<Brand> brands, List<Collection> collections, string query)
    {
        var intent = new QueryIntent();

        // ── Price (always hard) ───────────────────────────────────────────────────
        intent.MaxPrice = parsed.MaxPrice;
        intent.MinPrice = parsed.MinPrice;

        // ── Brand resolution ──────────────────────────────────────────────────────
        // Step 1: match LLM-returned brand names against DB brands (substring, case-insensitive).
        var matchedBrands = (parsed.Brands ?? [])
            .Select(name => brands.FirstOrDefault(b =>
                b.Name.Contains(name, StringComparison.OrdinalIgnoreCase) ||
                name.Contains(b.Name, StringComparison.OrdinalIgnoreCase)))
            .Where(b => b != null)
            .ToList();

        // Step 2: fallback — also scan the raw query for brands the LLM may have missed.
        // Checks alias shortcuts (JLC, VC, etc.) then full DB brand names.
        var matched = new HashSet<int>(matchedBrands.Select(b => b!.Id));
        foreach (var (alias, canonical) in _brandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                var b = brands.FirstOrDefault(br => br.Name.Equals(canonical, StringComparison.OrdinalIgnoreCase));
                if (b != null && matched.Add(b.Id)) matchedBrands.Add(b);
            }
        }
        foreach (var brand in brands.OrderByDescending(b => b.Name.Length))
        {
            // Match full name OR first significant word (e.g. "Omega" from "Omega Watches")
            var first = brand.Name.Split(' ')[0];
            if ((query.Contains(brand.Name, StringComparison.OrdinalIgnoreCase)
                 || (first.Length >= 4 && Regex.IsMatch(query, @$"\b{Regex.Escape(first)}\b", RegexOptions.IgnoreCase)))
                && matched.Add(brand.Id))
            {
                matchedBrands.Add(brand);
            }
        }

        // Single brand: hard SQL BrandId filter + enables collection resolution.
        // Multi-brand: hard SQL BrandIds IN filter so only stated brands surface.
        if (matchedBrands.Count == 1)
            intent.BrandId = matchedBrands[0]!.Id;
        else if (matchedBrands.Count > 1)
            intent.BrandIds = matchedBrands.Select(b => b!.Id).Distinct().ToList();

        // ── Collection resolution ─────────────────────────────────────────────────
        // Only apply when a single brand was matched (scoped search).
        if (parsed.Collection != null && matchedBrands.Count == 1)
        {
            var pool = collections.Where(c => c.BrandId == matchedBrands[0]!.Id).ToList();
            var matchedCol = pool.FirstOrDefault(c =>
                c.Name.Contains(parsed.Collection, StringComparison.OrdinalIgnoreCase) ||
                parsed.Collection.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
            if (matchedCol != null)
                intent.CollectionId = matchedCol.Id;
        }

        ApplyCollectionMatches(
            intent,
            ResolveFuzzyCollections(query, collections, matchedBrands.Select(b => b!.Id).ToHashSet()));

        // ── Soft filters (frontend pre-population only) ───────────────────────────
        // Note: MovementType is intentionally omitted — the LLM infers it from complications
        // (e.g. tourbillon → Manual-winding) even when not explicitly stated, causing over-filtering.
        intent.Style = parsed.Style;

        // Style keyword fallback — style→collection taxonomy is an allowed deterministic mapping.
        // If the LLM missed an obvious style keyword ("sport watches", "dress watch", "diver"),
        // detect it from the raw query so the SQL style filter is always applied correctly.
        if (intent.Style == null)
        {
            var qLow = query.ToLowerInvariant();
            if (Regex.IsMatch(qLow, @"\bsport\s+watch"))      intent.Style = "sport";
            else if (Regex.IsMatch(qLow, @"\bdress\s+watch")) intent.Style = "dress";
            else if (Regex.IsMatch(qLow, @"\bdiv(?:er|e\s+watch|ing\s+watch)")) intent.Style = "diver";
        }
        intent.CaseMaterial  = NormaliseMaterial((parsed.Material ?? []).FirstOrDefault());
        intent.MinDiameterMm = parsed.MinDiameterMm;
        intent.MaxDiameterMm = parsed.MaxDiameterMm;
        intent.Complications = NormaliseComplications(parsed.Complications ?? []);
        intent.PowerReserves = NormalisePowerReserve(parsed.PowerReserveHours);
        if (QueryMentionsWaterResistance(query))
            intent.WaterResistanceBuckets = NormaliseWaterResistance(parsed.WaterResistanceMin);

        // Return null if nothing was extracted — avoids unnecessary intent propagation
        if (intent.BrandId == null && intent.CollectionId == null && intent.BrandIds.Count == 0 && intent.CollectionIds.Count == 0
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.Style == null && intent.CaseMaterial == null
            && intent.WaterResistanceBuckets.Count == 0
            && intent.Complications.Count == 0 && intent.PowerReserves.Count == 0
            && intent.MinDiameterMm == null && intent.MaxDiameterMm == null)
            return null;

        return intent;
    }

    private static string? NormaliseMovement(string? raw) => raw?.ToLowerInvariant() switch
    {
        "automatic" or "self-winding"    => "Automatic",
        "manual" or "manual-winding"     => "Manual-winding",
        "quartz"                          => "Quartz",
        _                                 => null,
    };

    private static string? NormaliseMaterial(string? raw)
    {
        if (raw == null) return null;
        var r = raw.ToLowerInvariant();
        if (r.Contains("rose gold"))   return "Rose Gold";
        if (r.Contains("yellow gold")) return "Yellow Gold";
        if (r.Contains("white gold"))  return "White Gold";
        if (r.Contains("gold"))        return "Gold";
        if (r.Contains("platinum"))    return "Platinum";
        if (r.Contains("titanium"))    return "Titanium";
        if (r.Contains("ceramic"))     return "Ceramic";
        if (r.Contains("carbon"))      return "Carbon";
        if (r.Contains("steel"))       return "Steel";
        return null;
    }

    private static List<string> NormaliseComplications(List<string> raw)
    {
        var labelMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Chronograph"]      = "Chronograph",
            ["Perpetual Calendar"] = "Perpetual Calendar",
            ["Annual Calendar"]  = "Annual Calendar",
            ["Moonphase"]        = "Moonphase",
            ["Moon Phase"]       = "Moonphase",
            ["Tourbillon"]       = "Tourbillon",
            ["Minute Repeater"]  = "Minute Repeater",
            ["GMT"]              = "GMT / World Time",
            ["GMT / World Time"] = "GMT / World Time",
            ["World Time"]       = "GMT / World Time",
        };
        return raw.Select(c => labelMap.GetValueOrDefault(c, c))
                  .Where(c => labelMap.ContainsValue(c))
                  .Distinct()
                  .ToList();
    }

    private static List<string> NormalisePowerReserve(int? hours)
    {
        if (hours == null) return [];
        var h = hours.Value;
        if (h < 48)  return ["Under 48h"];
        if (h < 72)  return ["48h \u2013 72h", "72h \u2013 100h", "Over 100h"];
        if (h < 100) return ["72h \u2013 100h", "Over 100h"];
        return ["Over 100h"];
    }

    private static List<string> NormaliseWaterResistance(int? metres)
    {
        if (metres == null) return [];
        var m = metres.Value;
        if (m <= 30)  return ["Up to 30m", "50m \u2013 120m", "150m \u2013 300m", "600m+"];
        if (m <= 120) return ["50m \u2013 120m", "150m \u2013 300m", "600m+"];
        if (m <= 300) return ["150m \u2013 300m", "600m+"];
        return ["600m+"];
    }

    private static bool QueryMentionsWaterResistance(string query) =>
        Regex.IsMatch(query,
            @"\b(?:water[\s-]?resist(?:ant|ance)?|water[\s-]?proof|waterproof|dive|diver|diving|wr|atm|bar)\b",
            RegexOptions.IgnoreCase)
        || Regex.IsMatch(query,
            @"\b\d+\s*(?:m(?!m)\b|meters?\b|metres?\b)",
            RegexOptions.IgnoreCase);

    internal static List<Collection> ResolveFuzzyCollections(string query, List<Collection> collections, HashSet<int> matchedBrandIds)
    {
        var tokens = TokenizeQuery(query);
        var normalisedQuery = NormaliseEntityText(query);
        if (tokens.Count == 0 && normalisedQuery.Length == 0) return [];

        var pool = matchedBrandIds.Count > 0
            ? collections.Where(c => matchedBrandIds.Contains(c.BrandId)).ToList()
            : collections;

        return pool
            .Select(c => new { Collection = c, Score = CollectionTokenScore(c, normalisedQuery, tokens) })
            .Where(x => x.Score >= 100)
            .GroupBy(x => x.Collection.Id)
            .Select(g => g.OrderByDescending(x => x.Score).First())
            .OrderByDescending(x => x.Score)
            .Take(4)
            .Select(x => x.Collection)
            .ToList();
    }

    private static int CollectionTokenScore(Collection collection, string normalisedQuery, List<string> tokens)
    {
        var collectionKey = NormaliseEntityText(collection.Name);
        if (collectionKey.Length >= 4 && normalisedQuery.Contains(collectionKey))
            return 300 + collectionKey.Length;

        var nameTokens = TokenizeQuery(collection.Name);
        if (nameTokens.Count == 0) return 0;

        var score = 0;
        foreach (var queryToken in tokens)
        {
            foreach (var nameToken in nameTokens)
            {
                if (nameToken == queryToken) score += 200;
                else if (nameToken.StartsWith(queryToken) || queryToken.StartsWith(nameToken)) score += 120;
                else if (IsFuzzyTokenMatch(nameToken, queryToken)) score += 100;
            }
        }

        return score;
    }

    private static void ApplyCollectionMatches(QueryIntent intent, IEnumerable<Collection> matches)
    {
        var ids = new List<int>();
        if (intent.CollectionId != null) ids.Add(intent.CollectionId.Value);
        ids.AddRange(intent.CollectionIds);
        ids.AddRange(matches.Select(c => c.Id));
        ids = ids.Distinct().ToList();

        if (ids.Count == 0) return;
        if (ids.Count == 1)
        {
            intent.CollectionId = ids[0];
            intent.CollectionIds = [];
            return;
        }

        intent.CollectionId = null;
        intent.CollectionIds = ids;
    }

    private static IEnumerable<Collection> IntentCollections(QueryIntent intent, List<Collection>? collections)
    {
        if (collections == null) return [];
        var ids = new HashSet<int>(intent.CollectionIds);
        if (intent.CollectionId != null) ids.Add(intent.CollectionId.Value);
        return collections.Where(c => ids.Contains(c.Id));
    }

    private static void ReconcileCollectionBrandScope(QueryIntent intent, List<Collection>? collections)
    {
        if (collections == null) return;

        var collectionBrandIds = IntentCollections(intent, collections)
            .Select(c => c.BrandId)
            .Distinct()
            .ToList();
        if (collectionBrandIds.Count == 0) return;

        if (collectionBrandIds.Count == 1)
        {
            if (intent.BrandId == null && intent.BrandIds.Count == 0)
                intent.BrandId = collectionBrandIds[0];
            return;
        }

        intent.BrandId = null;
        intent.BrandIds = collectionBrandIds;
    }

    private static List<string> TokenizeQuery(string text) =>
        Regex.Split(text.ToLowerInvariant(), @"[^a-z0-9]+")
            .Where(t => t.Length >= 4)
            .Where(t => !CollectionTokenStopWords.Contains(t))
            .Distinct()
            .ToList();

    private static string NormaliseEntityText(string text) =>
        Regex.Replace(text.ToLowerInvariant(), @"[^a-z0-9]+", "");

    private static readonly HashSet<string> CollectionTokenStopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "watch", "watches", "timepiece", "timepieces", "collection",
        "sport", "sporty", "dress", "formal", "elegant", "elegance",
        "dive", "diver", "diving", "water", "resistance", "resistant", "waterproof",
        "under", "below", "less", "than", "over", "above", "more", "between",
        "with", "good", "decent", "solid", "high",
    };

    internal static bool IsLikelyReferenceQuery(string query) =>
        Regex.IsMatch(query.Trim(), @"\b[A-Z0-9]+(?:[./-][A-Z0-9]+){2,}\b", RegexOptions.IgnoreCase);

    internal static bool HasWatchDomainSignal(string query) =>
        IsLikelyReferenceQuery(query)
        || Regex.IsMatch(query,
            @"\b(?:watch|watches|timepiece|timepieces|horology|luxury|wrist|diameter|dial|case|bracelet|strap|movement|automatic|manual|quartz|dress|sport|sporty|diver|diving|water[\s-]?resist(?:ant|ance)?|waterproof|gmt|chronograph|perpetual|annual|calendar|moonphase|tourbillon|repeater|steel|gold|titanium|ceramic|platinum)\b",
            RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:under|below|over|above|between)\s*\$?\s*\d[\d,]*\s*k?\b", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b\d+(?:\.\d+)?\s*mm\b", RegexOptions.IgnoreCase);

    internal static SmartSearchFilterState BuildFilterStateForDiagnostics(QueryIntent? intent)
    {
        if (intent == null)
            return new([], [], [], [], [], [], [], []);

        var brandIds = intent.BrandIds.Count > 0
            ? intent.BrandIds.ToList()
            : intent.BrandId != null ? [intent.BrandId.Value] : [];

        var collectionIds = intent.CollectionIds.Count > 0
            ? intent.CollectionIds.ToList()
            : intent.CollectionId != null ? [intent.CollectionId.Value] : [];

        return new(
            BrandIds: brandIds,
            CollectionIds: collectionIds,
            PriceBuckets: PriceBucketsFor(intent.MinPrice, intent.MaxPrice),
            DiameterBuckets: DiameterBucketsFor(intent.MinDiameterMm, intent.MaxDiameterMm),
            WaterResistances: intent.WaterResistanceBuckets.Count > 0
                ? intent.WaterResistanceBuckets.ToList()
                : WaterBucketsFor(intent.WaterResistance),
            CaseMaterials: intent.CaseMaterial != null ? [intent.CaseMaterial] : [],
            Complications: intent.Complications.ToList(),
            PowerReserves: intent.PowerReserves.ToList());
    }

    private static List<string> PriceBucketsFor(decimal? minPrice, decimal? maxPrice)
    {
        if (minPrice == null && maxPrice == null) return [];
        var buckets = new (string Label, decimal Min, decimal Max)[]
        {
            ("Under $5k", 1, 4_999),
            ("$5k – $10k", 5_000, 9_999),
            ("$10k – $25k", 10_000, 24_999),
            ("$25k – $50k", 25_000, 49_999),
            ("$50k – $100k", 50_000, 100_000),
            ("Over $100k", 100_001, decimal.MaxValue),
        };

        var selected = new List<string> { "Price on Request" };
        selected.AddRange(buckets
            .Where(b => (maxPrice == null || b.Min <= maxPrice) && (minPrice == null || b.Max >= minPrice))
            .Select(b => b.Label));
        return selected;
    }

    private static List<string> DiameterBucketsFor(double? minDiameterMm, double? maxDiameterMm)
    {
        if (minDiameterMm == null && maxDiameterMm == null) return [];
        if (minDiameterMm != null && maxDiameterMm != null)
        {
            var min = (int)Math.Floor(minDiameterMm.Value);
            var max = (int)Math.Floor(maxDiameterMm.Value);
            if (max - min > 10) return [];
            return Enumerable.Range(min, max - min + 1).Select(mm => $"{mm}mm").ToList();
        }

        if (maxDiameterMm != null)
        {
            var max = (int)Math.Floor(maxDiameterMm.Value);
            return Enumerable.Range(30, Math.Max(0, max - 30 + 1)).Select(mm => $"{mm}mm").ToList();
        }

        return [];
    }

    private static List<string> WaterBucketsFor(string? waterResistance)
    {
        if (!int.TryParse(waterResistance, out var metres)) return [];
        if (metres <= 30) return ["Up to 30m", "50m – 120m", "150m – 300m", "600m+"];
        if (metres <= 120) return ["50m – 120m", "150m – 300m", "600m+"];
        if (metres <= 300) return ["150m – 300m", "600m+"];
        return ["600m+"];
    }

    private static bool IsFuzzyTokenMatch(string a, string b)
    {
        if (a.Length < 4 || b.Length < 4) return false;
        var maxDistance = Math.Max(a.Length, b.Length) >= 7 ? 2 : 1;
        return Math.Abs(a.Length - b.Length) <= maxDistance && LevenshteinDistance(a, b) <= maxDistance;
    }

    private static int LevenshteinDistance(string s, string t)
    {
        if (s.Length == 0) return t.Length;
        if (t.Length == 0) return s.Length;

        var d = new int[s.Length + 1, t.Length + 1];
        for (var i = 0; i <= s.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= t.Length; j++) d[0, j] = j;

        for (var i = 1; i <= s.Length; i++)
        {
            for (var j = 1; j <= t.Length; j++)
            {
                var cost = s[i - 1] == t[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }

        return d[s.Length, t.Length];
    }

    // Deterministic fallback intent extractor — used when LLM parsing is unavailable or misses
    // explicit terms. Kept conservative so it only recovers obvious brand/spec constraints.
    private async Task<QueryIntent?> ParseQueryIntentAsync(string query)
    {
        var intent = new QueryIntent();

        // ── Brand matching ────────────────────────────────────────────────────────
        var brands = await _context.Brands.AsNoTracking().ToListAsync();

        // Collect all matched brands — if 2+ found, it's a multi-brand query.
        // In that case skip the hard BrandId SQL filter so all brands can surface via vector search.
        var matchedBrands = new List<Brand>();

        // Check aliases first — word-boundary match to prevent "chronograph" matching "AP"
        var resolvedCanonicals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (alias, canonical) in _brandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                var b = brands.FirstOrDefault(br =>
                    br.Name.Equals(canonical, StringComparison.OrdinalIgnoreCase));
                if (b != null && resolvedCanonicals.Add(b.Name))
                    matchedBrands.Add(b);
            }
        }

        // Fall back to full brand name substring match for brands not caught by aliases
        foreach (var brand in brands.OrderByDescending(b => b.Name.Length))
        {
            if (query.Contains(brand.Name, StringComparison.OrdinalIgnoreCase)
                && resolvedCanonicals.Add(brand.Name))
            {
                matchedBrands.Add(brand);
            }
        }

        // Single brand: apply as hard SQL filter. Multiple brands use BrandIds IN.
        Brand? matchedBrand = matchedBrands.Count == 1 ? matchedBrands[0] : null;

        if (matchedBrand != null)
            intent.BrandId = matchedBrand.Id;
        else if (matchedBrands.Count > 1)
            intent.BrandIds = matchedBrands.Select(b => b.Id).Distinct().ToList();

        // ── Collection matching ───────────────────────────────────────────────────
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

        var matchedBrandIds = matchedBrands.Select(b => b.Id).ToHashSet();
        var pool = matchedBrandIds.Count > 0
            ? collections.Where(c => matchedBrandIds.Contains(c.BrandId)).ToList()
            : collections;
        var normalisedQuery = NormaliseEntityText(query);

        var exactCollections = pool
            .OrderByDescending(c => c.Name.Length)
            .Where(c =>
                query.Contains(c.Name, StringComparison.OrdinalIgnoreCase) ||
                (NormaliseEntityText(c.Name).Length >= 4 && normalisedQuery.Contains(NormaliseEntityText(c.Name))))
            .ToList();

        // If no hit within the brand pool, try all collections (e.g. generic query).
        if (exactCollections.Count == 0 && matchedBrandIds.Count > 0)
        {
            exactCollections = collections
                .OrderByDescending(c => c.Name.Length)
                .Where(c =>
                    query.Contains(c.Name, StringComparison.OrdinalIgnoreCase) ||
                    (NormaliseEntityText(c.Name).Length >= 4 && normalisedQuery.Contains(NormaliseEntityText(c.Name))))
                .ToList();
        }

        ApplyCollectionMatches(intent, exactCollections);
        ApplyCollectionMatches(intent, ResolveFuzzyCollections(query, collections, matchedBrandIds));

        ApplyRegexFilters(query, intent);

        // Return null if nothing was extracted — no filters to apply
        if (intent.BrandId == null && intent.CollectionId == null
            && intent.BrandIds.Count == 0 && intent.CollectionIds.Count == 0
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.MinDiameterMm == null && intent.MaxDiameterMm == null
            && intent.CaseMaterial == null && intent.MovementType == null
            && intent.WaterResistance == null && intent.Style == null
            && intent.Complications.Count == 0 && intent.PowerReserves.Count == 0
            && intent.WaterResistanceBuckets.Count == 0)
            return null;

        return intent;
    }

    // Pure regex extraction — all non-DB parsing (price, diameter, material, movement,
    // water resistance, style, complications, power reserve). Extracted for unit testing.
    internal static void ApplyRegexFilters(string query, QueryIntent intent)
    {
        var q = query;

        // ── Price matching ──────────────────────────────────────────────────────────
        var between = Regex.Match(q,
            @"between\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)\s*and\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
            RegexOptions.IgnoreCase);
        if (between.Success)
        {
            var lo = ParsePriceToken(between.Groups[1].Value, between.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
            var hi = ParsePriceToken(between.Groups[3].Value, between.Groups[4].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
            if (lo > 0) intent.MinPrice = lo;
            if (hi > 0) intent.MaxPrice = hi;
        }
        else
        {
            var upper = Regex.Match(q,
                @"(?:under|below|less\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (upper.Success)
                intent.MaxPrice = ParsePriceToken(upper.Groups[1].Value, upper.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));

            var lower = Regex.Match(q,
                @"(?:over|above|more\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (lower.Success)
                intent.MinPrice = ParsePriceToken(lower.Groups[1].Value, lower.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
        }

        // ── Diameter matching ───────────────────────────────────────────────────────
        var diamRange = Regex.Match(q,
            @"(\d+(?:\.\d+)?)\s*(?:[-–]|\bto\b)\s*(\d+(?:\.\d+)?)\s*mm",
            RegexOptions.IgnoreCase);
        if (diamRange.Success)
        {
            if (double.TryParse(diamRange.Groups[1].Value, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var lo))
                intent.MinDiameterMm = lo;
            if (double.TryParse(diamRange.Groups[2].Value, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var hi))
                intent.MaxDiameterMm = hi;
        }
        else
        {
            var diamExact = Regex.Match(q, @"(\d+(?:\.\d+)?)\s*mm", RegexOptions.IgnoreCase);
            if (diamExact.Success && double.TryParse(diamExact.Groups[1].Value,
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var ex))
            {
                intent.MinDiameterMm = ex;
                intent.MaxDiameterMm = ex;
            }
        }

        // ── Case material matching ──────────────────────────────────────────────────
        var materialMap = new (string pattern, string label)[]
        {
            (@"\b(?:stainless\s+)?steel\b", "Steel"),
            (@"\btitanium\b", "Titanium"),
            (@"\b(?:rose|white|yellow|pink|red)?\s*gold\b", "Gold"),
            (@"\bplatinum\b", "Platinum"),
            (@"\bceramic\b", "Ceramic"),
            (@"\bcarbon\b", "Carbon"),
        };
        foreach (var (pattern, label) in materialMap)
        {
            if (Regex.IsMatch(q, pattern, RegexOptions.IgnoreCase))
            {
                intent.CaseMaterial = label;
                break;
            }
        }

        // ── Movement type matching ──────────────────────────────────────────────────
        if (Regex.IsMatch(q, @"\b(?:automatic|self[- ]winding)\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Automatic";
        else if (Regex.IsMatch(q, @"\b(?:manual|hand[- ]wound)\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Manual-winding";
        else if (Regex.IsMatch(q, @"\bquartz\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Quartz";

        // ── Water resistance matching ───────────────────────────────────────────────
        // Explicit value (e.g. "100m water resist", "300m WR") — map to the matching bucket.
        var wrExplicit = Regex.Match(q,
            @"(\d+)\s*(?:(?:m(?!m)\b|meters?\b|metres?\b)|atm\b|bar\b)\s*(?:water\s*resist(?:ant|ance)?|waterproof|WR)?",
            RegexOptions.IgnoreCase);
        if (wrExplicit.Success && int.TryParse(wrExplicit.Groups[1].Value, out var wrMetres))
        {
            intent.WaterResistance = wrMetres.ToString();
            // Populate bucket list: all buckets at or above this value
            if (wrMetres <= 30)
                intent.WaterResistanceBuckets.AddRange(["Up to 30m", "50m \u2013 120m", "150m \u2013 300m", "600m+"]);
            else if (wrMetres <= 120)
                intent.WaterResistanceBuckets.AddRange(["50m \u2013 120m", "150m \u2013 300m", "600m+"]);
            else if (wrMetres <= 300)
                intent.WaterResistanceBuckets.AddRange(["150m \u2013 300m", "600m+"]);
            else
                intent.WaterResistanceBuckets.Add("600m+");
        }
        // Generic phrase (e.g. "good water resistance", "water resistant") — exclude only "Up to 30m"
        else if (Regex.IsMatch(q,
            @"\b(?:(?:good|decent|solid|decent|high)?\s*water[\s-]?resist(?:ant|ance)|waterproof|water[\s-]?proof)\b",
            RegexOptions.IgnoreCase))
        {
            intent.WaterResistanceBuckets.AddRange(["50m \u2013 120m", "150m \u2013 300m", "600m+"]);
        }

        // ── Style matching ──────────────────────────────────────────────────────────
        if (Regex.IsMatch(q, @"\b(?:sport|sporty)\b", RegexOptions.IgnoreCase))
            intent.Style = "sport";
        else if (Regex.IsMatch(q, @"\b(?:dress|formal|elegant|elegance)\b", RegexOptions.IgnoreCase))
            intent.Style = "dress";
        else if (Regex.IsMatch(q, @"\b(?:dive|diver|diving|waterproof)\b", RegexOptions.IgnoreCase))
            intent.Style = "diver";

        // ── Complication matching ───────────────────────────────────────────────────
        var complicationMap = new (string pattern, string label)[]
        {
            (@"\b(?:chronograph|chrono)\b",                "Chronograph"),
            (@"\bperpetual\s+calendar\b",                  "Perpetual Calendar"),
            (@"\bannual\s+calendar\b",                     "Annual Calendar"),
            (@"\b(?:moonphase|moon\s*phase)\b",            "Moonphase"),
            (@"\btourbillon\b",                            "Tourbillon"),
            (@"\bminute\s+repeater\b",                     "Minute Repeater"),
            (@"\b(?:gmt|world\s+time|dual\s+time)\b",     "GMT / World Time"),
        };
        foreach (var (pattern, label) in complicationMap)
        {
            if (Regex.IsMatch(q, pattern, RegexOptions.IgnoreCase))
                intent.Complications.Add(label);
        }

        // ── Power reserve matching ──────────────────────────────────────────────────
        var prHours = Regex.Match(q, @"(\d+)\s*(?:hours?|hrs?|h)\b", RegexOptions.IgnoreCase);
        var prDays  = Regex.Match(q, @"(\d+)\s*days?\b", RegexOptions.IgnoreCase);
        int? parsedHours = null;
        if (prHours.Success && int.TryParse(prHours.Groups[1].Value, out var hrs)) parsedHours = hrs;
        else if (prDays.Success && int.TryParse(prDays.Groups[1].Value, out var days)) parsedHours = days * 24;

        if (parsedHours != null)
        {
            if (parsedHours < 48) intent.PowerReserves.Add("Under 48h");
            else if (parsedHours < 72) intent.PowerReserves.Add("48h \u2013 72h");
            else if (parsedHours < 100) intent.PowerReserves.Add("72h \u2013 100h");
            else intent.PowerReserves.Add("Over 100h");
        }
        else if (Regex.IsMatch(q, @"\blong\s+power\s+reserve\b", RegexOptions.IgnoreCase))
        {
            intent.PowerReserves.AddRange(new[] { "48h \u2013 72h", "72h \u2013 100h", "Over 100h" });
        }
    }

    // Parses a price token like "50" with isK=true → 50000, or "50000" with isK=false → 50000.
    // Luxury context heuristic: bare numbers < 1000 are thousands ("under 100" = $100k).
    internal static decimal ParsePriceToken(string digits, bool isK)
    {
        var clean = digits.Replace(",", "");
        if (!decimal.TryParse(clean, out var value)) return 0;
        if (isK) return value * 1000;
        return value < 1000 ? value * 1000 : value;
    }

    // Embeds the query text using nomic-embed-text via ai-service.
    // Returns null if the embed call fails — callers treat null as cache unavailable.
    private async Task<float[]?> EmbedQueryAsync(HttpClient httpClient, string query)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await httpClient.PostAsJsonAsync("/embed", new { texts = new[] { query } });
            sw.Stop();
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Embed HTTP {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, sw.ElapsedMilliseconds);
                return null;
            }
            _logger.LogDebug("Embed {ElapsedMs}ms", sw.ElapsedMilliseconds);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            if (!json.TryGetProperty("embeddings", out var embEl)) return null;
            var embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
            return embeddings?.Count > 0 ? embeddings[0] : null;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "Embed threw after {ElapsedMs}ms — falling back to SQL pipeline",
                sw.ElapsedMilliseconds);
            return null;
        }
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
