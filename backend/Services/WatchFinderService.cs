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
    public string Explanation { get; set; } = "";
    public int Score { get; set; }
}

public class WatchFinderResult
{
    public List<WatchDto> Watches { get; set; } = [];
    public Dictionary<int, WatchMatchDetail> MatchDetails { get; set; } = [];
    public object? ParsedIntent { get; set; }
}

// ── Service ───────────────────────────────────────────────────────────────────

public class WatchFinderService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly WatchFilterMapper _mapper;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public WatchFinderService(IHttpClientFactory httpClientFactory, TourbillonContext context, WatchFilterMapper mapper)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _mapper = mapper;
    }

    public async Task<WatchFinderResult> FindWatchesAsync(string query)
    {
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        // Step 1: parse intent from AI service
        ParsedIntent? intent = null;
        try
        {
            var parseResp = await httpClient.PostAsJsonAsync("/watch-finder/parse", new { query });
            if (parseResp.IsSuccessStatusCode)
            {
                var json = await parseResp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("intent", out var intentEl))
                    intent = JsonSerializer.Deserialize<ParsedIntent>(intentEl.GetRawText(), _jsonOptions);
            }
        }
        catch { /* AI service unreachable — continue with null intent */ }

        // Step 2: load all watches with Brand for rerank context
        var allWatches = await _context.Watches
            .Include(w => w.Brand)
            .AsNoTracking()
            .ToListAsync();

        // Step 3: apply filters, take top 30 by brand spread
        var candidates = (intent != null ? _mapper.Apply(allWatches, intent) : allWatches).ToList();
        var top30 = BrandSpread(candidates, 30);

        // Base result — returned as-is if rerank fails
        var result = new WatchFinderResult
        {
            Watches = top30.Take(6).Select(w => WatchDto.FromWatch(w)).ToList(),
            MatchDetails = [],
            ParsedIntent = intent
        };

        if (top30.Count == 0) return result;

        // Step 4: rerank candidates via AI service
        try
        {
            var payload = top30.Select(w =>
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
                    var ranked = JsonSerializer.Deserialize<List<RankedWatch>>(rankedEl.GetRawText(), _jsonOptions) ?? [];
                    var scoreMap = ranked.ToDictionary(r => r.WatchId);

                    var reranked = top30
                        .Where(w => scoreMap.ContainsKey(w.Id))
                        .OrderByDescending(w => scoreMap[w.Id].Score)
                        .Take(6)
                        .ToList();

                    result.Watches = reranked.Select(w => WatchDto.FromWatch(w)).ToList();
                    result.MatchDetails = reranked.ToDictionary(
                        w => w.Id,
                        w => new WatchMatchDetail
                        {
                            Explanation = scoreMap[w.Id].Explanation,
                            Score = scoreMap[w.Id].Score
                        });
                }
            }
        }
        catch { /* AI service unreachable — return unranked filtered results */ }

        return result;
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

    // Maps the ai-service rerank response shape
    private class RankedWatch
    {
        [JsonPropertyName("watch_id")]
        public int WatchId { get; set; }

        [JsonPropertyName("score")]
        public int Score { get; set; }

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = "";
    }
}
