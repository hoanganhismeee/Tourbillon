// Watch cache service - handles database operations for scraped watch data from any source

using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class WatchCacheService
{
    private readonly TourbillonContext _context;
    private readonly ILogger<WatchCacheService> _logger;

    public WatchCacheService(
        TourbillonContext context,
        ILogger<WatchCacheService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// Caches a list of already-scraped watches to the database
    /// Used by BrandScraperService to save watches from official brand websites
    /// Includes duplicate checking and showcase watch preservation
    public async Task<(bool success, string message, int watchesAdded)> CacheScrapedWatchesAsync(
        List<ScrapedWatchDto> scrapedWatches)
    {
        try
        {
            if (scrapedWatches == null || !scrapedWatches.Any())
            {
                return (false, "No watches provided to cache", 0);
            }

            _logger.LogInformation("Caching {Count} pre-scraped watches", scrapedWatches.Count);

            // Process and save to database
            int watchesAdded = 0;
            foreach (var scrapedWatch in scrapedWatches)
            {
                var added = await ProcessScrapedWatchAsync(scrapedWatch);
                if (added) watchesAdded++;
            }

            await _context.SaveChangesAsync();

            var successMessage = $"Successfully cached {watchesAdded} out of {scrapedWatches.Count} watches";
            _logger.LogInformation(successMessage);
            return (true, successMessage, watchesAdded);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error caching watches: {ex.Message}";
            _logger.LogError(ex, errorMessage);
            return (false, errorMessage, 0);
        }
    }

    /// Returns the count of cached watches
    public async Task<int> GetCachedWatchCountAsync()
    {
        return await _context.Watches.CountAsync();
    }

    /// Gets statistics about scraped data
    public async Task<object> GetScrapeStatsAsync()
    {
        var totalWatches = await _context.Watches.CountAsync();
        var totalBrands = await _context.Brands.CountAsync();
        var totalCollections = await _context.Collections.CountAsync();

        var watchesByBrand = await _context.Watches
            .GroupBy(w => w.Brand.Name)
            .Select(g => new { Brand = g.Key, Count = g.Count() })
            .ToListAsync();

        return new
        {
            TotalWatches = totalWatches,
            TotalBrands = totalBrands,
            TotalCollections = totalCollections,
            WatchesByBrand = watchesByBrand
        };
    }


    /// Clears watches from database with optional brand filtering
    /// If brandId is provided, clears only that brand's scraped watches (preserves showcase watches)
    /// If brandId is null, clears all watches except the 9 showcase watches from CSV
    public async Task<(bool success, string message, int deletedCount)> ClearAllWatchesAsync(int? brandId = null)
    {
        try
        {
            // IDs of the 9 showcase watches to keep (from DbInitializer)
            var showcaseWatchIds = new HashSet<int> { 2, 4, 11, 13, 18, 24, 28, 30, 35 };

            IQueryable<Watch> query = _context.Watches
                .Where(w => !showcaseWatchIds.Contains(w.Id));

            if (brandId.HasValue)
            {
                _logger.LogInformation("Clearing all scraped watches for brand ID {BrandId}", brandId);
                query = query.Where(w => w.BrandId == brandId.Value);
            }
            else
            {
                _logger.LogInformation("Clearing all watches except showcase watches");
            }

            // Get all watches matching the criteria
            var watchesToDelete = await query.ToListAsync();

            int deletedCount = watchesToDelete.Count;

            if (deletedCount == 0)
            {
                var message = brandId.HasValue
                    ? $"No watches to delete for brand ID {brandId}. Already clean."
                    : "No watches to delete. Database already clean.";
                return (true, message, 0);
            }

            // Delete all price trends for these watches first (foreign key constraint)
            var watchIdsToDelete = watchesToDelete.Select(w => w.Id).ToList();
            var priceTrendsToDelete = await _context.PriceTrends
                .Where(pt => watchIdsToDelete.Contains(pt.WatchId))
                .ToListAsync();

            _context.PriceTrends.RemoveRange(priceTrendsToDelete);
            _context.Watches.RemoveRange(watchesToDelete);

            await _context.SaveChangesAsync();

            var successMessage = brandId.HasValue
                ? $"Successfully deleted {deletedCount} watches for brand ID {brandId}. Kept 9 showcase watches."
                : $"Successfully deleted {deletedCount} watches. Kept 9 showcase watches.";
            _logger.LogInformation(successMessage);
            return (true, successMessage, deletedCount);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error clearing watches: {ex.Message}";
            _logger.LogError(ex, errorMessage);
            return (false, errorMessage, 0);
        }
    }

    #region Private Helper Methods

    private async Task<bool> ProcessScrapedWatchAsync(ScrapedWatchDto scrapedWatch)
    {
        try
        {
            // Find or create brand
            var brand = await GetOrCreateBrandAsync(scrapedWatch.BrandName);
            if (brand == null)
            {
                _logger.LogWarning("Could not find or create brand: {Brand}", scrapedWatch.BrandName);
                return false;
            }

            // Find or create collection
            Collection? collection = null;
            if (!string.IsNullOrEmpty(scrapedWatch.CollectionName))
            {
                collection = await GetOrCreateCollectionAsync(scrapedWatch.CollectionName, brand.Id);
            }

            // Check if watch already exists (by name and brand)
            // Try exact match first
            var existingWatch = await _context.Watches
                .FirstOrDefaultAsync(w =>
                    w.Name == scrapedWatch.Name &&
                    w.BrandId == brand.Id);

            // If no exact match, try matching by BASE reference number (for showcase watches)
            // This allows "5227G" to match "5227G-010 Automatic Date"
            if (existingWatch == null)
            {
                var refNumber = ExtractReferenceNumber(scrapedWatch.Name);
                if (!string.IsNullOrEmpty(refNumber))
                {
                    // Extract BASE reference for comparison (e.g., "5227G" from "5227G-010")
                    var scrapedBaseRef = ExtractBaseReference(refNumber);

                    // Look for existing watches from same brand that match the base reference
                    var allBrandWatches = await _context.Watches
                        .Where(w => w.BrandId == brand.Id)
                        .ToListAsync();

                    existingWatch = allBrandWatches.FirstOrDefault(w =>
                    {
                        var existingRef = ExtractReferenceNumber(w.Name);
                        var existingBaseRef = ExtractBaseReference(existingRef);
                        return !string.IsNullOrEmpty(existingBaseRef) && existingBaseRef == scrapedBaseRef;
                    });

                    if (existingWatch != null)
                    {
                        _logger.LogInformation("Matched by base reference: {BaseRef} - Existing: {ExistingName} ({ExistingRef}), Scraped: {ScrapedName} ({ScrapedRef})",
                            scrapedBaseRef, existingWatch.Name, ExtractReferenceNumber(existingWatch.Name), scrapedWatch.Name, refNumber);
                    }
                }
            }

            if (existingWatch != null)
            {
                _logger.LogDebug("Watch already exists: {Name}", scrapedWatch.Name);

                // IDs of the 9 showcase watches with curated images
                var showcaseWatchIds = new HashSet<int> { 2, 4, 11, 13, 18, 24, 28, 30, 35 };

                // Update price
                UpdateWatchPrice(existingWatch, scrapedWatch.CurrentPrice);
                
                // Update image only if not a showcase watch
                if (!string.IsNullOrEmpty(scrapedWatch.ImageUrl))
                {
                    // Check if this is a showcase watch by ID
                    if (showcaseWatchIds.Contains(existingWatch.Id))
                    {
                        _logger.LogInformation("Preserved curated image for showcase watch ID {Id}: {Name} (image: {Image})", 
                            existingWatch.Id, scrapedWatch.Name, existingWatch.Image);
                        // Don't update image for showcase watches - keep curated image from CSV
                    }
                    else
                    {
                        // Update image for regular watches
                        existingWatch.Image = scrapedWatch.ImageUrl;
                    }
                }

                return false;
            }

            // Parse price
            decimal parsedPrice = ParsePrice(scrapedWatch.CurrentPrice);

            // For new watches, use scraped image URL
            string imageToUse = scrapedWatch.ImageUrl ?? string.Empty;

            // Create new watch
            var watch = new Watch
            {
                Name = scrapedWatch.Name,
                BrandId = brand.Id,
                CollectionId = collection?.Id,
                CurrentPrice = parsedPrice,
                Description = scrapedWatch.Description,
                Specs = scrapedWatch.Specs,
                Image = imageToUse
            };

            _context.Watches.Add(watch);
            _logger.LogDebug("Added new watch: {Name} - ${Price}", watch.Name, watch.CurrentPrice);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing scraped watch: {Name}", scrapedWatch.Name);
            return false;
        }
    }

    private async Task<Brand?> GetOrCreateBrandAsync(string brandName)
    {
        // Try to find existing brand (case-insensitive)
        var brand = await _context.Brands
            .FirstOrDefaultAsync(b => b.Name.ToLower() == brandName.ToLower());

        if (brand != null)
        {
            return brand;
        }

        _logger.LogWarning("Brand not found in database: {Brand}. Should exist from CSV.", brandName);
        return null;
    }

    private async Task<Collection?> GetOrCreateCollectionAsync(string collectionName, int brandId)
    {
        // Try to find existing collection (case-insensitive)
        var collection = await _context.Collections
            .FirstOrDefaultAsync(c =>
                c.Name.ToLower() == collectionName.ToLower() &&
                c.BrandId == brandId);

        if (collection != null)
        {
            return collection;
        }

        _logger.LogWarning("Collection not found: {Collection} for BrandId {BrandId}. Should exist from CSV.",
            collectionName, brandId);
        return null;
    }

    private decimal ParsePrice(string priceString)
    {
        if (string.IsNullOrEmpty(priceString) ||
            priceString.ToLower().Contains("request") ||
            priceString.ToLower().Contains("contact"))
        {
            return 0;
        }

        // Remove currency symbols, commas, and spaces
        var cleanPrice = priceString
            .Replace("$", "")
            .Replace("€", "")
            .Replace("£", "")
            .Replace(",", "")
            .Replace(" ", "")
            .Trim();

        if (decimal.TryParse(cleanPrice, out decimal price))
        {
            return price;
        }

        return 0;
    }

    private void UpdateWatchPrice(Watch watch, string newPriceString)
    {
        var newPrice = ParsePrice(newPriceString);
        if (newPrice > 0 && newPrice != watch.CurrentPrice)
        {
            // Track price history if needed
            var priceTrend = new PriceTrend
            {
                PriceHistory = watch.CurrentPrice,
                Date = DateTime.UtcNow,
                WatchId = watch.Id
            };
            _context.PriceTrends.Add(priceTrend);

            watch.CurrentPrice = newPrice;
            _logger.LogInformation("Updated price for {Name}: ${Old} -> ${New}",
                watch.Name, watch.CurrentPrice, newPrice);
        }
    }

    /// Extracts reference number from watch name for matching
    /// Examples: "5227G-010", "5811/1G", "16202ST", "5303R"
    private string ExtractReferenceNumber(string watchName)
    {
        if (string.IsNullOrEmpty(watchName))
            return string.Empty;

        // Common patterns for luxury watch reference numbers
        var patterns = new[]
        {
            @"\b(\d{4,5}[A-Z]{0,2}[-/]\d{3}[A-Z]?)\b",  // 5227G-010, 5811/1G-001
            @"\b(\d{4,5}[A-Z]{1,2})\b",                  // 5303R, 16202ST, 6119G
            @"\b([A-Z]{2}\d{4,5}[A-Z]?)\b",              // VC43175, AP16202
            @"\b(\d{5})\b"                               // Generic 5-digit ref
        };

        foreach (var pattern in patterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(watchName, pattern);
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }

        return string.Empty;
    }

    /// Extracts BASE reference number (before variant suffix) for matching
    /// Examples:
    ///   "5227G-010" -> "5227G"
    ///   "5811/1G" -> "5811"
    ///   "16202ST" -> "16202ST" (no suffix)
    ///   "5303R" -> "5303R" (no suffix)
    private string ExtractBaseReference(string referenceNumber)
    {
        if (string.IsNullOrEmpty(referenceNumber))
            return string.Empty;

        // Remove variant suffix after dash or slash
        // Pattern: Keep only the part before dash/slash
        var baseMatch = System.Text.RegularExpressions.Regex.Match(
            referenceNumber, @"^([^-/]+)");

        if (baseMatch.Success)
        {
            return baseMatch.Groups[1].Value.ToUpper();
        }

        return referenceNumber.ToUpper();
    }

    #endregion
}

