// Orchestrates the AI Watch Finder pipeline:
// 1. LLM parse — NL query → structured intent (ai-service)
// 2. Filter — intent predicates applied to watch list (WatchFilterMapper)
// 3. LLM rerank — candidate pool → scored + explained ranking (ai-service)

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

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

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public WatchFinderService(
        IHttpClientFactory httpClientFactory,
        TourbillonContext context,
        WatchFilterMapper mapper,
        IServiceScopeFactory scopeFactory)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _mapper = mapper;
        _scopeFactory = scopeFactory;
    }

    public async Task<WatchFinderResult> FindWatchesAsync(string query)
    {
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        // Steps 1 + 2 run concurrently — parse has no dependency on DB load
        var parseTask = ParseIntentAsync(httpClient, query);
        var dbTask    = _context.Watches
            .Include(w => w.Brand)
            .AsNoTracking()
            .ToListAsync();

        await Task.WhenAll(parseTask, dbTask);

        var intent     = await parseTask;
        var allWatches = await dbTask;

        // Step 3: apply filters, take top 30 by brand spread — rerank trims to final 6
        var filtered   = (intent != null ? _mapper.Apply(allWatches, intent) : allWatches).ToList();
        var candidates = BrandSpread(filtered, 30);

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
        try
        {
            var payload = candidates.Select(w =>
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

                    // Top matches: capped at 8, minimum score 60 (fallback: relax threshold if fewer than 3)
                    const int TopMatchLimit = 8;
                    const int MinScoreThreshold = 60;

                    var scoredAndOrdered = candidates
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

                    // All non-top candidates — lower-scored first, then unscored
                    result.OtherCandidates = candidates
                        .Where(w => !topMatchIds.Contains(w.Id))
                        .OrderByDescending(w => scoreMap.ContainsKey(w.Id) ? scoreMap[w.Id].Score : -1)
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

        return result;
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
