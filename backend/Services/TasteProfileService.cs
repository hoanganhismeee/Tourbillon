// Service for managing user taste profiles: persisting extracted preferences and scoring watches.
// ParseAndSaveAsync sends the user's plain text to the ai-service for LLM extraction.
// GenerateFromBehaviorAsync derives a profile from browsing events via the ai-service.
// Both methods map returned brand names to IDs and upsert the UserTasteProfile row.
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface ITasteProfileService
{
    Task<TasteProfileDto> GetProfileAsync(int userId);
    Task<TasteProfileDto> ParseAndSaveAsync(int userId, string tasteText);
    Task<TasteProfileDto> GenerateFromBehaviorAsync(int userId);
}

public class TasteProfileService : ITasteProfileService
{
    private static readonly TimeSpan BehaviorAnalysisCooldown = TimeSpan.FromHours(6);
    private readonly TourbillonContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IBehaviorService _behaviorService;
    private readonly ILogger<TasteProfileService> _logger;

    public TasteProfileService(
        TourbillonContext context,
        IHttpClientFactory httpClientFactory,
        IBehaviorService behaviorService,
        ILogger<TasteProfileService> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _behaviorService = behaviorService;
        _logger = logger;
    }

    // Returns the user's current taste profile, or empty defaults if none exists.
    public async Task<TasteProfileDto> GetProfileAsync(int userId)
    {
        var hasEnoughBehaviorData = (await _behaviorService.GetRecentEventsAsync(userId, 3)).Count >= 3;
        var profile = await _context.UserTasteProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);

        return profile == null
            ? new TasteProfileDto { HasEnoughBehaviorData = hasEnoughBehaviorData }
            : MapToDto(profile, hasEnoughBehaviorData);
    }

    // Sends taste text to ai-service for LLM extraction, resolves brand IDs, then upserts.
    public async Task<TasteProfileDto> ParseAndSaveAsync(int userId, string tasteText)
    {
        // Fetch all brands so the LLM can match names from the actual catalog
        var brands = await _context.Brands.AsNoTracking().ToListAsync();
        var brandNames = brands.Select(b => b.Name).ToList();

        // Load or create the profile row before the AI call so we can preserve existing data on failure
        var profile = await _context.UserTasteProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new UserTasteProfile { UserId = userId };
            _context.UserTasteProfiles.Add(profile);
        }

        // Always update raw text and timestamp
        profile.TasteText = tasteText;
        profile.UpdatedAt = DateTime.UtcNow;

        // Call ai-service to extract structured preferences; preserve existing data on failure
        var httpClient = _httpClientFactory.CreateClient("ai-service");
        var payload = new { taste_text = tasteText, available_brands = brandNames };
        var parseSucceeded = false;

        try
        {
            var resp = await httpClient.PostAsJsonAsync("/parse-taste", payload);
            resp.EnsureSuccessStatusCode();
            var snakeOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
            var parsed = await resp.Content.ReadFromJsonAsync<ParsedTaste>(snakeOptions)
                         ?? new ParsedTaste();

            // Map brand names returned by LLM → brand IDs from DB (case-insensitive)
            var preferredBrandIds = (parsed.PreferredBrands ?? [])
                .Select(name => brands.FirstOrDefault(b =>
                    string.Equals(b.Name, name, StringComparison.OrdinalIgnoreCase))?.Id)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();

            profile.PreferredBrandIds  = JsonSerializer.Serialize(preferredBrandIds);
            profile.PreferredMaterials = JsonSerializer.Serialize(parsed.PreferredMaterials ?? []);
            profile.PreferredDialColors = JsonSerializer.Serialize(parsed.PreferredDialColors ?? []);
            profile.PriceMin           = parsed.PriceMin;
            profile.PriceMax           = parsed.PriceMax;
            profile.PreferredCaseSize  = parsed.PreferredCaseSize;
            parseSucceeded = true;
        }
        catch (Exception ex)
        {
            // AI service unavailable — TasteText updated; existing structured preferences preserved
            _logger.LogWarning(ex, "TasteProfile parse-taste failed for userId={UserId}; preserving existing structured preferences", userId);
        }

        await _context.SaveChangesAsync();
        var dto = await GetProfileAsync(userId);
        if (!parseSucceeded) dto.ParseSource = "fallback";
        return dto;
    }

    // Pure scoring function: rates a watch against a taste profile.
    // +3 brand match, +2 material, +2 dial color, +1 price range, +1 case size = 9 max.
    // Exposed as public static so unit tests can call it without a DB context.
    public static int ScoreWatch(WatchDto watch, TasteProfileDto profile)
    {
        int score = 0;

        // Brand match is the strongest signal in luxury watch purchasing
        if (profile.PreferredBrandIds.Contains(watch.BrandId))
            score += 3;

        var specs = DeserialiseSpecs(watch.Specs);

        if (specs?.Case?.Material != null &&
            profile.PreferredMaterials.Any(m =>
                specs.Case.Material.Contains(m, StringComparison.OrdinalIgnoreCase)))
            score += 2;

        if (specs?.Dial?.Color != null &&
            profile.PreferredDialColors.Any(c =>
                specs.Dial.Color.Contains(c, StringComparison.OrdinalIgnoreCase)))
            score += 2;

        if (!string.IsNullOrEmpty(profile.PreferredCaseSize) && specs?.Case?.Diameter != null)
            score += ScoreCaseSize(specs.Case.Diameter, profile.PreferredCaseSize);

        // Skip PoR watches (price === 0) from price range scoring
        if (profile.PriceMin.HasValue && profile.PriceMax.HasValue && watch.CurrentPrice > 0)
        {
            if (watch.CurrentPrice >= profile.PriceMin && watch.CurrentPrice <= profile.PriceMax)
                score += 1;
        }

        return score;
    }

    // Manual taste is durable. Behavior analysis only fills gaps and should never replace
    // explicit user choices.
    public static TasteProfileDto MergePreferenceLayers(TasteProfileDto manual, TasteProfileDto behavior)
    {
        return new TasteProfileDto
        {
            PreferredBrandIds = manual.PreferredBrandIds.Count > 0
                ? new List<int>(manual.PreferredBrandIds)
                : new List<int>(behavior.PreferredBrandIds),
            PreferredMaterials = manual.PreferredMaterials.Count > 0
                ? new List<string>(manual.PreferredMaterials)
                : new List<string>(behavior.PreferredMaterials),
            PreferredDialColors = manual.PreferredDialColors.Count > 0
                ? new List<string>(manual.PreferredDialColors)
                : new List<string>(behavior.PreferredDialColors),
            PriceMin = manual.PriceMin ?? behavior.PriceMin,
            PriceMax = manual.PriceMax ?? behavior.PriceMax,
            PreferredCaseSize = manual.PreferredCaseSize ?? behavior.PreferredCaseSize,
            Summary = behavior.Summary,
        };
    }

    public static bool ShouldRefreshBehaviorAnalysis(DateTime? analyzedAtUtc, DateTime? latestEventAtUtc, DateTime utcNow, TimeSpan cooldown)
    {
        if (!latestEventAtUtc.HasValue)
            return false;

        if (!analyzedAtUtc.HasValue)
            return true;

        if (latestEventAtUtc <= analyzedAtUtc)
            return false;

        return utcNow - analyzedAtUtc.Value >= cooldown;
    }

    private static int ScoreCaseSize(string diameter, string preferredSize)
    {
        var match = Regex.Match(diameter, @"\d+\.?\d*");
        if (!match.Success || !double.TryParse(match.Value, out double mm)) return 0;

        bool matches = preferredSize switch
        {
            "small"  => mm < 37,
            "medium" => mm >= 37 && mm <= 41,
            "large"  => mm > 41,
            _ => false
        };
        return matches ? 1 : 0;
    }

    private static TasteProfileDto MapToDto(UserTasteProfile p, bool hasEnoughBehaviorData)
    {
        var manual = new TasteProfileDto
        {
            PreferredBrandIds = Deserialise<List<int>>(p.PreferredBrandIds) ?? new(),
            PreferredMaterials = Deserialise<List<string>>(p.PreferredMaterials) ?? new(),
            PreferredDialColors = Deserialise<List<string>>(p.PreferredDialColors) ?? new(),
            PriceMin = p.PriceMin,
            PriceMax = p.PriceMax,
            PreferredCaseSize = p.PreferredCaseSize,
        };

        var behavior = new TasteProfileDto
        {
            PreferredBrandIds = Deserialise<List<int>>(p.BehaviorPreferredBrandIds) ?? new(),
            PreferredMaterials = Deserialise<List<string>>(p.BehaviorPreferredMaterials) ?? new(),
            PreferredDialColors = Deserialise<List<string>>(p.BehaviorPreferredDialColors) ?? new(),
            PriceMin = p.BehaviorPriceMin,
            PriceMax = p.BehaviorPriceMax,
            PreferredCaseSize = p.BehaviorPreferredCaseSize,
            Summary = p.Summary,
        };

        var merged = MergePreferenceLayers(manual, behavior);
        merged.TasteText = p.TasteText;
        merged.BehaviorPreferredBrandIds = new List<int>(behavior.PreferredBrandIds);
        merged.BehaviorPreferredMaterials = new List<string>(behavior.PreferredMaterials);
        merged.BehaviorPreferredDialColors = new List<string>(behavior.PreferredDialColors);
        merged.BehaviorPriceMin = behavior.PriceMin;
        merged.BehaviorPriceMax = behavior.PriceMax;
        merged.BehaviorPreferredCaseSize = behavior.PreferredCaseSize;
        merged.BehaviorSummary = behavior.Summary;
        merged.BehaviorAnalyzedAt = p.BehaviorAnalyzedAt;
        merged.HasBehaviorAnalysis = HasAnyPreference(behavior) || !string.IsNullOrWhiteSpace(behavior.Summary);
        merged.HasEnoughBehaviorData = hasEnoughBehaviorData;

        return merged;
    }

    private static bool HasAnyPreference(TasteProfileDto profile)
    {
        return profile.PreferredBrandIds.Count > 0 ||
               profile.PreferredMaterials.Count > 0 ||
               profile.PreferredDialColors.Count > 0 ||
               profile.PriceMin.HasValue ||
               profile.PriceMax.HasValue ||
               !string.IsNullOrWhiteSpace(profile.PreferredCaseSize);
    }

    private static T? Deserialise<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return default;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch { return default; }
    }

    private static WatchSpecs? DeserialiseSpecs(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<WatchSpecs>(json); }
        catch { return null; }
    }

    // Generates a taste profile from the user's browsing history using the AI service.
    public async Task<TasteProfileDto> GenerateFromBehaviorAsync(int userId)
    {
        var events = await _behaviorService.GetRecentEventsAsync(userId, 100);
        if (events.Count < 3)
            return await GetProfileAsync(userId); // Not enough data yet

        var latestEventAt = events.Max(e => e.Timestamp);

        var brands = await _context.Brands.AsNoTracking().ToListAsync();
        var brandNames = brands.Select(b => b.Name).ToList();

        var eventPayload = events.Select(e => new
        {
            type = e.EventType,
            entityName = e.EntityName,
            brandId = e.BrandId,
        });

        var httpClient = _httpClientFactory.CreateClient("ai-service");
        var payload = new { events = eventPayload, available_brands = brandNames };

        var profile = await _context.UserTasteProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            profile = new UserTasteProfile { UserId = userId };
            _context.UserTasteProfiles.Add(profile);
        }

        if (!ShouldRefreshBehaviorAnalysis(profile.BehaviorAnalyzedAt, latestEventAt, DateTime.UtcNow, BehaviorAnalysisCooldown))
            return MapToDto(profile, hasEnoughBehaviorData: true);

        profile.UpdatedAt = DateTime.UtcNow;

        try
        {
            var resp = await httpClient.PostAsJsonAsync("/generate-dna-from-behavior", payload);
            resp.EnsureSuccessStatusCode();
            var snakeOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
            var parsed = await resp.Content.ReadFromJsonAsync<ParsedTaste>(snakeOptions)
                         ?? new ParsedTaste();

            var preferredBrandIds = (parsed.PreferredBrands ?? [])
                .Select(name => brands.FirstOrDefault(b =>
                    string.Equals(b.Name, name, StringComparison.OrdinalIgnoreCase))?.Id)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();

            profile.BehaviorPreferredBrandIds = JsonSerializer.Serialize(preferredBrandIds);
            profile.BehaviorPreferredMaterials = JsonSerializer.Serialize(parsed.PreferredMaterials ?? []);
            profile.BehaviorPreferredDialColors = JsonSerializer.Serialize(parsed.PreferredDialColors ?? []);
            profile.BehaviorPriceMin = parsed.PriceMin;
            profile.BehaviorPriceMax = parsed.PriceMax;
            profile.BehaviorPreferredCaseSize = parsed.PreferredCaseSize;
            profile.Summary = parsed.Summary;
            profile.BehaviorAnalyzedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            // AI service unavailable — preserve existing profile
            _logger.LogWarning(ex, "TasteProfile generate-from-behavior failed for userId={UserId}; preserving existing structured preferences", userId);
        }

        await _context.SaveChangesAsync();
        return MapToDto(profile, hasEnoughBehaviorData: true);
    }

    // Internal DTO for deserializing the ai-service /parse-taste and /generate-dna-from-behavior responses.
    // Deserialized with SnakeCaseLower policy so PascalCase properties map to snake_case JSON keys.
    private class ParsedTaste
    {
        public List<string>? PreferredBrands { get; set; }
        public List<string>? PreferredMaterials { get; set; }
        public List<string>? PreferredDialColors { get; set; }
        public decimal? PriceMin { get; set; }
        public decimal? PriceMax { get; set; }
        public string? PreferredCaseSize { get; set; }
        public string? Summary { get; set; }
    }
}
