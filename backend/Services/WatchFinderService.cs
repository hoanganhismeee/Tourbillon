// Orchestrates the AI Watch Finder pipeline:
// Phase 3B: embed query → vector similarity search → LLM rerank
// Hybrid filtering: ParseQueryIntentAsync extracts brand/collection/price as hard SQL pre-filters.
// Fallback (embed unavailable): LLM parse → SQL filter → LLM rerank

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
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly QueryCacheService _queryCache;

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

        // Step 0a: parse structured intent (brand/collection/price) from query text.
        // Pure DB lookup + regex — no LLM, fast.
        var queryIntent = await ParseQueryIntentAsync(query);

        // Step 0b: embed query + check QueryCache.
        // nomic-embed-text (~50ms) runs independently of the LLM.
        // Skip cache when QueryIntent has hard SQL filters — a cached "dress watch" result
        // must not be reused for "Vacheron dress watch" (which needs brand pre-filtering).
        var hasHardFilters = queryIntent?.BrandId != null || queryIntent?.CollectionId != null
            || queryIntent?.MaxPrice != null || queryIntent?.MinPrice != null
            || queryIntent?.Style != null;
        var queryEmbedding = await EmbedQueryAsync(httpClient, query);
        if (queryEmbedding != null && !hasHardFilters)
        {
            var cached = await _queryCache.LookupAsync(queryEmbedding);
            if (cached != null)
            {
                cached.QueryIntent = queryIntent;
                return cached;
            }
        }

        // Step 1: retrieve candidates.
        // Phase 3B — vector similarity against WatchEmbeddings (4 chunks per watch).
        // Each watch's best-matching chunk is used; top 30 by cosine distance returned.
        // Fallback to LLM parse + SQL filter if embeddings are unavailable.
        List<Watch> candidates;
        ParsedIntent? intent    = null;
        float bestDistance      = float.MaxValue;

        if (queryEmbedding != null)
        {
            (candidates, bestDistance) = await VectorSearchAsync(queryEmbedding, queryIntent);
            candidates = BrandSpread(candidates, candidates.Count);
        }
        else
        {
            // Embed unavailable — fall back to Phase 2 pipeline
            var parseTask = ParseIntentAsync(httpClient, query);
            var dbTask    = _context.Watches.Include(w => w.Brand).Include(w => w.Collection).AsNoTracking().ToListAsync();
            await Task.WhenAll(parseTask, dbTask);
            intent = await parseTask;
            var allWatches = await dbTask;
            var filtered = (intent != null ? _mapper.Apply(allWatches, intent) : allWatches).ToList();
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
        if (candidates.Count == 0) return result;

        // Tier 3: LLM rerank — skipped when vector match is already decisive (Tier 2)
        if (bestDistance >= SkipLlmDistance)
        {
        var rerankCandidates   = candidates.Take(RerankLimit).ToList();
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
                    collection = w.Collection?.Name ?? "",
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

        } // end Tier 3 rerank

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

        // Attach structured intent to result — frontend uses this to pre-populate filter bar.
        result.QueryIntent = queryIntent;

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
                await cacheService.StoreAsync(query, capturedEmbedding, capturedResult, "watch_finder");
            });
        }

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

        // Style filter: resolve style keyword → collection IDs from DB taxonomy → SQL IN.
        // Graceful degradation: if no collections are tagged yet, the filter silently skips.
        if (intent?.Style != null)
        {
            var styleCollectionIds = await _context.Collections
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

        // When hard SQL filters are active (style, price, brand, collection), the candidate
        // pool is already deterministically narrowed — skip the MinRelevance quality gate,
        // which exists only to reject noise in unconstrained queries.
        var hasHardFilters = intent?.BrandId != null || intent?.CollectionId != null
            || intent?.MaxPrice != null || intent?.MinPrice != null
            || intent?.Style != null;

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

    // Extracts brand, collection, and price constraints from the raw query text.
    // Uses alias map + substring matching against DB data — no LLM, fast.
    // Returns null if nothing matched so callers can skip unnecessary filter work.
    private async Task<QueryIntent?> ParseQueryIntentAsync(string query)
    {
        var intent = new QueryIntent();

        // ── Brand matching ────────────────────────────────────────────────────────
        var brands = await _context.Brands.AsNoTracking().ToListAsync();

        Brand? matchedBrand = null;

        // Check aliases first — word-boundary match to prevent "chronograph" matching "AP"
        foreach (var (alias, canonical) in _brandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                matchedBrand = brands.FirstOrDefault(b =>
                    b.Name.Equals(canonical, StringComparison.OrdinalIgnoreCase));
                if (matchedBrand != null) break;
            }
        }

        // Fall back to full brand name substring match
        if (matchedBrand == null)
        {
            // Sort longest-name first so "Vacheron Constantin" wins over "Vacheron"
            matchedBrand = brands
                .OrderByDescending(b => b.Name.Length)
                .FirstOrDefault(b => query.Contains(b.Name, StringComparison.OrdinalIgnoreCase));
        }

        if (matchedBrand != null)
            intent.BrandId = matchedBrand.Id;

        // ── Collection matching ───────────────────────────────────────────────────
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

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

        // ── Price matching via regex ──────────────────────────────────────────────
        // Patterns: "under 50k", "below $50,000", "between 20k and 50k"
        var q = query;

        // "between Xk and Yk" / "between X and Y" — (?!mm) prevents matching diameter values
        var between = Regex.Match(q,
            @"between\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)\s*and\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
            RegexOptions.IgnoreCase);
        if (between.Success)
        {
            // Groups: 1=lo_digits, 2=lo_k, 3=hi_digits, 4=hi_k
            var lo = ParsePriceToken(between.Groups[1].Value, between.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
            var hi = ParsePriceToken(between.Groups[3].Value, between.Groups[4].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
            if (lo > 0) intent.MinPrice = lo;
            if (hi > 0) intent.MaxPrice = hi;
        }
        else
        {
            // "under / below / less than $Xk" or "$X,000" — (?!mm) prevents matching diameter values
            var upper = Regex.Match(q,
                @"(?:under|below|less\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (upper.Success)
                intent.MaxPrice = ParsePriceToken(upper.Groups[1].Value, upper.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));

            // "over / above / more than $Xk" — (?!mm) prevents matching diameter values
            var lower = Regex.Match(q,
                @"(?:over|above|more\s+than)\s*\$?\s*(\d[\d,]*)\s*(k?)(?!\s*mm)",
                RegexOptions.IgnoreCase);
            if (lower.Success)
                intent.MinPrice = ParsePriceToken(lower.Groups[1].Value, lower.Groups[2].Value.Equals("k", StringComparison.OrdinalIgnoreCase));
        }

        // ── Diameter matching via regex ───────────────────────────────────────────
        // Patterns: "39-40mm", "39–40mm" (range), or "39mm" (exact)
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
            // Single "39mm" — treat as exact match
            var diamExact = Regex.Match(q, @"(\d+(?:\.\d+)?)\s*mm", RegexOptions.IgnoreCase);
            if (diamExact.Success && double.TryParse(diamExact.Groups[1].Value,
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var ex))
            {
                intent.MinDiameterMm = ex;
                intent.MaxDiameterMm = ex;
            }
        }

        // ── Case material matching ────────────────────────────────────────────────
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

        // ── Movement type matching ───────────────────────────────────────────────
        if (Regex.IsMatch(q, @"\b(?:automatic|self[- ]winding)\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Automatic";
        else if (Regex.IsMatch(q, @"\b(?:manual|hand[- ]wound)\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Manual-winding";
        else if (Regex.IsMatch(q, @"\bquartz\b", RegexOptions.IgnoreCase))
            intent.MovementType = "Quartz";

        // ── Water resistance matching ────────────────────────────────────────────
        // "300m water resistance", "100m waterproof", or standalone "300m" (only if not diameter)
        var wrMatch = Regex.Match(q,
            @"(\d+)\s*m\s*(?:water\s*resist|waterproof|WR)",
            RegexOptions.IgnoreCase);
        if (wrMatch.Success)
            intent.WaterResistance = wrMatch.Groups[1].Value;

        // ── Style matching ───────────────────────────────────────────────────────
        // Maps natural-language style keywords to DB taxonomy values (sport/dress/diver).
        // Chronograph is a complication detected via specs — not a collection-level style.
        if (Regex.IsMatch(q, @"\b(?:sport|sporty)\b", RegexOptions.IgnoreCase))
            intent.Style = "sport";
        else if (Regex.IsMatch(q, @"\b(?:dress|formal|elegant|elegance)\b", RegexOptions.IgnoreCase))
            intent.Style = "dress";
        else if (Regex.IsMatch(q, @"\b(?:dive|diver|diving|waterproof)\b", RegexOptions.IgnoreCase))
            intent.Style = "diver";

        // Return null if nothing was extracted — no hard filters to apply
        if (intent.BrandId == null && intent.CollectionId == null
            && intent.MaxPrice == null && intent.MinPrice == null
            && intent.MinDiameterMm == null && intent.MaxDiameterMm == null
            && intent.CaseMaterial == null && intent.MovementType == null
            && intent.WaterResistance == null && intent.Style == null)
            return null;

        return intent;
    }

    // Parses a price token like "50" with isK=true → 50000, or "50000" with isK=false → 50000.
    private static decimal ParsePriceToken(string digits, bool isK)
    {
        var clean = digits.Replace(",", "");
        if (!decimal.TryParse(clean, out var value)) return 0;
        return isK ? value * 1000 : value;
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
