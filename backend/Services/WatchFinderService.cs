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
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        // Steps 0a + 0b run in parallel — LLM parse and embedding have similar latency (~200ms each).
        // LLM parse replaces the old regex approach: the model understands nuanced phrasing,
        // multi-brand queries, and all filter dimensions without hardcoded patterns.
        var parseTask = ParseIntentFromLlmAsync(httpClient, query);
        var embedTask = EmbedQueryAsync(httpClient, query);
        await Task.WhenAll(parseTask, embedTask);

        var queryIntent   = await parseTask;
        var queryEmbedding = await embedTask;

        // Skip cache when hard SQL filters are active (price or single brand) — a cached
        // "dress watch" result must not be reused for "Vacheron dress watch".
        var hasHardFilters = queryIntent?.BrandId != null || queryIntent?.CollectionId != null
            || queryIntent?.MaxPrice != null || queryIntent?.MinPrice != null;
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
        // Hard SQL pre-filters: only price + single-brand (high-confidence explicit constraints).
        // Everything else (style, water resistance, complications) is soft — pre-populates the
        // frontend filter bar but does not remove candidates from the pool.
        List<Watch> candidates;
        float bestDistance = float.MaxValue;

        if (queryEmbedding != null)
        {
            (candidates, bestDistance) = await VectorSearchAsync(queryEmbedding, queryIntent);
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
        if (intent?.CollectionId != null) q = q.Where(e => e.Watch.CollectionId == intent.CollectionId);
        if (intent?.MaxPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice <= intent.MaxPrice);
        if (intent?.MinPrice     != null) q = q.Where(e => e.Watch.CurrentPrice == 0 || e.Watch.CurrentPrice >= intent.MinPrice);

        // Style filter: resolve style → tagged collection IDs → SQL IN.
        // Hard filter only when collection tags exist for that style — graceful degradation
        // if no collections are tagged (filter silently skips, vector + rerank handle style).
        // Untagged collections are not excluded — they surface as candidates naturally.
        List<int> styleCollectionIds = [];
        if (intent?.Style != null)
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
    private async Task<QueryIntent?> ParseIntentFromLlmAsync(HttpClient httpClient, string query)
    {
        ParsedIntent? parsed = null;
        try
        {
            parsed = await ParseIntentAsync(httpClient, query);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LLM intent parse failed — returning null intent");
            return null;
        }

        if (parsed == null) return null;

        // Load brands + collections for name → ID resolution
        var brands      = await _context.Brands.AsNoTracking().ToListAsync();
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

        return MapParsedIntentToQueryIntent(parsed, brands, collections);
    }

    // Maps a ParsedIntent (LLM output) to a QueryIntent (hard SQL + soft frontend filters).
    // Hard SQL: price (explicit) and single brand (exactly 1 named). Everything else is soft.
    private static QueryIntent? MapParsedIntentToQueryIntent(
        ParsedIntent parsed, List<Brand> brands, List<Collection> collections)
    {
        var intent = new QueryIntent();

        // ── Price (always hard) ───────────────────────────────────────────────────
        intent.MaxPrice = parsed.MaxPrice;
        intent.MinPrice = parsed.MinPrice;

        // ── Brand resolution ──────────────────────────────────────────────────────
        // Match LLM-returned brand names against DB brands (case-insensitive substring).
        var matchedBrands = parsed.Brands
            .Select(name => brands.FirstOrDefault(b =>
                b.Name.Contains(name, StringComparison.OrdinalIgnoreCase) ||
                name.Contains(b.Name, StringComparison.OrdinalIgnoreCase)))
            .Where(b => b != null)
            .Distinct()
            .ToList();

        // Hard SQL brand filter only when exactly 1 brand named — multi-brand queries rely on vector.
        if (matchedBrands.Count == 1)
            intent.BrandId = matchedBrands[0]!.Id;

        // ── Collection resolution ─────────────────────────────────────────────────
        // Only apply when a single brand was matched (scoped search).
        if (parsed.Collection != null && matchedBrands.Count == 1)
        {
            var pool = collections.Where(c => c.BrandId == matchedBrands[0]!.Id).ToList();
            var matched = pool.FirstOrDefault(c =>
                c.Name.Contains(parsed.Collection, StringComparison.OrdinalIgnoreCase) ||
                parsed.Collection.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
            if (matched != null)
                intent.CollectionId = matched.Id;
        }

        // ── Soft filters (frontend pre-population only) ───────────────────────────
        intent.Style         = parsed.Style;
        intent.MovementType  = NormaliseMovement(parsed.Movement);
        intent.CaseMaterial  = NormaliseMaterial(parsed.Material.FirstOrDefault());
        intent.MinDiameterMm = parsed.MinDiameterMm;
        intent.MaxDiameterMm = parsed.MaxDiameterMm;
        intent.Complications = NormaliseComplications(parsed.Complications);
        intent.PowerReserves = NormalisePowerReserve(parsed.PowerReserveHours);
        intent.WaterResistanceBuckets = NormaliseWaterResistance(parsed.WaterResistanceMin);

        // Return null if nothing was extracted — avoids unnecessary intent propagation
        if (intent.BrandId == null && intent.CollectionId == null
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.Style == null && intent.CaseMaterial == null
            && intent.MovementType == null && intent.WaterResistanceBuckets.Count == 0
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

    // Legacy regex-based intent extractor — kept for reference and unit testing.
    // No longer called in the main pipeline (replaced by ParseIntentFromLlmAsync).
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

        // Single brand: apply as hard SQL filter. Multiple brands: let vector search handle it.
        Brand? matchedBrand = matchedBrands.Count == 1 ? matchedBrands[0] : null;

        if (matchedBrand != null)
            intent.BrandId = matchedBrand.Id;

        // ── Collection matching ───────────────────────────────────────────────────
        // Skip collection filter on multi-brand queries — each brand has its own collections.
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

        if (matchedBrands.Count <= 1)
        {
            // Prefer collections belonging to the matched brand, then try all collections.
            var pool = matchedBrand != null
                ? collections.Where(c => c.BrandId == matchedBrand.Id).ToList()
                : collections;

            var matchedCollection = pool
                .OrderByDescending(c => c.Name.Length)
                .FirstOrDefault(c => query.Contains(c.Name, StringComparison.OrdinalIgnoreCase));

            // If no hit within the brand pool, try all collections (e.g. generic query)
            if (matchedCollection == null && matchedBrand != null)
            {
                matchedCollection = collections
                    .OrderByDescending(c => c.Name.Length)
                    .FirstOrDefault(c => query.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
            }

            if (matchedCollection != null)
                intent.CollectionId = matchedCollection.Id;
        }

        ApplyRegexFilters(query, intent);

        // Return null if nothing was extracted — no filters to apply
        if (intent.BrandId == null && intent.CollectionId == null
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
            @"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*mm",
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
            @"(\d+)\s*(?:m(?:eters?)?|atm|bar)\s*(?:water\s*resist(?:ant|ance)?|waterproof|WR)?",
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
