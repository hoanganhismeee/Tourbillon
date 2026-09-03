// Shared query understanding primitives for the chat concierge and Smart Search.
// Both entry points normalise the same user text before routing, so the brand alias table,
// entity-text normalisation, and compound-term expansion live here instead of being
// maintained separately in ChatService and WatchFinderService, where the copies drifted.
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Services;

public static class QueryNormalizer
{
    // Canonical values carry the same diacritics as the seeded brand names. Alias-to-brand
    // resolution goes through TryResolveBrand, which compares on CompactText, so a spelling
    // that differs only by diacritics or punctuation still resolves to the right brand.
    public static readonly IReadOnlyDictionary<string, string> BrandAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // Abbreviations
            ["JLC"] = "Jaeger-LeCoultre",
            ["AP"]  = "Audemars Piguet",
            ["VC"]  = "Vacheron Constantin",
            ["PP"]  = "Patek Philippe",
            ["ALS"] = "A. Lange & Söhne",
            ["GS"]  = "Grand Seiko",
            ["GO"]  = "Glashütte Original",
            ["FC"]  = "Frederique Constant",
            // Shorthand — first word or common nickname
            ["Vacheron"]   = "Vacheron Constantin",
            ["Patek"]      = "Patek Philippe",
            ["Audemars"]   = "Audemars Piguet",
            ["Lange"]      = "A. Lange & Söhne",
            ["ALange"]     = "A. Lange & Söhne",
            ["Glashutte"]  = "Glashütte Original",
            ["Glashütte"]  = "Glashütte Original",
            ["Frederique"] = "Frederique Constant",
            ["FP Journe"]  = "F.P.Journe",
            ["FPJourne"]   = "F.P.Journe",
            ["Journe"]     = "F.P.Journe",
        };

    // Diacritic-stripped, lowercased text with every run of non-alphanumerics collapsed to a
    // single space: "A. Lange & Söhne" becomes "a lange sohne". Word breaks are preserved so
    // callers can tokenise; use CompactText for matching that should ignore them.
    public static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "";

        var decomposed = value.Normalize(NormalizationForm.FormD);
        var stripped = new string(decomposed
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .ToArray())
            .Normalize(NormalizationForm.FormC);
        var collapsed = Regex.Replace(stripped.ToLowerInvariant(), @"[^\p{L}\p{Nd}]+", " ");
        return Regex.Replace(collapsed, @"\s+", " ").Trim();
    }

    // NormalizeText with the word breaks removed: "A. Lange & Söhne" becomes "alangesohne".
    // Use when the user's spacing should not decide whether a name matches.
    public static string CompactText(string? value) =>
        NormalizeText(value).Replace(" ", "", StringComparison.Ordinal);

    // Expands closed compounds the catalogue stores as two words and collapses whitespace.
    // Applied on both the chat and Smart Search entry paths so a query normalised by one
    // is not re-normalised differently by the other.
    public static string ExpandCompoundTerms(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return query;

        var expanded = Regex.Replace(query, @"\bsportwatch(es)?\b", "sport watch$1", RegexOptions.IgnoreCase);
        expanded = Regex.Replace(expanded, @"\bdresswatch(es)?\b", "dress watch$1", RegexOptions.IgnoreCase);
        expanded = Regex.Replace(expanded, @"\bdivewatch(es)?\b",  "dive watch$1",  RegexOptions.IgnoreCase);
        expanded = Regex.Replace(expanded, @"\bdiverwatch(es)?\b", "diver watch$1", RegexOptions.IgnoreCase);
        expanded = Regex.Replace(expanded, @"\btoolwatch(es)?\b",  "tool watch$1",  RegexOptions.IgnoreCase);
        return Regex.Replace(expanded, @"\s+", " ").Trim();
    }

    // Resolves a canonical brand name (typically a BrandAliases value) against the catalogue.
    // Matches on CompactText rather than string equality so the alias table's diacritic
    // spelling can never be the reason a brand fails to resolve.
    public static Brand? TryResolveBrand(string canonicalName, IEnumerable<Brand> brands)
    {
        var target = CompactText(canonicalName);
        if (target.Length == 0)
            return null;

        return brands.FirstOrDefault(brand =>
            string.Equals(CompactText(brand.Name), target, StringComparison.Ordinal));
    }
}
