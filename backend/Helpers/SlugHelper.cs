// URL-safe slug generation for public-facing routes.
// Strips diacritics, lowercases, replaces non-alphanumeric with hyphens.
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace backend.Helpers;

public static class SlugHelper
{
    /// Generates a URL-safe slug from one or more name parts.
    /// Example: GenerateSlug("Patek Philippe", "Nautilus", "5811/1G Blue Dial")
    ///       -> "patek-philippe-nautilus-5811-1g-blue-dial"
    public static string GenerateSlug(params string?[] parts)
    {
        var combined = string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        if (string.IsNullOrWhiteSpace(combined)) return "";

        // Decompose unicode and strip diacritics (e.g., ö → o, é → e)
        var normalized = combined.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var result = sb.ToString().Normalize(NormalizationForm.FormC);

        // Lowercase, replace non-alphanumeric runs with single hyphen, trim hyphens
        result = Regex.Replace(result.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        return result;
    }
}
