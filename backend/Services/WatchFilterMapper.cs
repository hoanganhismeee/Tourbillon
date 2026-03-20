// Maps parsed LLM intent fields to Watch spec predicates for candidate filtering
// Decouples NL understanding (AI service) from DB filtering logic (.NET)

using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

public class WatchFilterMapper
{
    // Apply all active intent filters to the watch list.
    // Each predicate is only active when the corresponding intent field is non-null/non-empty.
    // Fallback: if ≤ 3 watches survive, return the full list — let the LLM reranker handle it.
    public IEnumerable<Watch> Apply(IEnumerable<Watch> watches, ParsedIntent intent)
    {
        var filtered = watches.Where(w =>
        {
            var specs = DeserialiseSpecs(w.Specs);
            return MatchesMaterial(specs, intent.Material)
                && MatchesMovement(specs, intent.Movement)
                && MatchesStrap(specs, intent.Strap)
                && MatchesMaxThickness(specs, intent.MaxThicknessMm)
                && MatchesMaxDiameter(specs, intent.MaxDiameterMm)
                && MatchesPrice(w, intent.MinPrice, intent.MaxPrice)
                && MatchesComplications(specs, intent.Complications);
        }).ToList();

        return filtered.Count > 3 ? filtered : watches;
    }

    // Case material must contain at least one of the requested materials
    private static bool MatchesMaterial(WatchSpecs? specs, List<string> materials)
    {
        if (materials.Count == 0) return true;
        var caseMaterial = specs?.Case?.Material ?? "";
        return materials.Any(m => caseMaterial.Contains(m, StringComparison.OrdinalIgnoreCase));
    }

    private static bool MatchesMovement(WatchSpecs? specs, string? movement)
    {
        if (movement == null) return true;
        return (specs?.Movement?.Type ?? "").Contains(movement, StringComparison.OrdinalIgnoreCase);
    }

    private static bool MatchesStrap(WatchSpecs? specs, string? strap)
    {
        if (strap == null) return true;
        return (specs?.Strap?.Material ?? "").Contains(strap, StringComparison.OrdinalIgnoreCase);
    }

    private static bool MatchesMaxThickness(WatchSpecs? specs, double? maxMm)
    {
        if (maxMm == null) return true;
        var parsed = ParseMm(specs?.Case?.Thickness);
        return parsed == null || parsed <= maxMm;
    }

    private static bool MatchesMaxDiameter(WatchSpecs? specs, double? maxMm)
    {
        if (maxMm == null) return true;
        var parsed = ParseMm(specs?.Case?.Diameter);
        return parsed == null || parsed <= maxMm;
    }

    // Price on Request (CurrentPrice == 0) always passes — never filter it out
    private static bool MatchesPrice(Watch watch, decimal? minPrice, decimal? maxPrice)
    {
        if (watch.CurrentPrice == 0) return true;
        if (minPrice != null && watch.CurrentPrice < minPrice) return false;
        if (maxPrice != null && watch.CurrentPrice > maxPrice) return false;
        return true;
    }

    // At least one requested complication must appear in movement functions
    private static bool MatchesComplications(WatchSpecs? specs, List<string> complications)
    {
        if (complications.Count == 0) return true;
        var functions = specs?.Movement?.Functions ?? [];
        return complications.Any(c =>
            functions.Any(f => f.Contains(c, StringComparison.OrdinalIgnoreCase)));
    }

    // Extract numeric mm from strings like "37 mm", "9.24 mm", "38.5mm"
    private static double? ParseMm(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var match = Regex.Match(value, @"(\d+(?:\.\d+)?)");
        if (!match.Success) return null;
        return double.TryParse(match.Groups[1].Value,
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    private static WatchSpecs? DeserialiseSpecs(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try { return JsonSerializer.Deserialize<WatchSpecs>(specsJson); }
        catch { return null; }
    }
}
