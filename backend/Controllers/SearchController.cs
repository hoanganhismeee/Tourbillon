// Search controller for Tourbillon backend
// Implements priority-based search with relevance scoring
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
            // Get data from database first
            var brands = await _context.Brands
                .Include(b => b.Watches)
                .ToListAsync();

            var watches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .ToListAsync();

            var collections = await _context.Collections
                .Include(c => c.Brand)
                .ToListAsync();

            // Calculate relevance scores and filter results
            var searchTerm = q.ToLower();
            
            var relevantBrands = brands
                .Where(b => CalculateBrandRelevance(b, searchTerm) > 0)
                .Select(b => new
                {
                    id = b.Id,
                    name = b.Name,
                    image = b.Image,
                    type = "brand",
                    relevanceScore = CalculateBrandRelevance(b, searchTerm)
                })
                .OrderByDescending(b => b.relevanceScore)
                .Take(10)
                .ToList();

            var relevantWatches = watches
                .Where(w => CalculateWatchRelevance(w, searchTerm) > 0)
                .Select(w => new
                {
                    id = w.Id,
                    name = w.Name,
                    currentPrice = w.CurrentPrice,
                    image = w.Image,
                    brand = new { id = w.Brand.Id, name = w.Brand.Name },
                    collection = w.Collection != null ? new { id = w.Collection.Id, name = w.Collection.Name } : null,
                    type = "watch",
                    relevanceScore = CalculateWatchRelevance(w, searchTerm)
                })
                .OrderByDescending(w => w.relevanceScore)
                .Take(20)
                .ToList();

            var relevantCollections = collections
                .Where(c => CalculateCollectionRelevance(c, searchTerm) > 0)
                .Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    image = c.Image,
                    brand = new { id = c.Brand.Id, name = c.Brand.Name },
                    type = "collection",
                    relevanceScore = CalculateCollectionRelevance(c, searchTerm)
                })
                .OrderByDescending(c => c.relevanceScore)
                .Take(10)
                .ToList();

            var totalResults = relevantBrands.Count() + relevantWatches.Count() + relevantCollections.Count();

            // Generate suggestions
            var suggestions = GenerateSuggestions(searchTerm, brands, watches, collections);

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

    // Calculate relevance score for brands (highest priority)
    private double CalculateBrandRelevance(Brand brand, string searchTerm)
    {
        var score = 0.0;
        var term = searchTerm.ToLower();
        var brandName = brand.Name.ToLower();

        // Exact match gets highest score
        if (brandName == term) score += 1000;
        
        // Starts with search term (very high priority)
        if (brandName.StartsWith(term)) score += 500;
        
        // Contains search term
        if (brandName.Contains(term)) score += 200;
        
        // Word boundary match
        if (Regex.IsMatch(brandName, $@"\b{term}")) score += 150;

        return score;
    }

    // Calculate relevance score for watches
    private double CalculateWatchRelevance(Watch watch, string searchTerm)
    {
        var score = 0.0;
        var term = searchTerm.ToLower();
        var watchName = watch.Name.ToLower();
        var brandName = watch.Brand.Name.ToLower();

        // Brand name matches (high priority)
        if (brandName == term) score += 800;
        if (brandName.StartsWith(term)) score += 400;
        if (brandName.Contains(term)) score += 200;

        // Watch name matches
        if (watchName == term) score += 600;
        if (watchName.StartsWith(term)) score += 300;
        if (watchName.Contains(term)) score += 100;

        // Description matches
        if (watch.Description != null && watch.Description.ToLower().Contains(term))
            score += 50;

        // Specs matches
        if (watch.Specs != null && watch.Specs.ToLower().Contains(term))
            score += 30;

        return score;
    }

    // Calculate relevance score for collections
    private double CalculateCollectionRelevance(Collection collection, string searchTerm)
    {
        var score = 0.0;
        var term = searchTerm.ToLower();
        var collectionName = collection.Name.ToLower();
        var brandName = collection.Brand.Name.ToLower();

        // Brand name matches
        if (brandName == term) score += 600;
        if (brandName.StartsWith(term)) score += 300;
        if (brandName.Contains(term)) score += 150;

        // Collection name matches
        if (collectionName == term) score += 500;
        if (collectionName.StartsWith(term)) score += 250;
        if (collectionName.Contains(term)) score += 100;

        return score;
    }

    // Generate search suggestions
    private List<string> GenerateSuggestions(string searchTerm, List<Brand> brands, List<Watch> watches, List<Collection> collections)
    {
        var suggestions = new List<string>();
        var term = searchTerm.ToLower();

        // Add brand suggestions
        var brandSuggestions = brands
            .Where(b => b.Name.ToLower().Contains(term))
            .Take(3)
            .Select(b => b.Name);
        suggestions.AddRange(brandSuggestions);

        // Add watch suggestions
        var watchSuggestions = watches
            .Where(w => w.Name.ToLower().Contains(term))
            .Take(3)
            .Select(w => w.Name);
        suggestions.AddRange(watchSuggestions);

        // Add collection suggestions
        var collectionSuggestions = collections
            .Where(c => c.Name.ToLower().Contains(term))
            .Take(2)
            .Select(c => c.Name);
        suggestions.AddRange(collectionSuggestions);

        return suggestions.Distinct().Take(5).ToList();
    }
} 