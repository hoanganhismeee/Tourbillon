// Search controller for Tourbillon backend
// Token-based multi-word search with fuzzy (Levenshtein) matching for typo tolerance.
// Splits queries into tokens, scores each field independently, and applies a match-all bonus.
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly TourbillonContext _context;

    public SearchController(TourbillonContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new
            {
                watches = new List<object>(),
                brands = new List<object>(),
                collections = new List<object>(),
                totalResults = 0,
                suggestions = new List<string>()
            });
        }

        try
        {
            var brands = await _context.Brands.ToListAsync();
            var watches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .ToListAsync();
            var collections = await _context.Collections
                .Include(c => c.Brand)
                .ToListAsync();

            var fullTerm = q.ToLower().Trim();

            // Split multi-word queries into individual tokens for independent matching
            var tokens = fullTerm
                .Split(new[] { ' ', '-', '_', ',', '.' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(t => t.Length >= 2)
                .Distinct()
                .ToArray();
            if (tokens.Length == 0) tokens = new[] { fullTerm };

            var relevantBrands = brands
                .Select(b => new { brand = b, score = CalculateBrandRelevance(b, fullTerm, tokens) })
                .Where(x => x.score > 0)
                .OrderByDescending(x => x.score)
                .Take(10)
                .Select(x => new
                {
                    id = x.brand.Id,
                    name = x.brand.Name,
                    image = x.brand.Image,
                    type = "brand",
                    relevanceScore = x.score
                })
                .ToList();

            var relevantWatches = watches
                .Select(w => new { watch = w, score = CalculateWatchRelevance(w, fullTerm, tokens) })
                .Where(x => x.score > 0)
                .OrderByDescending(x => x.score)
                .Take(20)
                .Select(x => new
                {
                    id = x.watch.Id,
                    name = x.watch.Name,
                    description = x.watch.Description,
                    currentPrice = x.watch.CurrentPrice,
                    image = x.watch.Image,
                    specs = x.watch.Specs,
                    brand = new { id = x.watch.Brand.Id, name = x.watch.Brand.Name },
                    collection = x.watch.Collection != null
                        ? new { id = x.watch.Collection.Id, name = x.watch.Collection.Name }
                        : null,
                    type = "watch",
                    relevanceScore = x.score
                })
                .ToList();

            var relevantCollections = collections
                .Select(c => new { collection = c, score = CalculateCollectionRelevance(c, fullTerm, tokens) })
                .Where(x => x.score > 0)
                .OrderByDescending(x => x.score)
                .Take(10)
                .Select(x => new
                {
                    id = x.collection.Id,
                    name = x.collection.Name,
                    image = x.collection.Image,
                    brand = new { id = x.collection.Brand.Id, name = x.collection.Brand.Name },
                    type = "collection",
                    relevanceScore = x.score
                })
                .ToList();

            var totalResults = relevantBrands.Count + relevantWatches.Count + relevantCollections.Count;
            var suggestions = GenerateSuggestions(tokens, brands, watches, collections);

            return Ok(new
            {
                watches = relevantWatches,
                brands = relevantBrands,
                collections = relevantCollections,
                totalResults,
                suggestions
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Search failed", message = ex.Message });
        }
    }

    // Score one pre-lowercased field against one token. Returns 0 if no match.
    private static double ScoreField(string field, string token)
    {
        if (string.IsNullOrEmpty(field)) return 0;
        if (field == token) return 400;
        if (field.StartsWith(token)) return 200;
        if (field.Contains(token)) return 100;
        if (FuzzyWordMatch(field, token)) return 25; // typo tolerance fallback
        return 0;
    }

    private static double CalculateBrandRelevance(Brand brand, string fullTerm, string[] tokens)
    {
        var brandName = brand.Name.ToLower();
        double score = 0;

        // Full-phrase bonus
        if (brandName == fullTerm) score += 1000;
        else if (brandName.Contains(fullTerm)) score += 300;

        // Individual token scoring
        foreach (var token in tokens)
            score += ScoreField(brandName, token) * 0.8;

        return score;
    }

    private static double CalculateWatchRelevance(Watch watch, string fullTerm, string[] tokens)
    {
        var brandName = watch.Brand.Name.ToLower();
        var watchName = watch.Name.ToLower();
        var description = watch.Description?.ToLower() ?? "";
        var specs = watch.Specs?.ToLower() ?? "";

        // Combined field used for all-tokens bonus check
        var combined = $"{brandName} {watchName} {description} {specs}";

        double score = 0;

        // Full-phrase bonus
        if (combined.Contains(fullTerm)) score += 200;

        // Per-token scoring across all fields with field-importance weighting
        foreach (var token in tokens)
        {
            score += ScoreField(brandName, token) * 0.9;    // brand name
            score += ScoreField(watchName, token);           // reference number / watch name
            score += ScoreField(description, token) * 0.5;  // brand subtitle
            score += ScoreField(specs, token) * 0.4;        // specs JSON (dial, case, movement, strap)
        }

        // Strong query-intent signal: all tokens appear somewhere in this watch's data
        if (tokens.Length > 1 && tokens.All(t => combined.Contains(t) || FuzzyWordMatch(combined, t)))
            score *= 1.5;

        return score;
    }

    private static double CalculateCollectionRelevance(Collection collection, string fullTerm, string[] tokens)
    {
        var collectionName = collection.Name.ToLower();
        var brandName = collection.Brand.Name.ToLower();
        var combined = $"{brandName} {collectionName}";
        double score = 0;

        if (combined == fullTerm) score += 1000;
        else if (combined.Contains(fullTerm)) score += 300;

        foreach (var token in tokens)
        {
            score += ScoreField(brandName, token) * 0.7;
            score += ScoreField(collectionName, token);
        }

        if (tokens.Length > 1 && tokens.All(t => combined.Contains(t) || FuzzyWordMatch(combined, t)))
            score *= 1.5;

        return score;
    }

    // Approximate match: checks if any word in `text` is within edit distance of `token`.
    // Handles typos like "perpetuel" → "perpetual", "patik" → "patek".
    private static bool FuzzyWordMatch(string text, string token)
    {
        if (token.Length < 4) return false;
        int maxDistance = token.Length >= 7 ? 2 : 1;

        // Split on non-alphanumeric chars to cleanly tokenize JSON strings in specs
        var words = Regex.Split(text, @"\W+").Where(w => w.Length > 0);
        return words.Any(word =>
            Math.Abs(word.Length - token.Length) <= maxDistance &&
            LevenshteinDistance(word, token) <= maxDistance);
    }

    // Standard dynamic-programming Levenshtein distance
    private static int LevenshteinDistance(string s, string t)
    {
        if (s.Length == 0) return t.Length;
        if (t.Length == 0) return s.Length;

        var d = new int[s.Length + 1, t.Length + 1];
        for (int i = 0; i <= s.Length; i++) d[i, 0] = i;
        for (int j = 0; j <= t.Length; j++) d[0, j] = j;

        for (int i = 1; i <= s.Length; i++)
            for (int j = 1; j <= t.Length; j++)
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + (s[i - 1] == t[j - 1] ? 0 : 1));

        return d[s.Length, t.Length];
    }

    // Suggest brands, collections, and watch descriptions matching any token
    private static List<string> GenerateSuggestions(string[] tokens, List<Brand> brands, List<Watch> watches, List<Collection> collections)
    {
        var suggestions = new List<string>();

        suggestions.AddRange(brands
            .Where(b => tokens.Any(t => b.Name.ToLower().Contains(t) || FuzzyWordMatch(b.Name.ToLower(), t)))
            .Take(3)
            .Select(b => b.Name));

        suggestions.AddRange(collections
            .Where(c => tokens.Any(t => c.Name.ToLower().Contains(t) || FuzzyWordMatch(c.Name.ToLower(), t)))
            .Take(3)
            .Select(c => c.Name));

        suggestions.AddRange(watches
            .Where(w => !string.IsNullOrEmpty(w.Description) &&
                        tokens.Any(t => w.Description!.ToLower().Contains(t) || FuzzyWordMatch(w.Description!.ToLower(), t)))
            .Take(2)
            .Select(w => w.Description!));

        return suggestions.Distinct().Take(5).ToList();
    }
}
