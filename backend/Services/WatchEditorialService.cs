// Generates and stores AI editorial content for watch collections.
// One editorial archetype is generated per collection (using the most spec-complete watch as seed).
// All watches in that collection share the same editorial via WatchEditorialLink.
// Content is generated offline using a local Ollama model — zero AI cost at runtime.

using System.Net.Http.Json;
using System.Text.Json;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class WatchEditorialService
{
    private readonly TourbillonContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WatchEditorialService> _logger;

    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public WatchEditorialService(
        TourbillonContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<WatchEditorialService> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// Seeds editorial content for every collection and links all watches in each collection.
    /// Skips collections that already have content. Returns counts of seeded, linked, and skipped.
    public async Task<(int seeded, int linked, int skipped)> SeedAllAsync()
    {
        var allWatches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .ToListAsync();

        // Get watch IDs that already have editorial links — skip these
        var alreadyLinked = await _context.WatchEditorialLinks
            .Select(l => l.WatchId)
            .ToHashSetAsync();

        int seeded = 0, linked = 0, skipped = 0;

        // Group by CollectionId — null collection watches are handled individually
        var byCollection = allWatches
            .GroupBy(w => w.CollectionId)
            .ToList();

        var httpClient = _httpClientFactory.CreateClient("ai-service");

        foreach (var group in byCollection)
        {
            var watches = group.ToList();

            // Identify watches in this group that still need editorial
            var unwatched = watches.Where(w => !alreadyLinked.Contains(w.Id)).ToList();
            if (unwatched.Count == 0)
            {
                skipped++;
                continue;
            }

            // For a named collection, one seed covers all watches in the group
            // For null-collection watches, generate one per watch
            if (group.Key.HasValue)
            {
                var seed = PickSeedWatch(unwatched);
                var content = await GenerateContentAsync(httpClient, seed);
                if (content == null)
                {
                    _logger.LogWarning("Editorial generation failed for collection {CollId}, seed watch {WatchId}",
                        group.Key, seed.Id);
                    skipped++;
                    continue;
                }

                _context.WatchEditorialContents.Add(content);
                await _context.SaveChangesAsync();

                // Link all watches in the collection (not just unwatched — idempotent on first run)
                foreach (var w in watches.Where(w => !alreadyLinked.Contains(w.Id)))
                {
                    _context.WatchEditorialLinks.Add(new WatchEditorialLink
                    {
                        WatchId = w.Id,
                        EditorialContentId = content.Id,
                    });
                }
                await _context.SaveChangesAsync();

                seeded++;
                linked += unwatched.Count;
                _logger.LogInformation("Seeded editorial for collection {CollId} ({Count} watches linked)",
                    group.Key, unwatched.Count);
            }
            else
            {
                // No collection — generate individually for each orphan watch
                foreach (var w in unwatched)
                {
                    var content = await GenerateContentAsync(httpClient, w);
                    if (content == null)
                    {
                        _logger.LogWarning("Editorial generation failed for orphan watch {WatchId}", w.Id);
                        skipped++;
                        continue;
                    }

                    _context.WatchEditorialContents.Add(content);
                    await _context.SaveChangesAsync();

                    _context.WatchEditorialLinks.Add(new WatchEditorialLink
                    {
                        WatchId = w.Id,
                        EditorialContentId = content.Id,
                    });
                    await _context.SaveChangesAsync();

                    seeded++;
                    linked++;
                }
            }
        }

        return (seeded, linked, skipped);
    }

    /// Returns (totalWatches, withEditorial, coveragePct).
    public async Task<(int total, int withEditorial, double coveragePct)> GetStatusAsync()
    {
        var total = await _context.Watches.CountAsync();
        var withEditorial = await _context.WatchEditorialLinks.CountAsync();
        var pct = total == 0 ? 0.0 : Math.Round((double)withEditorial / total * 100, 1);
        return (total, withEditorial, pct);
    }

    /// Deletes all editorial links and content records.
    public async Task<int> ClearAllAsync()
    {
        var linkCount = await _context.WatchEditorialLinks.CountAsync();
        _context.WatchEditorialLinks.RemoveRange(_context.WatchEditorialLinks);
        _context.WatchEditorialContents.RemoveRange(_context.WatchEditorialContents);
        await _context.SaveChangesAsync();
        return linkCount;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /// Picks the watch with the most non-null WatchSpecs fields to use as the archetype seed.
    private static Watch PickSeedWatch(List<Watch> watches)
    {
        return watches
            .OrderByDescending(w => CountSpecFields(w.Specs))
            .First();
    }

    /// Counts non-null fields in the serialized WatchSpecs JSON.
    private static int CountSpecFields(string? specsJson)
    {
        if (string.IsNullOrEmpty(specsJson)) return 0;
        try
        {
            var doc = JsonDocument.Parse(specsJson);
            return CountNonNullValues(doc.RootElement);
        }
        catch
        {
            return 0;
        }
    }

    private static int CountNonNullValues(JsonElement element)
    {
        int count = 0;
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
                count += CountNonNullValues(prop.Value);
        }
        else if (element.ValueKind != JsonValueKind.Null && element.ValueKind != JsonValueKind.Undefined)
        {
            count++;
        }
        return count;
    }

    /// Calls ai-service /generate-editorial and returns a WatchEditorialContent entity (unsaved).
    private async Task<WatchEditorialContent?> GenerateContentAsync(HttpClient httpClient, Watch watch)
    {
        WatchSpecs? specs = null;
        if (!string.IsNullOrEmpty(watch.Specs))
        {
            try { specs = JsonSerializer.Deserialize<WatchSpecs>(watch.Specs, _json); }
            catch { /* proceed with nulls */ }
        }

        var payload = new
        {
            brand         = watch.Brand?.Name ?? "",
            collection    = watch.Collection?.Name ?? "",
            name          = watch.Name,
            description   = watch.Description ?? "",
            case_material = specs?.Case?.Material ?? "",
            diameter_mm   = ParseDiameterMm(specs?.Case?.Diameter),
            dial_color    = specs?.Dial?.Color ?? "",
            movement_type = specs?.Movement?.Type ?? "",
            power_reserve_h = ParsePowerReserveH(specs?.Movement?.PowerReserve),
            price_tier    = MapPriceTier(watch.CurrentPrice),
        };

        try
        {
            var resp = await httpClient.PostAsJsonAsync("/generate-editorial", payload);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("generate-editorial returned {Status} for watch {Id}", resp.StatusCode, watch.Id);
                return null;
            }

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_json);

            return new WatchEditorialContent
            {
                SeedWatchId    = watch.Id,
                WhyItMatters   = json.GetProperty("why_it_matters").GetString() ?? "",
                CollectorAppeal = json.GetProperty("collector_appeal").GetString() ?? "",
                DesignLanguage = json.GetProperty("design_language").GetString() ?? "",
                BestFor        = json.GetProperty("best_for").GetString() ?? "",
                GeneratedAt    = DateTime.UtcNow,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning("generate-editorial call failed for watch {Id}: {Err}", watch.Id, ex.Message);
            return null;
        }
    }

    // Parses "40 mm" or "40.5mm" → 40. Returns null if unparseable.
    private static double? ParseDiameterMm(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return null;
        var numeric = new string(raw.Where(c => c == '.' || char.IsDigit(c)).ToArray());
        return double.TryParse(numeric, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : null;
    }

    // Parses "70 hours" or "min. 35 - max. 45 hours" → first number found.
    private static int? ParsePowerReserveH(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return null;
        var digits = new string(raw.TakeWhile(c => char.IsDigit(c) || c == ' ').ToArray()).Trim();
        var first = new string(digits.TakeWhile(char.IsDigit).ToArray());
        return int.TryParse(first, out var val) ? val : null;
    }

    private static string MapPriceTier(decimal price) => price switch
    {
        0            => "price on request",
        < 10_000     => "accessible luxury",
        < 30_000     => "mid-luxury",
        < 100_000    => "high luxury",
        _            => "ultra-luxury",
    };
}
