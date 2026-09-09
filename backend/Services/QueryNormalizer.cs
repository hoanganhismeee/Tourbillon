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

    private static readonly IReadOnlyDictionary<string, decimal> NumberWords =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["one"] = 1, ["two"] = 2, ["three"] = 3, ["four"] = 4, ["five"] = 5,
            ["six"] = 6, ["seven"] = 7, ["eight"] = 8, ["nine"] = 9, ["ten"] = 10,
            ["eleven"] = 11, ["twelve"] = 12, ["thirteen"] = 13, ["fourteen"] = 14,
            ["fifteen"] = 15, ["sixteen"] = 16, ["seventeen"] = 17, ["eighteen"] = 18,
            ["nineteen"] = 19, ["twenty"] = 20, ["thirty"] = 30, ["forty"] = 40,
            ["fifty"] = 50, ["sixty"] = 60, ["seventy"] = 70, ["eighty"] = 80, ["ninety"] = 90,
        };

    private static readonly IReadOnlyDictionary<string, decimal> ScaleWords =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["hundred"] = 100, ["thousand"] = 1_000, ["grand"] = 1_000, ["k"] = 1_000,
            ["million"] = 1_000_000, ["m"] = 1_000_000,
        };

    // Rewrites spelled-out numbers as digits so the price patterns, which all require a digit,
    // can read "fifty thousand dollars" without an LLM round trip to extract 50000.
    //
    // A scale word only counts when a number precedes it. That rule is what keeps "Grand Seiko"
    // from becoming "1000 Seiko" and breaking brand resolution — and it is why callers should
    // apply this to the price-matching copy of the query only, never to the text used for
    // entity resolution.
    public static string NormalizeNumberWords(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return query;

        var tokens = Regex.Split(query, @"([^\p{L}\p{Nd}]+)");
        var output = new StringBuilder();
        var i = 0;

        while (i < tokens.Length)
        {
            // Only start a run on a word. Starting on a separator would let the run consume the
            // space before the number and glue the result to the preceding word.
            var (value, consumed) = IsSeparator(tokens[i]) || tokens[i].Length == 0
                ? (0m, 0)
                : ReadNumberRun(tokens, i);

            if (consumed == 0)
            {
                output.Append(tokens[i]);
                i++;
                continue;
            }

            output.Append(value.ToString(CultureInfo.InvariantCulture));
            i += consumed;
        }

        return output.ToString();
    }

    /// Reads one spelled-out number starting at <paramref name="start"/>, returning its value and
    /// how many tokens it spans. Returns zero tokens when the run is not a number, or is a bare
    /// scale word with nothing to scale.
    private static (decimal Value, int Consumed) ReadNumberRun(string[] tokens, int start)
    {
        decimal total = 0, current = 0;
        bool sawNumber = false, sawScale = false;
        var i = start;

        while (i < tokens.Length)
        {
            var token = tokens[i];
            if (token.Length == 0 || IsSeparator(token)) { i++; continue; }

            // "a hundred thousand" — the article stands in for one, but only immediately before
            // a scale word, so "a dress watch" is untouched.
            if (!sawNumber && (token.Equals("a", StringComparison.OrdinalIgnoreCase)
                            || token.Equals("an", StringComparison.OrdinalIgnoreCase)))
            {
                if (!NextContentIsScale(tokens, i + 1)) break;
                current = 1;
                sawNumber = true;
                i++;
                continue;
            }

            if (NumberWords.TryGetValue(token, out var digit))
            {
                current += digit;
                sawNumber = true;
                i++;
                continue;
            }

            if (decimal.TryParse(token, NumberStyles.Integer, CultureInfo.InvariantCulture, out var literal))
            {
                if (sawNumber) break; // "twenty 5" is two numbers, not one
                current += literal;
                sawNumber = true;
                i++;
                continue;
            }

            // A scale with nothing before it is a word like "Grand" in a brand name, not a number.
            if (ScaleWords.TryGetValue(token, out var scale))
            {
                if (!sawNumber) break;
                if (scale == 100) current *= 100;
                else { total += (current == 0 ? 1 : current) * scale; current = 0; }
                sawScale = true;
                i++;
                continue;
            }

            break;
        }

        // A lone number word is left alone: only a scaled figure is unambiguously a price.
        if (!sawNumber || !sawScale) return (0, 0);
        return (total + current, LastContentToken(tokens, start, i) - start + 1);
    }

    private static bool IsSeparator(string token) => !Regex.IsMatch(token, @"[\p{L}\p{Nd}]");

    /// True when the next word token is a scale word, used to decide whether a leading article
    /// is acting as the number one.
    private static bool NextContentIsScale(string[] tokens, int start)
    {
        for (var i = start; i < tokens.Length; i++)
        {
            if (tokens[i].Length == 0 || IsSeparator(tokens[i])) continue;
            return ScaleWords.ContainsKey(tokens[i]);
        }
        return false;
    }

    /// Index of the final non-separator token in the consumed span, so trailing whitespace is
    /// not swallowed into the replacement.
    private static int LastContentToken(string[] tokens, int start, int end)
    {
        for (var i = end - 1; i > start; i--)
            if (!IsSeparator(tokens[i]) && tokens[i].Length > 0) return i;
        return start;
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
