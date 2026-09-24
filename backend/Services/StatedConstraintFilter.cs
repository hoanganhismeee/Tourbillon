using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

/// The constraints a query states that SQL cannot reach.
///
/// Diameter, dial colour, water resistance and complications live inside the Specs JSON, so the
/// parsed intent carried them to the filter bar as UI hints and nothing filtered on them. The
/// benchmark caught what that costs: "a green dial, nothing else matters" came back with five
/// non-green dials, and "I hate date windows" with three watches that have one.
///
/// This runs over the candidate list in memory, which is at most a few hundred rows, and only on
/// values the user actually stated. When nothing survives, that is a verdict on the pool rather than
/// on the catalogue — "a green dial" against a pool of GMT-Masters means the SQL path guessed a
/// collection the brief never named — so the caller is told, and a path that can decline does.
public static class StatedConstraintFilter
{
    /// Candidates that satisfy every stated spec constraint, or the original list when that would
    /// leave nothing. `applied` says the filter narrowed the pool; `emptied` says the pool held
    /// nothing the brief asked for, which is a reason to let another retrieval path answer instead.
    public static List<Watch> Apply(List<Watch> candidates, QueryIntent? intent, out bool applied, out bool emptied)
    {
        applied = false;
        emptied = false;
        if (candidates.Count == 0 || !HasSpecConstraints(intent)) return candidates;

        var kept = candidates.Where(watch => Satisfies(watch, intent!)).ToList();
        if (kept.Count == 0)
        {
            emptied = true;
            return candidates;
        }

        applied = kept.Count < candidates.Count;
        return kept;
    }

    /// True when the intent carries something only the specs can answer.
    public static bool HasSpecConstraints(QueryIntent? intent) =>
        intent != null
        && (intent.DialColour != null
            || intent.MinDiameterMm != null || intent.MaxDiameterMm != null
            || intent.WaterResistance != null
            || intent.Complications.Count > 0
            || intent.ExcludedComplications.Count > 0
            || intent.StrapType != null
            || intent.ExcludedStrapTypes.Count > 0);

    private static bool Satisfies(Watch watch, QueryIntent intent)
    {
        var specs = Deserialise(watch.Specs);

        if (intent.DialColour != null && !DialMatches(specs, intent.DialColour)) return false;

        var diameter = ParseFirstNumber(specs?.Case?.Diameter);
        // A watch with no diameter recorded is not evidence against the brief, so it stays.
        if (intent.MinDiameterMm != null && diameter != null && diameter < intent.MinDiameterMm) return false;
        if (intent.MaxDiameterMm != null && diameter != null && diameter > intent.MaxDiameterMm) return false;

        if (intent.WaterResistance != null)
        {
            var required = ParseFirstNumber(intent.WaterResistance);
            var actual = ParseFirstNumber(specs?.Case?.WaterResistance);
            if (required != null && actual != null && actual < required) return false;
        }

        var functions = specs?.Movement?.Functions ?? [];
        if (intent.Complications.Count > 0
            && !intent.Complications.Any(c => StatesComplication(watch, functions, c)))
            return false;
        if (intent.ExcludedComplications.Count > 0
            && intent.ExcludedComplications.Any(c => StatesComplication(watch, functions, c)))
            return false;

        var strap = specs?.Strap?.Material;
        if (intent.StrapType != null && strap != null && !StrapMatches(strap, intent.StrapType)) return false;
        if (intent.ExcludedStrapTypes.Count > 0 && strap != null
            && intent.ExcludedStrapTypes.Any(t => StrapMatches(strap, t)))
            return false;

        return true;
    }

    /// The catalogue writes the strap as free text: "Stainless steel bracelet", "Alligator leather",
    /// "Rubber". The brief names a kind, so the comparison is on the words that kind is written with.
    private static bool StrapMatches(string actual, string wanted)
    {
        var value = actual.ToLowerInvariant();
        return wanted switch
        {
            "bracelet" => value.Contains("bracelet") || value.Contains("integrated"),
            "leather" => value.Contains("leather") || value.Contains("alligator")
                         || value.Contains("calf") || value.Contains("crocodile"),
            "rubber" => value.Contains("rubber") || value.Contains("caoutchouc"),
            "textile" => value.Contains("nato") || value.Contains("textile")
                         || value.Contains("fabric") || value.Contains("canvas"),
            _ => value.Contains(wanted),
        };
    }

    /// A complication the catalogue left out of the functions list can still be in the model name:
    /// an Audemars Piguet "Split-Seconds Chronograph GMT Large Date" records no date among its
    /// functions, and came back for a brief that ruled dates out. The name is read for every term
    /// but the moon, where "Moonwatch" and "Moonshine gold" name it without having it.
    private static bool StatesComplication(Watch watch, List<string> functions, string term)
    {
        if (functions.Any(f => f.Contains(term, StringComparison.OrdinalIgnoreCase))) return true;
        if (term == "moon") return false;
        return Regex.IsMatch(watch.Name, $@"\b{Regex.Escape(term)}", RegexOptions.IgnoreCase);
    }

    /// The catalogue spells one colour many ways — "argenté", "silver-toned", "frosted silver" are
    /// all silver — so the comparison is on the same normalised buckets the labels use, with the raw
    /// spelling kept as a fallback for colours the buckets do not cover.
    private static bool DialMatches(WatchSpecs? specs, string wanted)
    {
        var actual = (specs?.Dial?.Color ?? "").ToLowerInvariant();
        if (actual.Length == 0) return true;
        var want = wanted.ToLowerInvariant();
        if (actual.Contains(want, StringComparison.Ordinal)) return true;

        return want switch
        {
            "silver" => actual.Contains("argent") || actual.Contains("silver") || actual.Contains("opalin"),
            "white" => actual.Contains("white") || actual.Contains("ivory") || actual.Contains("opalin"),
            "black" => actual.Contains("black") || actual.Contains("noir") || actual.Contains("onyx"),
            "grey" or "gray" => actual.Contains("grey") || actual.Contains("gray") || actual.Contains("slate") || actual.Contains("anthracite"),
            "blue" => actual.Contains("blue") || actual.Contains("bleu"),
            "brown" => actual.Contains("brown") || actual.Contains("chocolate") || actual.Contains("ebony"),
            _ => false,
        };
    }

    private static WatchSpecs? Deserialise(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<WatchSpecs>(json); }
        catch (JsonException) { return null; }
    }

    /// "42.5 mm" -> 42.5, "300 m / 30 bar" -> 300. The leading figure is the one the spec is named for.
    private static double? ParseFirstNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var match = Regex.Match(value, @"\d+(?:\.\d+)?");
        return match.Success ? double.Parse(match.Value) : null;
    }
}
