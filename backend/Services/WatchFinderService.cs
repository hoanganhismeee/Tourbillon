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


public record WatchFinderQuotaContext(string SubjectKey, bool IsAdmin);

public class AiQuotaExceededException : Exception
{
    public AiQuotaStatus Status { get; }

    public AiQuotaExceededException(AiQuotaStatus status)
        : base($"AI quota exceeded: {status.DailyUsed}/{status.DailyLimit}")
    {
        Status = status;
    }
}

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
    /// True when CollectionId/CollectionIds were inferred from brand+style taxonomy for UI preselection.
    /// These should not be treated as hard SQL collection filters during retrieval.
    public bool CollectionsDerivedFromStyle { get; set; }
    public decimal? MaxPrice { get; set; }
    public decimal? MinPrice { get; set; }
    /// Parsed diameter range in mm — frontend uses these to pre-select the Diameter filter.
    /// Not applied as SQL WHERE (diameter is stored in Watch.Specs JSON, not a column).
    public double? MinDiameterMm { get; set; }
    public double? MaxDiameterMm { get; set; }
    /// Spec-level filters — frontend uses these to pre-select filter bar dropdowns.
    /// Not applied as SQL WHERE (stored in Watch.Specs JSON, not columns).
    public string? CaseMaterial { get; set; }
    /// Canonical dial colour ("Blue", "Silver"...). Catalogue dials are free text with 112
    /// distinct spellings, so both sides are normalised to this small set before matching.
    public string? DialColour { get; set; }
    /// The wording the user actually used ("argenté", "silver-toned"). Matching happens on the
    /// canonical bucket so nothing is missed, but the user's own spelling ranks first — asking
    /// for "argenté" and getting silver watches with no argenté among them reads as a miss.
    public string? DialColourPhrase { get; set; }
    /// Materials and complications the user ruled out ("not gold", "except a chronograph").
    /// Separate from the positive lists because a negation must never be read as a request.
    public List<string> ExcludedMaterials { get; set; } = [];
    public List<string> ExcludedComplications { get; set; } = [];
    public string? MovementType { get; set; }
    public string? WaterResistance { get; set; }
    /// Style category — "sport", "dress", "diver". Resolved to collection IDs via DB taxonomy.
    /// Applied as SQL WHERE CollectionId IN (collections with matching Style).
    public string? Style { get; set; }
    /// Multi-brand filter — populated when 2+ brands are named in the query.
    /// Applied as SQL WHERE BrandId IN (ids). Exclusive with BrandId (single-brand path).
    public List<int> BrandIds { get; set; } = [];
    /// Brands explicitly excluded by the caller (e.g., user said "not FC").
    /// Applied as SQL WHERE BrandId NOT IN (ids). Overrides BrandId/BrandIds inclusions.
    public List<int> ExcludedBrandIds { get; set; } = [];
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
    public string? SearchPath { get; set; }
    /// "ranked" when LLM rerank succeeded; "fallback" when results are unranked due to AI failure.
    public string RerankSource { get; set; } = "ranked";
}

// ── Service ───────────────────────────────────────────────────────────────────

public class WatchFinderService : IWatchFinderService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDeterministicWatchSearchService _deterministicSearch;
    private readonly TourbillonContext _context;
    private readonly WatchFilterMapper _mapper;
    private readonly QueryCacheService _queryCache;
    private readonly ILogger<WatchFinderService> _logger;
    private readonly IStorageService _storage;
    private readonly IConfiguration _config;
    private readonly IAiUsageQuotaService? _quota;
    private readonly IIntentClassifier? _classifier;

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
    internal const int TopMatchLimit     = 15;    // max results in Watches (was 20)
    private const int MinScoreThreshold  = 60;    // min LLM score to appear in top matches
    // Accessible-luxury ceiling for vague affordability terms with no explicit number (~catalogue
    // p25). Keeps "affordable / entry-level" queries on priced entry-tier pieces.
    internal const decimal AffordableCeiling = 15_000m;

    public WatchFinderService(
        IHttpClientFactory httpClientFactory,
        IDeterministicWatchSearchService deterministicSearch,
        TourbillonContext context,
        WatchFilterMapper mapper,
        QueryCacheService queryCache,
        ILogger<WatchFinderService> logger,
        IStorageService storageService,
        IConfiguration? config = null,
        IAiUsageQuotaService? quotaService = null,
        IIntentClassifier? classifier = null)
    {
        _httpClientFactory = httpClientFactory;
        _deterministicSearch = deterministicSearch;
        _context = context;
        _mapper = mapper;
        _queryCache = queryCache;
        _logger = logger;
        _storage = storageService;
        _config = config ?? new ConfigurationBuilder().Build();
        _quota = quotaService;
        _classifier = classifier;
    }

    /// Strips excluded brand IDs from inclusion lists and stores them for SQL NOT IN filtering.
    private static void ApplyBrandExclusions(QueryIntent? intent, IReadOnlyList<int>? excluded)
    {
        if (intent == null || excluded == null || excluded.Count == 0) return;
        if (intent.BrandId != null && excluded.Contains(intent.BrandId.Value))
            intent.BrandId = null;
        intent.BrandIds = intent.BrandIds.Except(excluded).ToList();
        intent.ExcludedBrandIds = intent.ExcludedBrandIds.Union(excluded).Distinct().ToList();
    }

    // Single-arg overload — no brand exclusions (satisfies interface + keeps Moq tests simple)
    public Task<WatchFinderResult> FindWatchesAsync(string query) => FindWatchesAsync(query, Array.Empty<int>());

    public Task<WatchFinderResult> FindWatchesAsync(string query, WatchFinderQuotaContext quotaContext) =>
        FindWatchesAsync(query, [], quotaContext);

    public Task<WatchFinderResult> FindWatchesAsync(string query, IReadOnlyList<int> excludedBrandIds) =>
        FindWatchesAsync(query, excludedBrandIds, null);

    public async Task<WatchFinderResult> FindWatchesAsync(
        string query,
        IReadOnlyList<int> excludedBrandIds,
        WatchFinderQuotaContext? quotaContext)
    {
        var quotaCharged = false;
        async Task EnsureQuotaChargedAsync()
        {
            if (quotaCharged || quotaContext == null)
                return;
            if (_quota == null)
                throw new InvalidOperationException("Watch Finder quota context was supplied without IAiUsageQuotaService.");

            var disabled = _config.GetValue<bool>("WatchFinderSettings:DisableLimitInDev");
            var dailyLimit = _config.GetValue<int>("WatchFinderSettings:DailyLimit", 5);
            var status = await _quota.ChargeAsync(
                "watch_finder",
                quotaContext.SubjectKey,
                dailyLimit,
                disabled,
                quotaContext.IsAdmin);
            if (status.RateLimited)
                throw new AiQuotaExceededException(status);
            quotaCharged = true;
        }

        var normalizedQuery = QueryNormalizer.ExpandCompoundTerms(query);
        var deterministicIntent = await ParseQueryIntentAsync(normalizedQuery);
        ApplyBrandExclusions(deterministicIntent, excludedBrandIds);
        if (deterministicIntent == null && !HasWatchDomainSignal(normalizedQuery)
            && await IsOffTopicAsync(query))
        {
            _logger.LogInformation("WatchFinder ignored non-watch query={QueryPreview}",
                query.Length > 60 ? query[..60] + "..." : query);
            return EmptyResult(searchPath: "non_watch");
        }

        var directResult = await _deterministicSearch.TryDirectSqlSearchAsync(normalizedQuery, deterministicIntent, "direct_sql_deterministic");
        if (directResult != null)
            return directResult;
        if (deterministicIntent != null && ShouldUseDeterministicCataloguePath(normalizedQuery, deterministicIntent))
        {
            var deterministicFallbackResult = await _deterministicSearch.TryDeterministicCatalogueFallbackAsync(
                normalizedQuery,
                deterministicIntent,
                "direct_sql_deterministic_fallback");
            if (deterministicFallbackResult != null)
                return deterministicFallbackResult;

            _logger.LogInformation(
                "WatchFinder deterministic direct miss query={QueryPreview} brandId={BrandId} brandIds=[{BrandIds}] collectionId={CollectionId} collectionIds=[{CollectionIds}] minPrice={MinPrice} maxPrice={MaxPrice} style={Style}",
                query.Length > 60 ? query[..60] + "..." : query,
                deterministicIntent.BrandId,
                string.Join(",", deterministicIntent.BrandIds),
                deterministicIntent.CollectionId,
                string.Join(",", deterministicIntent.CollectionIds),
                deterministicIntent.MinPrice,
                deterministicIntent.MaxPrice,
                deterministicIntent.Style);
        }

        var httpClient = _httpClientFactory.CreateClient("ai-service");

        var queryEmbedding = await EmbedQueryAsync(httpClient, normalizedQuery);
        var queryIntent = deterministicIntent;
        // When the LLM returns null (no structured intent) but brand exclusions exist,
        // create a minimal QueryIntent so exclusions reach VectorSearchAsync and the
        // cache bypass check. Without this, hasHardFilters stays false and a cached
        // FC-inclusive result can be served even when FC is excluded.
        if (queryIntent == null && excludedBrandIds.Count > 0)
            queryIntent = new QueryIntent();
        ApplyBrandExclusions(queryIntent, excludedBrandIds);

        // Skip cache when hard SQL filters are active (price, brand, or brand exclusions) — a cached
        // "dress watch" result must not be reused for "Vacheron dress watch" or when a brand is excluded.
        var hasHardFilters = queryIntent?.BrandId != null || HasStrictCollectionIntent(queryIntent)
            || queryIntent?.MaxPrice != null || queryIntent?.MinPrice != null
            || queryIntent?.BrandIds?.Count > 0
            || queryIntent?.ExcludedBrandIds?.Count > 0
            || (queryIntent?.CollectionsDerivedFromStyle != true && queryIntent?.CollectionIds?.Count > 0);
        if (queryEmbedding != null && !hasHardFilters)
        {
            var cached = await _queryCache.LookupAsync(queryEmbedding);
            if (cached != null)
            {
                _logger.LogInformation("WatchFinder cache hit query={QueryPreview}",
                    query.Length > 60 ? query[..60] + "…" : query);
                cached.QueryIntent = queryIntent;
                // The stored result carries the path that originally produced it, so without this
                // a cache hit is indistinguishable from a fresh run of that path — and a serialised
                // result from before SearchPath existed reports nothing at all. Keep the origin,
                // prefixed, so telemetry can separate served-from-cache from recomputed.
                cached.SearchPath = string.IsNullOrEmpty(cached.SearchPath)
                    ? "cache_hit"
                    : $"cache_hit:{cached.SearchPath}";
                return cached;
            }
        }

        // Past this point Smart Search needs model interpretation or reranking, so the
        // user-facing Smart Search quota is charged once before the first paid LLM call.
        await EnsureQuotaChargedAsync();

        // LLM parse replaces the old regex approach: the model understands nuanced phrasing,
        // multi-brand queries, and all filter dimensions without hardcoded patterns.
        queryIntent = await ParseIntentFromLlmAsync(httpClient, normalizedQuery, deterministicIntent);
        if (queryIntent == null && excludedBrandIds.Count > 0)
            queryIntent = new QueryIntent();
        ApplyBrandExclusions(queryIntent, excludedBrandIds);

        var mergedDirectResult = await _deterministicSearch.TryDirectSqlSearchAsync(normalizedQuery, queryIntent, "direct_sql_merged");
        if (mergedDirectResult != null)
            return mergedDirectResult;

        // Step 1: retrieve candidates via vector similarity.
        // Hard SQL pre-filters: price, single-brand, and multi-brand constraints.
        // Everything else (style, water resistance, complications) is soft — pre-populates the
        // frontend filter bar but does not remove candidates from the pool.
        List<Watch> candidates;
        float bestDistance = float.MaxValue;
        List<string> widenedSearchKinds = [];

        if (queryEmbedding != null)
        {
            (candidates, bestDistance) = await VectorSearchAsync(queryEmbedding, queryIntent);

            // One structural widening pass: if a hard vector filter empties the pool,
            // retry once without the relaxable price cap before surfacing a refusal.
            if (candidates.Count == 0
                && TryBuildRelaxedVectorIntent(queryIntent, out var widenedIntent, out var widenKinds))
            {
                _logger.LogInformation(
                    "WatchFinder widen={WidenKinds} applied query={QueryPreview}",
                    string.Join("|", widenKinds),
                    query.Length > 60 ? query[..60] + "..." : query);

                var (widenedCandidates, widenedBestDistance) = await VectorSearchAsync(queryEmbedding, widenedIntent);
                if (widenedCandidates.Count > 0)
                {
                    // When the relaxed constraint was price, reorder toward the cheapest
                    // catalogue pieces so the "entry-tier" narrative in the Widened search
                    // notice actually matches what the user sees. Price-on-Request (0) last.
                    if (widenKinds.Contains("price", StringComparer.OrdinalIgnoreCase))
                    {
                        widenedCandidates = widenedCandidates
                            .OrderBy(w => w.CurrentPrice == 0 ? 1 : 0)
                            .ThenBy(w => w.CurrentPrice == 0 ? decimal.MaxValue : w.CurrentPrice)
                            .ToList();
                    }

                    candidates = widenedCandidates;
                    bestDistance = widenedBestDistance;
                    widenedSearchKinds = widenKinds;
                }
            }

            // Second structural widening pass: if the pool is still empty, the most likely
            // cause is the MinRelevance gate rejecting a low-signal unconstrained query
            // (HasWatchDomainSignal already filtered non-watch queries upstream). Retry once
            // with the gate bypassed so we surface best-effort approximate matches instead
            // of a flat refusal.
            if (candidates.Count == 0)
            {
                var (looseCandidates, looseBestDistance) =
                    await VectorSearchAsync(queryEmbedding, queryIntent, allowLooseMatches: true);
                if (looseCandidates.Count > 0)
                {
                    candidates = looseCandidates;
                    bestDistance = looseBestDistance;
                    widenedSearchKinds = [..widenedSearchKinds, "relevance"];
                    _logger.LogInformation(
                        "WatchFinder widen=relevance applied query={QueryPreview}",
                        query.Length > 60 ? query[..60] + "..." : query);
                }
            }

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

                if (queryIntent.ExcludedBrandIds.Count > 0)
                    fallbackQuery = fallbackQuery.Where(w => !queryIntent.ExcludedBrandIds.Contains(w.BrandId));

                if (HasStrictCollectionIntent(queryIntent) && queryIntent.CollectionId != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CollectionId == queryIntent.CollectionId);
                if (HasStrictCollectionIntent(queryIntent) && queryIntent.CollectionIds.Count > 0)
                    fallbackQuery = fallbackQuery.Where(w => w.CollectionId != null && queryIntent.CollectionIds.Contains(w.CollectionId.Value));
                if (queryIntent.MaxPrice != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= queryIntent.MaxPrice);
                if (queryIntent.MinPrice != null)
                    fallbackQuery = fallbackQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= queryIntent.MinPrice);

                if (ShouldApplyStyleSqlFilter(queryIntent))
                {
                    var fallbackStyleCollectionIds = await ResolveStyleCollectionIdsAsync(_context, queryIntent.Style);
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
            Watches = candidates.Take(TopMatchLimit).Select(w => WatchDto.FromWatch(w, _storage)).ToList(),
            OtherCandidates = candidates.Skip(TopMatchLimit).Select(w => WatchDto.FromWatch(w, _storage)).ToList(),
            MatchDetails = [],
            ParsedIntent = null,
            // The label has to say which stage actually produced these candidates. When the embed
            // call fails the block above loads them from SQL, and calling that "vector" made the
            // path telemetry describe a stage that never ran — the one signal that would have
            // shown embeddings were off in production reported the opposite.
            SearchPath = AppendWidenedSearchPath(
                queryEmbedding == null ? "sql_fallback_no_embedding"
                    : bestDistance < SkipLlmDistance ? "vector" : "vector_llm_candidate",
                widenedSearchKinds)
        };

        result.QueryIntent = queryIntent;
        if (candidates.Count == 0)
        {
            _logger.LogInformation("WatchFinder zero candidates query={QueryPreview}",
                query.Length > 60 ? query[..60] + "…" : query);
            result.SearchPath = queryEmbedding != null ? "vector_empty" : "sql_fallback_empty";
            return result;
        }

        if (bestDistance >= SkipLlmDistance && (HasBrandIntent(queryIntent) || HasCollectionIntent(queryIntent)))
        {
            var structuredOrdered = candidates
                .Select(w => new { Watch = w, Score = DirectSqlScore(normalizedQuery, w, queryIntent, false) })
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
                .Select(x => x.Watch)
                .ToList();

            result.Watches = structuredOrdered.Take(TopMatchLimit).Select(w => WatchDto.FromWatch(w, _storage)).ToList();
            result.OtherCandidates = structuredOrdered.Skip(TopMatchLimit).Select(w => WatchDto.FromWatch(w, _storage)).ToList();
            result.SearchPath = AppendWidenedSearchPath(
                queryEmbedding == null ? "sql_fallback_structured" : "vector_structured_skip_rerank",
                widenedSearchKinds);
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
            await EnsureQuotaChargedAsync();
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
                        .Select(w => new
                        {
                            Watch = w,
                            CompositeScore = scoreMap[w.Id].Score
                                + RelaxedDeterministicScore(w, queryIntent, [])
                                + IntentPricePreferenceScore(w, queryIntent)
                        })
                        .OrderBy(x => PriceOnRequestRank(x.Watch, queryIntent))
                        .ThenByDescending(x => x.CompositeScore)
                        .ThenBy(x => PriceDistanceFromIntent(x.Watch, queryIntent))
                        .Select(x => x.Watch)
                        .ToList();

                    var topMatches = scoredAndOrdered
                        .Where(w => scoreMap[w.Id].Score >= MinScoreThreshold)
                        .Take(TopMatchLimit)
                        .ToList();

                    if (topMatches.Count() < 3)
                        topMatches = scoredAndOrdered.Take(Math.Min(TopMatchLimit, scoredAndOrdered.Count())).ToList();

                    var topMatchIds = new HashSet<int>(topMatches.Select(w => w.Id));

                    result.Watches = topMatches.Select(w => WatchDto.FromWatch(w, _storage)).ToList();

                    // Non-top reranked candidates (lower-scored first), then the vector-tail that was never reranked
                    result.OtherCandidates = rerankCandidates
                        .Where(w => !topMatchIds.Contains(w.Id))
                        .OrderByDescending(w => scoreMap.ContainsKey(w.Id) ? scoreMap[w.Id].Score : -1)
                        .Concat(unscoredCandidates)
                        .Select(w => WatchDto.FromWatch(w, _storage))
                        .ToList();

                    result.MatchDetails = topMatches.ToDictionary(
                        w => w.Id,
                        w => new WatchMatchDetail
                        {
                            Score = scoreMap[w.Id].Score
                        });
                    // Same rule as the candidate label above: rerank can run over SQL-loaded
                    // candidates when embeddings are unavailable, and the path must not claim
                    // a vector stage that did not happen.
                    result.SearchPath = AppendWidenedSearchPath(
                        queryEmbedding == null ? "sql_fallback_llm_rerank" : "vector_llm_rerank",
                        widenedSearchKinds);
                }
            }
        }
        catch (Exception ex)
        {
            rerankSw.Stop();
            _logger.LogWarning(ex,
                "WatchFinder rerank threw after {ElapsedMs}ms — returning unranked results",
                rerankSw.ElapsedMilliseconds);
            result.RerankSource = "fallback";
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

    private static WatchFinderResult EmptyResult(QueryIntent? intent = null, string? searchPath = null) => new()
    {
        Watches = [],
        OtherCandidates = [],
        MatchDetails = [],
        ParsedIntent = null,
        QueryIntent = intent,
        SearchPath = searchPath
    };

    private static bool TryBuildRelaxedVectorIntent(
        QueryIntent? intent,
        out QueryIntent? widenedIntent,
        out List<string> widenKinds)
    {
        widenedIntent = null;
        widenKinds = [];
        if (intent == null)
            return false;

        var clone = CloneIntent(intent);

        // Price is the only relaxable hard filter in the current vector path.
        // Diameter and water-resistance stay as soft discovery hints in QueryIntent.
        if (clone.MaxPrice != null || clone.MinPrice != null)
        {
            clone.MaxPrice = null;
            clone.MinPrice = null;
            widenKinds.Add("price");
        }

        if (widenKinds.Count == 0)
            return false;

        widenedIntent = clone;
        return true;
    }

    private static QueryIntent CloneIntent(QueryIntent intent) => new()
    {
        BrandId = intent.BrandId,
        CollectionId = intent.CollectionId,
        CollectionIds = [.. intent.CollectionIds],
        CollectionsDerivedFromStyle = intent.CollectionsDerivedFromStyle,
        MaxPrice = intent.MaxPrice,
        MinPrice = intent.MinPrice,
        MinDiameterMm = intent.MinDiameterMm,
        MaxDiameterMm = intent.MaxDiameterMm,
        CaseMaterial = intent.CaseMaterial,
        MovementType = intent.MovementType,
        WaterResistance = intent.WaterResistance,
        Style = intent.Style,
        BrandIds = [.. intent.BrandIds],
        ExcludedBrandIds = [.. intent.ExcludedBrandIds],
        Complications = [.. intent.Complications],
        PowerReserves = [.. intent.PowerReserves],
        WaterResistanceBuckets = [.. intent.WaterResistanceBuckets],
    };

    private static string AppendWidenedSearchPath(string searchPath, IReadOnlyCollection<string> widenKinds) =>
        widenKinds.Count == 0
            ? searchPath
            : $"{searchPath}+widened:{string.Join(",", widenKinds)}";

    internal static bool HasWidenedSearchPath(string? searchPath) =>
        !string.IsNullOrWhiteSpace(searchPath)
        && searchPath.Contains("+widened:", StringComparison.OrdinalIgnoreCase);

    internal static IReadOnlyList<string> GetWidenedSearchKinds(string? searchPath)
    {
        if (!HasWidenedSearchPath(searchPath))
            return [];

        var markerIndex = searchPath!.IndexOf("+widened:", StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
            return [];

        return searchPath[(markerIndex + "+widened:".Length)..]
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    internal static bool HasBrandIntent(QueryIntent? intent) =>
        intent?.BrandId != null || intent?.BrandIds.Count > 0;

    internal static bool HasCollectionIntent(QueryIntent? intent) =>
        intent?.CollectionId != null || intent?.CollectionIds.Count > 0;

    internal static bool HasStrictCollectionIntent(QueryIntent? intent) =>
        HasCollectionIntent(intent) && intent?.CollectionsDerivedFromStyle != true;

    private static bool HasDeterministicFilterIntent(QueryIntent? intent) =>
        intent != null
        && (intent.MinPrice != null || intent.MaxPrice != null
            || intent.MinDiameterMm != null || intent.MaxDiameterMm != null
            || intent.CaseMaterial != null || intent.MovementType != null
            || intent.DialColour != null
            || intent.ExcludedMaterials.Count > 0 || intent.ExcludedComplications.Count > 0
            || intent.WaterResistance != null || intent.WaterResistanceBuckets.Count > 0
            || intent.Style != null || intent.Complications.Count > 0
            || intent.PowerReserves.Count > 0);

    private static bool HasSemanticOnlySignals(string query) =>
        Regex.IsMatch(query,
            @"\b(?:wedding|office|boardroom|beach|vacation|travel|daily|everyday|versatile|statement|gift|occasion|summer|winter|vibe|feel|look|smartwatch(?:es)?|breakfast|lunch|dinner)\b",
            RegexOptions.IgnoreCase);

    internal static bool ShouldUseDeterministicCataloguePath(string query, QueryIntent? intent)
    {
        if (intent == null)
            return false;

        // A semantic-only signal (occasion / vibe word like "everyday" or "gift") normally routes
        // to the vector path. But an explicit budget is a hard constraint the catalogue path serves
        // better: it returns varied, in-budget priced pieces instead of letting the vector search
        // surface expensive Price-on-Request grails for "affordable everyday watches".
        var hasBudget = intent.MinPrice != null || intent.MaxPrice != null;
        if (HasSemanticOnlySignals(query) && !hasBudget)
            return false;

        return HasBrandIntent(intent)
            || HasCollectionIntent(intent)
            || HasDeterministicFilterIntent(intent)
            || IsLikelyReferenceQuery(query)
            || IsLikelyReferenceFragment(query);
    }

    internal static bool ShouldApplyStyleSqlFilter(QueryIntent? intent) =>
        intent?.Style != null && !HasCollectionIntent(intent) && !HasBrandIntent(intent);

    // A requested style also accepts its sibling family so the hard SQL collection filter does
    // not exclude obviously-related pieces — "sport" must surface diver collections too (a diver
    // is a sport watch), otherwise a Seamaster/Black Bay tagged only "diver" vanishes from a
    // "sporty watches" query. Dress and art stay narrow. Returns the acceptable Collection.Styles tags.
    internal static string[] StyleFamily(string? style) => style switch
    {
        "sport" => ["sport", "diver"],
        _ => style is null ? [] : [style],
    };

    // Resolves a style (plus its sibling family — see StyleFamily) to the collection IDs tagged
    // with any family tag. Materializes the small collections table and filters in memory so it
    // behaves identically across the Npgsql and in-memory providers — the array-overlap predicate
    // does not translate under the in-memory test provider. Centralizes what used to be four
    // duplicated style→collection lookups.
    internal static async Task<List<int>> ResolveStyleCollectionIdsAsync(TourbillonContext context, string? style)
    {
        var family = StyleFamily(style);
        if (family.Length == 0)
            return [];

        var familySet = new HashSet<string>(family, StringComparer.OrdinalIgnoreCase);
        var collections = await context.Collections
            .AsNoTracking()
            .Select(c => new { c.Id, c.Styles })
            .ToListAsync();

        return collections
            .Where(c => c.Styles.Any(s => familySet.Contains(s)))
            .Select(c => c.Id)
            .ToList();
    }

    internal static int DirectSqlScore(string query, Watch watch, QueryIntent? intent, bool isReferenceLike)
    {
        var queryKey = QueryNormalizer.CompactText(query);
        var watchNameKey = QueryNormalizer.CompactText(watch.Name);
        var collectionKey = QueryNormalizer.CompactText(watch.Collection?.Name ?? "");
        var brandKey = QueryNormalizer.CompactText(watch.Brand?.Name ?? "");
        var directTokens = TokenizeDirectQuery(query);

        var score = 0;
        if (isReferenceLike)
        {
            if (watchNameKey == queryKey) score += 1200;
            else if (watchNameKey.Contains(queryKey)) score += 1000;
            else if (queryKey.Contains(watchNameKey)) score += 950;
            else if (queryKey.Length >= 8 && watchNameKey.Contains(queryKey[..Math.Min(queryKey.Length, 12)])) score += 900;
        }

        if (intent?.BrandId == watch.BrandId || intent?.BrandIds.Contains(watch.BrandId) == true)
            score += 80;
        if (watch.CollectionId != null &&
            (intent?.CollectionId == watch.CollectionId || intent?.CollectionIds.Contains(watch.CollectionId.Value) == true))
            score += 120;
        if (intent?.Style != null && watch.Collection?.Styles.Contains(intent.Style) == true)
            score += 60;
        score += IntentPricePreferenceScore(watch, intent);

        foreach (var token in directTokens)
        {
            if (watchNameKey.Contains(token)) score += token.Length >= 5 ? 40 : 30;
            if (collectionKey.Contains(token)) score += 45;
            if (brandKey.Contains(token)) score += 25;
        }

        if (watch.CurrentPrice > 0) score += 5;
        return score;
    }

    internal static bool MatchesDeterministicIntent(Watch watch, QueryIntent? intent, List<int> styleCollectionIds)
    {
        if (intent == null) return true;

        var specs = DeserialiseSpecs(watch.Specs);
        var diameterMm = ParseDiameterMm(specs?.Case?.Diameter);
        var waterMetres = ParseWaterResistanceMetres(specs?.Case?.WaterResistance);
        var powerReserveHours = ParsePowerReserveHours(specs?.Movement?.PowerReserve);
        var functions = specs?.Movement?.Functions ?? [];

        if (intent.MinDiameterMm != null && (diameterMm == null || diameterMm < intent.MinDiameterMm))
            return false;
        if (intent.MaxDiameterMm != null && (diameterMm == null || diameterMm > intent.MaxDiameterMm))
            return false;

        if (intent.CaseMaterial != null
            && !(specs?.Case?.Material?.Contains(intent.CaseMaterial, StringComparison.OrdinalIgnoreCase) ?? false))
            return false;

        if (intent.DialColour != null
            && !DialColourMatches(specs?.Dial?.Color, intent.DialColour))
            return false;

        if (intent.ExcludedMaterials.Count > 0 && specs?.Case?.Material is { } excludedCandidate
            && intent.ExcludedMaterials.Any(m => excludedCandidate.Contains(m, StringComparison.OrdinalIgnoreCase)))
            return false;

        if (intent.ExcludedComplications.Count > 0 && intent.ExcludedComplications.Any(
                complication => functions.Any(fn => fn.Contains(complication, StringComparison.OrdinalIgnoreCase))))
            return false;

        if (intent.MovementType != null
            && NormaliseMovementFamily(specs?.Movement?.Type) != NormaliseMovementFamily(intent.MovementType))
            return false;

        if (intent.WaterResistance != null)
        {
            if (!int.TryParse(intent.WaterResistance, out var requestedWater)
                || waterMetres == null
                || waterMetres < requestedWater)
                return false;
        }
        if (intent.Complications.Count > 0 && !intent.Complications.All(complication =>
                functions.Any(fn => fn.Contains(complication, StringComparison.OrdinalIgnoreCase))))
            return false;

        if (intent.PowerReserves.Count > 0
            && (powerReserveHours == null || powerReserveHours < MinimumPowerReserveForBuckets(intent.PowerReserves)))
            return false;

        if (intent.Style != null && styleCollectionIds.Count > 0
            && !HasBrandIntent(intent) && !HasCollectionIntent(intent)
            && watch.CollectionId != null && !styleCollectionIds.Contains(watch.CollectionId.Value))
            return false;

        return true;
    }

    internal static int DeterministicMatchScore(Watch watch, QueryIntent? intent, List<int> styleCollectionIds)
    {
        if (intent == null) return 0;

        var specs = DeserialiseSpecs(watch.Specs);
        var score = 0;
        var diameterMm = ParseDiameterMm(specs?.Case?.Diameter);
        var waterMetres = ParseWaterResistanceMetres(specs?.Case?.WaterResistance);
        var powerReserveHours = ParsePowerReserveHours(specs?.Movement?.PowerReserve);
        var functions = specs?.Movement?.Functions ?? [];

        if (intent.MinPrice != null || intent.MaxPrice != null) score += 10 + IntentPricePreferenceScore(watch, intent);
        if (intent.MinDiameterMm != null && intent.MaxDiameterMm != null && diameterMm != null) score += 70;
        else if ((intent.MinDiameterMm != null || intent.MaxDiameterMm != null) && diameterMm != null) score += 50;
        if (intent.CaseMaterial != null && specs?.Case?.Material != null) score += 40;
        if (intent.MovementType != null && specs?.Movement?.Type != null) score += 35;
        if (intent.DialColour != null && specs?.Dial?.Color != null)
        {
            score += 40;
            // Ranked above a bucket-only match so the user's own wording surfaces first, while
            // the rest of the colour family stays in the result set behind it.
            if (intent.DialColourPhrase != null && specs.Dial.Color.Contains(
                    intent.DialColourPhrase, StringComparison.OrdinalIgnoreCase))
                score += 55;
        }
        if (intent.WaterResistance != null && waterMetres != null) score += 60;
        else if (intent.WaterResistanceBuckets.Count > 0 && waterMetres != null) score += 45;
        else if (intent.WaterResistanceBuckets.Count > 0 && waterMetres == null)
        {
            if (watch.Collection?.Styles.Contains("diver") == true) score += 35;
            else if (watch.Collection?.Styles.Contains("sport") == true) score += 15;
        }
        if (intent.Complications.Count > 0 && functions.Count > 0) score += 35 + (intent.Complications.Count * 5);
        if (intent.PowerReserves.Count > 0 && powerReserveHours != null) score += 40;
        if (intent.Style != null && styleCollectionIds.Count > 0 && watch.CollectionId != null && styleCollectionIds.Contains(watch.CollectionId.Value))
            score += 60;

        return score;
    }

    internal static int RelaxedDeterministicScore(Watch watch, QueryIntent? intent, List<int> styleCollectionIds)
    {
        if (intent == null) return 0;

        var specs = DeserialiseSpecs(watch.Specs);
        var score = 0;
        var diameterMm = ParseDiameterMm(specs?.Case?.Diameter);
        var waterMetres = ParseWaterResistanceMetres(specs?.Case?.WaterResistance);
        var powerReserveHours = ParsePowerReserveHours(specs?.Movement?.PowerReserve);
        var functions = specs?.Movement?.Functions ?? [];

        if (intent.MinPrice != null || intent.MaxPrice != null) score += 10 + IntentPricePreferenceScore(watch, intent);

        if (intent.MinDiameterMm != null || intent.MaxDiameterMm != null)
        {
            var target = intent.MinDiameterMm != null && intent.MaxDiameterMm != null
                ? (intent.MinDiameterMm.Value + intent.MaxDiameterMm.Value) / 2d
                : intent.MinDiameterMm ?? intent.MaxDiameterMm;
            if (diameterMm != null && target != null)
            {
                var delta = Math.Abs(diameterMm.Value - target.Value);
                if (delta <= 0.5d) score += 70;
                else if (delta <= 1.5d) score += 45;
                else if (delta <= 3d) score += 20;
            }
        }

        if (intent.CaseMaterial != null && specs?.Case?.Material?.Contains(intent.CaseMaterial, StringComparison.OrdinalIgnoreCase) == true)
            score += 40;

        if (intent.MovementType != null && specs?.Movement?.Type?.Contains(intent.MovementType, StringComparison.OrdinalIgnoreCase) == true)
            score += 35;

        if (intent.WaterResistance != null && int.TryParse(intent.WaterResistance, out var requestedWater) && waterMetres != null)
        {
            if (waterMetres >= requestedWater) score += 60;
            else if (waterMetres >= requestedWater * 0.7) score += 25;
        }
        else if (intent.WaterResistanceBuckets.Count > 0)
        {
            if (waterMetres != null)
            {
                var relaxedBuckets = intent.WaterResistanceBuckets.Any(bucket =>
                    bucket switch
                    {
                        "Up to 30m" => waterMetres <= 30,
                        "50m – 120m" => waterMetres >= 50 && waterMetres <= 120,
                        "150m – 300m" => waterMetres >= 150 && waterMetres <= 300,
                        "600m+" => waterMetres >= 600,
                        _ => false,
                    });
                if (relaxedBuckets) score += 45;
            }
            else if (watch.Collection?.Styles.Contains("diver") == true) score += 25;
        }

        if (intent.Complications.Count > 0)
        {
            var matchedCount = intent.Complications.Count(complication =>
                functions.Any(fn => fn.Contains(complication, StringComparison.OrdinalIgnoreCase)));
            score += matchedCount * 15;
        }

        if (intent.PowerReserves.Count > 0 && powerReserveHours != null)
        {
            var minimum = MinimumPowerReserveForBuckets(intent.PowerReserves);
            if (powerReserveHours >= minimum) score += 35;
            else if (powerReserveHours >= minimum - 12) score += 15;
        }

        if (intent.Style != null)
        {
            if (watch.Collection?.Styles.Contains(intent.Style) == true) score += 50;
            else if (styleCollectionIds.Count > 0 && watch.CollectionId != null && styleCollectionIds.Contains(watch.CollectionId.Value)) score += 35;
        }

        return score;
    }

    private static double? ParseDiameterMm(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var numeric = new string(raw.Where(c => c == '.' || char.IsDigit(c)).ToArray());
        return double.TryParse(numeric, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var value) ? value : null;
    }

    private static int? ParseWaterResistanceMetres(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var match = Regex.Match(raw, @"(\d+)");
        return match.Success && int.TryParse(match.Groups[1].Value, out var metres) ? metres : null;
    }

    private static int? ParsePowerReserveHours(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var match = Regex.Match(raw, @"(\d+)");
        return match.Success && int.TryParse(match.Groups[1].Value, out var hours) ? hours : null;
    }

    private static int MinimumWaterResistanceForBuckets(List<string> buckets)
    {
        if (buckets.Contains("600m+")) return 600;
        if (buckets.Contains("150m – 300m")) return 150;
        if (buckets.Contains("50m – 120m")) return 50;
        if (buckets.Contains("Up to 30m")) return 0;
        return 0;
    }

    private static int MinimumPowerReserveForBuckets(List<string> buckets)
    {
        if (buckets.Contains("Over 100h")) return 100;
        if (buckets.Contains("72h – 100h")) return 72;
        if (buckets.Contains("48h – 72h")) return 48;
        if (buckets.Contains("Under 48h")) return 0;
        return 0;
    }

    private static int IntentPricePreferenceScore(Watch watch, QueryIntent? intent)
    {
        if (intent == null || (intent.MinPrice == null && intent.MaxPrice == null))
            return 0;

        if (watch.CurrentPrice <= 0)
            return -30;

        var targetPrice = TargetPriceFromIntent(intent);
        if (targetPrice == null)
            return 20;

        var delta = Math.Abs(watch.CurrentPrice - targetPrice.Value);
        if (delta <= 2_500m) return 45;
        if (delta <= 5_000m) return 35;
        if (delta <= 10_000m) return 20;
        if (delta <= 20_000m) return 10;
        return 0;
    }

    // Primary sort key that pins Price-on-Request (price 0) below every priced match — but only
    // when the user set a budget. A PoR watch can't be judged against a price ceiling, so it
    // belongs at the bottom of a budgeted shortlist; for non-price queries it returns 0 for all
    // rows, leaving the existing score ordering untouched.
    internal static int PriceOnRequestRank(Watch watch, QueryIntent? intent) =>
        (intent?.MinPrice != null || intent?.MaxPrice != null) && watch.CurrentPrice <= 0 ? 1 : 0;

    private static decimal PriceDistanceFromIntent(Watch watch, QueryIntent? intent)
    {
        if (watch.CurrentPrice <= 0)
            return decimal.MaxValue;

        var targetPrice = TargetPriceFromIntent(intent);
        return targetPrice == null
            ? watch.CurrentPrice
            : Math.Abs(watch.CurrentPrice - targetPrice.Value);
    }

    // A price "target" only exists when the user gave a bounded range or an "around $X"
    // phrasing (both MinPrice and MaxPrice set → midpoint). A lone MaxPrice ("under $X") is a
    // budget ceiling, not a target: every in-budget watch is equally acceptable, so return null
    // and let IntentPricePreferenceScore apply a flat in-budget score. Treating a cap as a target
    // pushed results to cluster just below the ceiling (e.g. only the most expensive sub-$20k pieces).
    private static decimal? TargetPriceFromIntent(QueryIntent? intent)
    {
        if (intent?.MinPrice != null && intent.MaxPrice != null)
            return (intent.MinPrice.Value + intent.MaxPrice.Value) / 2m;

        return null;
    }

    // Phase 3B retrieval: cosine similarity search against watch chunk embeddings.
    // Applies hard SQL pre-filters from QueryIntent (brand/collection/price) before cosine ranking.
    // Deduplicates chunks per watch in memory and returns best distance.
    private async Task<(List<Watch> Watches, float BestDistance)> VectorSearchAsync(
        float[] queryEmbedding,
        QueryIntent? intent,
        bool allowLooseMatches = false)
    {
        var queryVector = new Vector(queryEmbedding);

        // Base query: feature-scoped, distance-filtered, ordered by cosine similarity.
        // No Include — the WHERE clauses below reference e.Watch.* which EF translates
        // to an implicit JOIN, and the final Select projects only (WatchId, Distance)
        // so EF would drop any Include here anyway. Watches are reloaded with Brand
        // and Collection in the second query below.
        var q = _context.WatchEmbeddings
            .Where(e => e.Feature == "watch_finder" && e.Embedding != null && e.Embedding.CosineDistance(queryVector) < MaxDistance);

        // Hard SQL pre-filters from parsed intent — eliminate irrelevant candidates entirely.
        // Price 0 = "Price on Request"; never exclude PoR watches from a price-filtered search.
        if (intent?.BrandId      != null) q = q.Where(e => e.Watch.BrandId      == intent.BrandId);
        if (intent?.BrandIds?.Count > 0)  q = q.Where(e => intent.BrandIds.Contains(e.Watch.BrandId));
        if (intent?.ExcludedBrandIds?.Count > 0) q = q.Where(e => !intent.ExcludedBrandIds.Contains(e.Watch.BrandId));
        if (HasStrictCollectionIntent(intent) && intent?.CollectionId != null) q = q.Where(e => e.Watch.CollectionId == intent.CollectionId);
        if (HasStrictCollectionIntent(intent) && intent?.CollectionIds?.Count > 0) q = q.Where(e => e.Watch.CollectionId != null && intent.CollectionIds.Contains(e.Watch.CollectionId.Value));
        if (intent?.MaxPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice <= intent.MaxPrice);
        if (intent?.MinPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice >= intent.MinPrice);

        // Style filter: resolve style → tagged collection IDs → SQL IN.
        // Hard filter only when collection tags exist for that style — graceful degradation
        // if no collections are tagged (filter silently skips, vector + rerank handle style).
        // Untagged collections are not excluded — they surface as candidates naturally.
        List<int> styleCollectionIds = [];
        if (ShouldApplyStyleSqlFilter(intent))
        {
            var style = intent?.Style;
            if (style != null)
            {
                styleCollectionIds = await ResolveStyleCollectionIdsAsync(_context, style);
                if (styleCollectionIds.Count > 0)
                    q = q.Where(e => e.Watch.CollectionId != null
                                  && styleCollectionIds.Contains((int)e.Watch.CollectionId));
            }
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
        var hasHardFilters = intent?.BrandId != null || HasStrictCollectionIntent(intent)
            || intent?.MaxPrice != null || intent?.MinPrice != null
            || intent?.BrandIds?.Count > 0
            || intent?.ExcludedBrandIds?.Count > 0
            || (intent?.CollectionsDerivedFromStyle != true && intent?.CollectionIds?.Count > 0)
            || styleCollectionIds.Count > 0;

        // Relevance gate rejects unconstrained queries whose best match is too distant —
        // a second widening pass passes allowLooseMatches=true to surface best-effort
        // alternatives instead of refusing on embedding noise (e.g. "watches for women"
        // vs "watch for women" where singular/plural tips the distance across the gate).
        if (topIds.Count == 0 || (!hasHardFilters && !allowLooseMatches && bestDist >= MinRelevance))
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

        var hadPrimaryCollections = HasCollectionIntent(primary);
        ApplyCollectionMatches(primary, IntentCollections(fallback, collections));
        if (!hadPrimaryCollections && fallback.CollectionsDerivedFromStyle)
            primary.CollectionsDerivedFromStyle = true;
        if (fallback.MinPrice != null || fallback.MaxPrice != null)
        {
            primary.MinPrice = fallback.MinPrice;
            primary.MaxPrice = fallback.MaxPrice;
        }
        if (fallback.MinDiameterMm != null || fallback.MaxDiameterMm != null)
        {
            primary.MinDiameterMm = fallback.MinDiameterMm;
            primary.MaxDiameterMm = fallback.MaxDiameterMm;
        }
        primary.CaseMaterial ??= fallback.CaseMaterial;
        primary.DialColour ??= fallback.DialColour;
        primary.DialColourPhrase ??= fallback.DialColourPhrase;
        if (primary.ExcludedMaterials.Count == 0) primary.ExcludedMaterials = fallback.ExcludedMaterials;
        if (primary.ExcludedComplications.Count == 0) primary.ExcludedComplications = fallback.ExcludedComplications;
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
        query = QueryNormalizer.ExpandCompoundTerms(query);
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
        foreach (var (alias, canonical) in QueryNormalizer.BrandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                var b = QueryNormalizer.TryResolveBrand(canonical, brands);
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
            ResolveFuzzyCollections(
                query,
                collections,
                matchedBrands.Select(b => b!.Id).ToHashSet(),
                BuildBlockedCollectionTokens(matchedBrands.Select(b => b!))));
        ReconcileCollectionBrandScope(intent, collections);

        // ── Soft filters (frontend pre-population only) ───────────────────────────
        // Note: MovementType is intentionally omitted — the LLM infers it from complications
        // (e.g. tourbillon → Manual-winding) even when not explicitly stated, causing over-filtering.
        intent.Style = parsed.Style;
        if (intent.Style != null && HasOccasionOnlyWatchSignals(query) && !HasExplicitStyleLanguage(query))
            intent.Style = null;

        // Style keyword fallback — style→collection taxonomy is an allowed deterministic mapping.
        // If the LLM missed an obvious style keyword ("sport watches", "dress watch", "diver"),
        // detect it from the raw query so the SQL style filter is always applied correctly.
        if (intent.Style == null)
        {
            var qLow = query.ToLowerInvariant();
            if (Regex.IsMatch(qLow, @"\bsport\s*watch"))      intent.Style = "sport";
            else if (Regex.IsMatch(qLow, @"\bdress\s*watch")) intent.Style = "dress";
            else if (Regex.IsMatch(qLow, @"\bdiv(?:er|e\s*watch|ing\s*watch)")) intent.Style = "diver";
            else if (Regex.IsMatch(qLow, @"\b(?:art\s*piece|haute\s*horlogerie|collector\s*(?:watch|piece)|artistic\s*watch)\b")) intent.Style = "art";
        }
        intent.CaseMaterial  = NormaliseMaterial((parsed.Material ?? []).FirstOrDefault());
        intent.MinDiameterMm = parsed.MinDiameterMm;
        intent.MaxDiameterMm = parsed.MaxDiameterMm;
        intent.Complications = NormaliseComplications(parsed.Complications ?? []);
        intent.PowerReserves = NormalisePowerReserve(parsed.PowerReserveHours);
        if (QueryMentionsWaterResistance(query))
            intent.WaterResistanceBuckets = NormaliseWaterResistance(parsed.WaterResistanceMin);
        ApplyStyleCollectionsFromBrandScope(intent, collections);

        // Return null if nothing was extracted — avoids unnecessary intent propagation
        if (intent.BrandId == null && intent.CollectionId == null && intent.BrandIds.Count == 0 && intent.CollectionIds.Count == 0
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.Style == null && intent.CaseMaterial == null && intent.DialColour == null
            && intent.ExcludedMaterials.Count == 0 && intent.ExcludedComplications.Count == 0
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

    // Terms a user can rule out, mapped to the value stored in the catalogue. Kept deliberately
    // small: a negation the parser does not recognise must fall through to the semantic path
    // rather than be half-applied, which would be worse than not handling it at all.
    private static readonly (string Pattern, string Material)[] ExcludableMaterials =
    [
        (@"(?:rose|pink)\s+gold", "rose gold"),
        (@"white\s+gold", "white gold"),
        (@"yellow\s+gold", "yellow gold"),
        (@"gold", "gold"),
        (@"(?:stainless\s+)?steel", "steel"),
        (@"titanium", "titanium"),
        (@"platinum", "platinum"),
        (@"ceramic", "ceramic"),
    ];

    private static readonly (string Pattern, string Complication)[] ExcludableComplications =
    [
        (@"chronographs?", "chronograph"),
        (@"moon\s?phases?", "moon"),
        (@"perpetual\s+calendars?", "perpetual calendar"),
        (@"annual\s+calendars?", "annual calendar"),
        (@"tourbillons?", "tourbillon"),
        (@"gmts?|dual\s+time", "gmt"),
        (@"date\s+windows?|dates?", "date"),
    ];

    /// Pulls "not X" / "except X" / "without X" out of the query into the exclusion lists and
    /// returns the query with those spans removed, so the positive matchers never see them.
    /// Only the span belonging to a recognised term is cut — the rest of the sentence stays,
    /// because "a dress watch under 40mm, but definitely not gold" still has to yield the
    /// style and the size.
    internal static string ExtractExclusions(string query, QueryIntent intent)
    {
        const string lead = @"\b(?:not|no|without|except(?:\s+for)?|excluding|other\s+than|apart\s+from|anything\s+but)\b[\s,]*(?:a|an|the)?\s*";

        foreach (var (pattern, material) in ExcludableMaterials)
        {
            var match = Regex.Match(query, lead + $@"(?<term>{pattern})\b", RegexOptions.IgnoreCase);
            if (!match.Success) continue;
            if (!intent.ExcludedMaterials.Contains(material)) intent.ExcludedMaterials.Add(material);
            query = query.Remove(match.Index, match.Length);
        }

        foreach (var (pattern, complication) in ExcludableComplications)
        {
            var match = Regex.Match(query, lead + $@"(?<term>{pattern})\b", RegexOptions.IgnoreCase);
            if (!match.Success) continue;
            if (!intent.ExcludedComplications.Contains(complication)) intent.ExcludedComplications.Add(complication);
            query = query.Remove(match.Index, match.Length);
        }

        return Regex.Replace(query, @"\s{2,}", " ").Trim();
    }

    // Catalogue dials are scraped free text: 112 distinct spellings across the catalogue, where
    // "argenté", "silver-toned", "silvered grey" and "silver guilloché" are all the same colour
    // to a buyer. Both the query and the stored value collapse to this set before matching, so
    // a dial query can be served by SQL instead of falling through to the vector pipeline.
    private static readonly (string Canonical, string[] Spellings)[] DialColourVocabulary =
    [
        ("Silver", ["silver", "silvered", "silver-toned", "silver toned", "argente", "argenté", "argent"]),
        ("Black",  ["black", "noir", "onyx"]),
        ("Blue",   ["blue", "bleu", "navy"]),
        ("Green",  ["green", "vert", "olive"]),
        ("White",  ["white", "blanc", "ivory", "cream", "opaline"]),
        ("Grey",   ["grey", "gray", "anthracite", "slate", "graphite"]),
        ("Brown",  ["brown", "chocolate", "bronze dial"]),
        ("Salmon", ["salmon"]),
        ("Champagne", ["champagne"]),
        ("Skeleton", ["openworked", "skeleton", "skeletonised", "skeletonized", "sapphire"]),
    ];

    /// Maps any dial description — a stored spec value or a phrase from a query — onto the
    /// canonical colour set. Returns null when nothing recognisable is present.
    internal static string? NormaliseDialColour(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var normalised = QueryNormalizer.NormalizeText(raw);

        foreach (var (canonical, spellings) in DialColourVocabulary)
        {
            foreach (var spelling in spellings)
            {
                // Compare on normalised text so diacritics never decide the outcome:
                // "argenté" and "argente" have to reach the same bucket.
                if (normalised.Contains(QueryNormalizer.NormalizeText(spelling), StringComparison.Ordinal))
                    return canonical;
            }
        }
        return null;
    }

    /// True when a stored dial value denotes the requested colour. Substring comparison would
    /// be wrong here: the stored text is a phrase like "silver-toned sunburst", not a colour name.
    private static bool DialColourMatches(string? storedDial, string canonicalWanted) =>
        NormaliseDialColour(storedDial) == canonicalWanted;

    // The catalogue spells movement type 23 ways — "Automatic", "Self-winding", "Automatic
    // manufacture", "Spring Drive automatic" are one thing to a buyer, and 97 of the 228
    // automatics do not contain the word "automatic". Substring matching on the query's word
    // found only the literal spelling and silently dropped the rest.
    /// The diameter patterns above accept the figure either before or after the bound word, so
    /// the value lands in whichever of the two groups matched.
    private static double? ParseDiameterGroup(Match match)
    {
        var text = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
        return double.TryParse(text, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var value) ? value : null;
    }

    internal static string? NormaliseMovementFamily(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var r = raw.ToLowerInvariant();
        if (r.Contains("quartz") || r.Contains("electromechanical")) return "Quartz";
        if (r.Contains("self-winding") || r.Contains("self winding")
            || r.Contains("automatic") || r.Contains("spring drive")) return "Automatic";
        if (r.Contains("hand-wound") || r.Contains("hand wound") || r.Contains("manual")) return "Manual";
        return null;
    }

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

    private static bool HasExplicitStyleLanguage(string query) =>
        Regex.IsMatch(query,
            @"\b(?:sport|sports|sporty|sport\s*watch|dress|formal|elegant|elegance|dress\s*watch|dive|diver|diver\s*watch|diving|waterproof)\b",
            RegexOptions.IgnoreCase);

    private static bool HasOccasionOnlyWatchSignals(string query) =>
        Regex.IsMatch(query,
            @"\b(?:daily\s+driver|daily\s+wear|everyday\s+wear|travel\s+watch|office\s+watch|business\s+watch|weekend\s+watch)\b",
            RegexOptions.IgnoreCase);

    internal static List<Collection> ResolveFuzzyCollections(
        string query,
        List<Collection> collections,
        HashSet<int> matchedBrandIds,
        HashSet<string>? blockedTokens = null)
    {
        // Money units are rewritten to digits before any name is matched. "twenty grand" is an
        // amount, but "grand" on its own is the first word of Grand Seiko and Grand Complications,
        // and matching it there resolved a collection nobody named — which then filtered the
        // search to that collection under a $20,000 ceiling and returned nothing.
        // NormalizeNumberWords only consumes a scale word when a number precedes it, so the
        // brand and collection names themselves come through untouched.
        var forMatching = QueryNormalizer.NormalizeNumberWords(query);
        var tokens = TokenizeQuery(forMatching)
            .Where(token => blockedTokens == null || !blockedTokens.Contains(token))
            .ToList();
        var normalisedQuery = QueryNormalizer.CompactText(forMatching);
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
        var collectionKey = QueryNormalizer.CompactText(collection.Name);
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

    private static void ApplyStyleCollectionsFromBrandScope(QueryIntent intent, List<Collection>? collections)
    {
        if (collections == null || string.IsNullOrWhiteSpace(intent.Style)) return;
        if (intent.CollectionId != null || intent.CollectionIds.Count > 0) return;

        var scopedBrandIds = intent.BrandIds.Count > 0
            ? intent.BrandIds
            : intent.BrandId != null ? [intent.BrandId.Value] : [];
        if (scopedBrandIds.Count == 0) return;

        var styleCollections = collections
            .Where(c => scopedBrandIds.Contains(c.BrandId))
            .Where(c => c.Styles.Any(s => string.Equals(s, intent.Style, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        if (styleCollections.Count == 0) return;

        ApplyCollectionMatches(intent, styleCollections);
        intent.CollectionsDerivedFromStyle = true;
        ReconcileCollectionBrandScope(intent, collections);
    }

    internal static HashSet<string> BuildBlockedCollectionTokens(IEnumerable<Brand> brands) =>
        brands
            .SelectMany(brand => TokenizeQuery(brand.Name))
            .Where(token => token.Length >= 4)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static List<string> TokenizeQuery(string text) =>
        Regex.Split(text.ToLowerInvariant(), @"[^a-z0-9]+")
            .Where(t => t.Length >= 4)
            .Where(t => !CollectionTokenStopWords.Contains(t))
            .Distinct()
            .ToList();

    private static List<string> TokenizeDirectQuery(string text) =>
        Regex.Split(text.ToLowerInvariant(), @"[^a-z0-9]+")
            .Where(t => t.Length >= 3)
            .Where(t => !CollectionTokenStopWords.Contains(t))
            .Distinct()
            .ToList();

    private static readonly HashSet<string> CollectionTokenStopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "watch", "watches", "timepiece", "timepieces", "collection",
        "sport", "sporty", "dress", "formal", "elegant", "elegance",
        "dive", "diver", "diving", "water", "resistance", "resistant", "waterproof",
        "from", "brand",
        "under", "below", "less", "than", "over", "above", "more", "between",
        "with", "good", "decent", "solid", "high",
    };

    internal static bool IsLikelyReferenceQuery(string query) =>
        Regex.IsMatch(query.Trim(), @"\b[A-Z0-9]+(?:[./-][A-Z0-9]+)+\b", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query.Trim(), @"\b(?=[A-Z0-9]{8,}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+\b", RegexOptions.IgnoreCase);

    internal static bool IsLikelyReferenceFragment(string query)
    {
        var trimmed = query.Trim();
        if (!Regex.IsMatch(trimmed, @"^[A-Z0-9]{4,12}$", RegexOptions.IgnoreCase))
            return false;

        if (Regex.IsMatch(trimmed, @"^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4,12}$", RegexOptions.IgnoreCase))
            return true;

        if (Regex.IsMatch(trimmed, @"^\d{5,12}$", RegexOptions.IgnoreCase))
            return true;

        return Regex.IsMatch(trimmed, @"^[A-Z]{4,5}$");
    }

    // A query the classifier calls non_watch is only refused above this confidence. Below it the
    // verdict is too weak to override the prior that text typed into a watch search box is on-topic.
    private const double NonWatchConfidence = 0.7;

    /// Second opinion on a query whose wording matched none of the domain vocabulary below.
    /// That miss is weak evidence: the regex is an allowlist and cannot enumerate how people
    /// actually phrase a brief ("a deep blue face" is a dial query; "time a lap" is a chronograph).
    /// So refusal now needs positive evidence of being off-topic, not merely absent evidence of
    /// being on-topic. When the classifier is unreachable the regex verdict stands, per the
    /// semantic-first-with-regex-fallback rule the rest of the routing layer follows.
    private async Task<bool> IsOffTopicAsync(string query)
    {
        if (_classifier == null) return true;

        var classification = await _classifier.ClassifyAsync(query, [], [], "none", 0, []);

        // ClassifyAsync reports an unreachable or failed ai-service as unclear at zero confidence,
        // which is the one case where there is no verdict to defer to.
        if (classification.Confidence <= 0) return true;

        return classification.Intent == "non_watch"
            && classification.Confidence >= NonWatchConfidence;
    }

    internal static bool HasWatchDomainSignal(string query) =>
        IsLikelyReferenceQuery(query)
        || IsLikelyReferenceFragment(query)
        || Regex.IsMatch(query,
            @"\b(?:watch|watches|timepiece|timepieces|horology|luxury|wrist|diameter|dial|case|bracelet|strap|movement|automatic|manual|quartz|digital|analog|analogue|dress|dressy|dressier|dresswatch|sport|sportwatch|sporty|sportier|diver|diverwatch|diving|water[\s-]?resist(?:ant|ance)?|waterproof|gmt|chronograph|perpetual|annual|calendar|moonphase|tourbillon|repeater|steel|gold|titanium|ceramic|platinum|fancier|classier|refined|elegant)\b",
            RegexOptions.IgnoreCase)
        || Regex.IsMatch(query,
            @"\b(?:affordable|budget[-\s]?friendly|entry[-\s]?level|accessible|starter)\b|\bstudent\b",
            RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:under|below|over|above|between)\s*\$?\s*\d[\d,]*\s*k?\b", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b\d+(?:\.\d+)?\s*mm\b", RegexOptions.IgnoreCase);

    internal Task<QueryIntent?> ParseQueryIntentForTestsAsync(string query) =>
        ParseQueryIntentAsync(query);

    internal Task<WatchFinderResult?> TryDirectSqlSearchForTestsAsync(string query, QueryIntent? intent, string searchPath = "test_direct") =>
        _deterministicSearch.TryDirectSqlSearchAsync(query, intent, searchPath);

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
            ("Over $100k", 100_000, decimal.MaxValue),
        };

        var selected = new List<string> { "Price on Request" };
        selected.AddRange(buckets
            .Where(b => (maxPrice == null || b.Min < maxPrice) && (minPrice == null || b.Max > minPrice))
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
        query = QueryNormalizer.ExpandCompoundTerms(query);
        var intent = new QueryIntent();

        // ── Brand matching ────────────────────────────────────────────────────────
        var brands = await _context.Brands.AsNoTracking().ToListAsync();

        // Collect all matched brands — if 2+ found, it's a multi-brand query.
        // In that case skip the hard BrandId SQL filter so all brands can surface via vector search.
        var matchedBrands = new List<Brand>();

        // Check aliases first — word-boundary match to prevent "chronograph" matching "AP"
        var resolvedCanonicals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (alias, canonical) in QueryNormalizer.BrandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                var b = QueryNormalizer.TryResolveBrand(canonical, brands);
                if (b != null && resolvedCanonicals.Add(b.Name))
                    matchedBrands.Add(b);
            }
        }

        // Fall back to full brand name substring match for brands not caught by aliases
        foreach (var brand in brands.OrderByDescending(b => b.Name.Length))
        {
            var matchesBrandName =
                query.Contains(brand.Name, StringComparison.OrdinalIgnoreCase)
                || QueryNormalizer.CompactText(query).Contains(QueryNormalizer.CompactText(brand.Name), StringComparison.OrdinalIgnoreCase);
            if (matchesBrandName && resolvedCanonicals.Add(brand.Name))
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
        var normalisedQuery = QueryNormalizer.CompactText(query);

        var exactCollections = pool
            .OrderByDescending(c => c.Name.Length)
            .Where(c =>
                query.Contains(c.Name, StringComparison.OrdinalIgnoreCase) ||
                (QueryNormalizer.CompactText(c.Name).Length >= 4 && normalisedQuery.Contains(QueryNormalizer.CompactText(c.Name))))
            .ToList();

        // If no hit within the brand pool, try all collections (e.g. generic query).
        if (exactCollections.Count == 0 && matchedBrandIds.Count > 0)
        {
            exactCollections = collections
                .OrderByDescending(c => c.Name.Length)
                .Where(c =>
                    query.Contains(c.Name, StringComparison.OrdinalIgnoreCase) ||
                    (QueryNormalizer.CompactText(c.Name).Length >= 4 && normalisedQuery.Contains(QueryNormalizer.CompactText(c.Name))))
                .ToList();
        }

        var blockedCollectionTokens = BuildBlockedCollectionTokens(matchedBrands);

        ApplyCollectionMatches(intent, exactCollections);
        ApplyCollectionMatches(intent, ResolveFuzzyCollections(query, collections, matchedBrandIds, blockedCollectionTokens));
        ReconcileCollectionBrandScope(intent, collections);

        ApplyRegexFilters(query, intent);
        ApplyStyleCollectionsFromBrandScope(intent, collections);

        // Return null if nothing was extracted — no filters to apply
        if (intent.BrandId == null && intent.CollectionId == null
            && intent.BrandIds.Count == 0 && intent.CollectionIds.Count == 0
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.MinDiameterMm == null && intent.MaxDiameterMm == null
            && intent.CaseMaterial == null && intent.MovementType == null
            && intent.DialColour == null
            && intent.ExcludedMaterials.Count == 0 && intent.ExcludedComplications.Count == 0
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
        query = QueryNormalizer.ExpandCompoundTerms(query);
        // Negations are read first and cut out of the working string. Order matters: left in,
        // "not gold" would reach the material matcher below and be recorded as a request for
        // gold — the exact inverse of what was asked.
        var q = ExtractExclusions(query, intent);

        // ── Price matching ──────────────────────────────────────────────────────────
        // Spelled-out amounts are rewritten as digits for the price patterns only. A price is
        // structural, so extracting it should never need a model; before this, "fifty thousand
        // dollars" fell through to the LLM parse purely for want of a digit. The substitution is
        // kept off `q` so brand and collection resolution still see the original wording.
        var priceQuery = QueryNormalizer.NormalizeNumberWords(q);
        var between = Regex.Match(priceQuery,
            @"between\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)\s*(?:and|to|[-–])\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
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
            var upper = Regex.Match(priceQuery,
                @"(?:under|below|less\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (upper.Success)
                intent.MaxPrice = ParsePriceToken(upper.Groups[1].Value, upper.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));

            // "nothing over 20k" and "no more than 20k" are ceilings. Matching the lower-bound
            // pattern first would read them as floors and return the exact opposite band.
            var negatedUpper = Regex.Match(priceQuery,
                @"\b(?:nothing|not(?:hing)?|no)\s+(?:more\s+than|over|above)\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (negatedUpper.Success)
            {
                intent.MaxPrice = ParsePriceToken(
                    negatedUpper.Groups[1].Value,
                    negatedUpper.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
                priceQuery = priceQuery.Remove(negatedUpper.Index, negatedUpper.Length);
            }

            var lower = Regex.Match(priceQuery,
                @"(?:over|above|more\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (lower.Success)
                intent.MinPrice = ParsePriceToken(lower.Groups[1].Value, lower.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));

            if (intent.MinPrice == null && intent.MaxPrice == null)
            {
                var approximate = Regex.Match(priceQuery,
                    @"(?:around|about|roughly|approximately|approx\.?|near|close\s+to|~)\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
                    RegexOptions.IgnoreCase);
                if (approximate.Success)
                {
                    var target = ParsePriceToken(
                        approximate.Groups[1].Value,
                        approximate.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
                    ApplyApproximatePriceBand(intent, target);
                }
            }

            if (intent.MaxPrice == null && intent.MinPrice == null)
            {
                var budgetCap = Regex.Match(priceQuery,
                    @"\b(?:budget|cap|ceiling|max(?:imum)?|up\s+to)\s*(?:of|is)?\s*\$?\s*(\d[\d,]*)\s*(k?)\b(?!\s*mm)",
                    RegexOptions.IgnoreCase);
                if (budgetCap.Success)
                {
                    intent.MaxPrice = ParsePriceToken(
                        budgetCap.Groups[1].Value,
                        budgetCap.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
                }
            }

            // Vague affordability terms with no number map to the accessible-luxury ceiling so the
            // price pre-filter pulls in entry-tier priced pieces, instead of the vector search
            // surfacing expensive Price-on-Request grails for "affordable everyday watches".
            if (intent.MaxPrice == null && intent.MinPrice == null
                && Regex.IsMatch(q, @"\b(?:affordable|budget[-\s]?friendly|entry[-\s]?level|accessible|starter|inexpensive)\b|\bstudent\b", RegexOptions.IgnoreCase))
            {
                intent.MaxPrice = AffordableCeiling;
            }
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
            // A bound has to be read before the bare "40mm" pattern, which pins the diameter to
            // exactly that figure. "under 40mm" pinned to 40.0 returns only the watches measuring
            // precisely 40mm and drops every smaller one the user asked for.
            var diamCeiling = Regex.Match(q,
                @"(?:under|below|less\s+than|up\s+to|smaller\s+than|at\s+most)\s*(\d+(?:\.\d+)?)\s*mm"
                + @"|(\d+(?:\.\d+)?)\s*mm\s*(?:or\s+(?:smaller|less|under)|and\s+(?:under|below))",
                RegexOptions.IgnoreCase);
            var diamFloor = Regex.Match(q,
                @"(?:over|above|more\s+than|larger\s+than|bigger\s+than|at\s+least)\s*(\d+(?:\.\d+)?)\s*mm"
                + @"|(\d+(?:\.\d+)?)\s*mm\s*(?:or\s+(?:larger|bigger|more)|and\s+(?:above|over|up))",
                RegexOptions.IgnoreCase);

            if (diamCeiling.Success)
            {
                intent.MaxDiameterMm = ParseDiameterGroup(diamCeiling);
            }
            else if (diamFloor.Success)
            {
                intent.MinDiameterMm = ParseDiameterGroup(diamFloor);
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

        // ── Dial colour matching ────────────────────────────────────────────────────
        // A colour only counts when the query ties it to the dial ("blue dial", "dial in
        // silver", "a deep blue face"). Left unqualified it usually describes the case or the
        // strap — "rose gold watch" is a material request, not a request for a gold dial.
        var dialPhrase = Regex.Match(q,
            @"\b(?<colour>[\p{L}-]+(?:\s+[\p{L}-]+)?)\s+(?:dial|face)\b|\b(?:dial|face)\s+(?:in|is)\s+(?<colour2>[\p{L}-]+)",
            RegexOptions.IgnoreCase);
        if (dialPhrase.Success)
        {
            var colourText = dialPhrase.Groups["colour"].Success
                ? dialPhrase.Groups["colour"].Value
                : dialPhrase.Groups["colour2"].Value;
            intent.DialColour = NormaliseDialColour(colourText);
            if (intent.DialColour != null) intent.DialColourPhrase = colourText.Trim();
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
        if (Regex.IsMatch(q, @"\b(?:sport|sports|sporty|sport\s*watch)\b", RegexOptions.IgnoreCase))
            intent.Style = "sport";
        else if (Regex.IsMatch(q, @"\b(?:dress|formal|elegant|elegance|dress\s*watch)\b", RegexOptions.IgnoreCase))
            intent.Style = "dress";
        else if (Regex.IsMatch(q, @"\b(?:dive|diver|diver\s*watch|diving|waterproof)\b", RegexOptions.IgnoreCase))
            intent.Style = "diver";
        else if (Regex.IsMatch(q, @"\b(?:art\s*piece|haute\s*horlogerie|collector\s*watch|collector\s*piece|artistic)\b", RegexOptions.IgnoreCase))
            intent.Style = "art";

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

    private static void ApplyApproximatePriceBand(QueryIntent intent, decimal targetPrice)
    {
        if (targetPrice <= 0)
            return;

        var spread = Math.Max(5_000m, Math.Round(targetPrice * 0.25m / 1_000m, MidpointRounding.AwayFromZero) * 1_000m);
        intent.MinPrice = Math.Max(1_000m, targetPrice - spread);
        intent.MaxPrice = targetPrice + spread;
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
            _logger.LogInformation("WatchFinder embed {ElapsedMs}ms", sw.ElapsedMilliseconds);
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
        // Timed at Information alongside the rerank call: these are the two LLM round trips on
        // the semantic path, and without both being visible a slow search cannot be attributed.
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var parseResp = await httpClient.PostAsJsonAsync("/watch-finder/parse", new { query });
            _logger.LogInformation("WatchFinder parse {ElapsedMs}ms status={Status}",
                sw.ElapsedMilliseconds, (int)parseResp.StatusCode);
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
