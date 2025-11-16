// Chrono24 cache service
// Handles database operations for scraped watch data

using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class Chrono24CacheService
{
    private readonly TourbillonContext _context;
    private readonly IChrono24ScraperService _scraperService;
    private readonly ILogger<Chrono24CacheService> _logger;

    public Chrono24CacheService(
        TourbillonContext context,
        IChrono24ScraperService scraperService,
        ILogger<Chrono24CacheService> logger)
    {
        _context = context;
        _scraperService = scraperService;
        _logger = logger;
    }

    /// <summary>
    /// Scrapes and caches watches for a specific brand and collection
    /// </summary>
    public async Task<(bool success, string message, int watchesAdded)> ScrapeAndCacheCollectionAsync(
        string brandName,
        string collectionName,
        int maxWatches = 40)
    {
        try
        {
            _logger.LogInformation("Starting scrape for {Brand} - {Collection}",
                brandName, collectionName);

            // Scrape watches from Chrono24
            var scrapedWatches = await _scraperService.ScrapeWatchesByCollectionAsync(
                brandName, collectionName, maxWatches);

            if (!scrapedWatches.Any())
            {
                var message = $"No watches found for {brandName} - {collectionName}";
                _logger.LogWarning(message);
                return (false, message, 0);
            }

            // Process and save to database
            int watchesAdded = 0;
            foreach (var scrapedWatch in scrapedWatches)
            {
                var added = await ProcessScrapedWatchAsync(scrapedWatch);
                if (added) watchesAdded++;
            }

            await _context.SaveChangesAsync();

            var successMessage = $"Successfully scraped and cached {watchesAdded} watches for {brandName} - {collectionName}";
            _logger.LogInformation(successMessage);
            return (true, successMessage, watchesAdded);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error scraping {brandName} - {collectionName}: {ex.Message}";
            _logger.LogError(ex, errorMessage);
            return (false, errorMessage, 0);
        }
    }

    /// <summary>
    /// Scrapes and caches watches for an entire brand
    /// </summary>
    public async Task<(bool success, string message, int watchesAdded)> ScrapeAndCacheBrandAsync(
        string brandName,
        int maxWatchesPerCollection = 40)
    {
        try
        {
            _logger.LogInformation("Starting scrape for brand: {Brand}", brandName);

            // Scrape watches from Chrono24
            var scrapedWatches = await _scraperService.ScrapeWatchesByBrandAsync(
                brandName, maxWatchesPerCollection);

            if (!scrapedWatches.Any())
            {
                var message = $"No watches found for brand {brandName}";
                _logger.LogWarning(message);
                return (false, message, 0);
            }

            // Process and save to database
            int watchesAdded = 0;
            foreach (var scrapedWatch in scrapedWatches)
            {
                var added = await ProcessScrapedWatchAsync(scrapedWatch);
                if (added) watchesAdded++;
            }

            await _context.SaveChangesAsync();

            var successMessage = $"Successfully scraped and cached {watchesAdded} watches for {brandName}";
            _logger.LogInformation(successMessage);
            return (true, successMessage, watchesAdded);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error scraping brand {brandName}: {ex.Message}";
            _logger.LogError(ex, errorMessage);
            return (false, errorMessage, 0);
        }
    }

    /// <summary>
    /// Scrapes watches for all brands from the database
    /// Holy Trinity (Patek, VC, AP): 5 collections × 12 watches = 60 watches each
    /// Other brands: 3-4 collections with fewer watches
    /// </summary>
    public async Task<(bool success, string message, int watchesAdded)> ScrapeAllBrandsAsync(
        int maxWatchesPerBrand = 30)
    {
        try
        {
            _logger.LogInformation("Starting scrape for all brands");

            // Holy Trinity brands - premium treatment with 5 collections, 12 watches each (60 total)
            var holyTrinityBrands = new HashSet<string>
            {
                "Patek Philippe",
                "Vacheron Constantin",
                "Audemars Piguet"
            };

            // Collections to skip for brands that should have only 3 collections
            var collectionsToSkip = new HashSet<string>
            {
                "Spezialist",           // Glashütte Original (keep 3: Senator, PanoMatic, SeaQ)
                "QP à Équation",        // Greubel Forsey (keep 3: Double Tourbillon 30°, Tourbillon 24 Secondes, Balancier Convexe)
                "Reine de Naples",      // Breguet (keep 3: Classique, Marine, Tradition)
                "Ladybird",             // Blancpain (keep 3: Fifty Fathoms, Villeret, Air Command)
                "Portofino",            // IWC (keep 3: Portugieser, Pilot's Watches, Ingenieur)
                "Highlife"              // Frederique Constant (keep 3: Classics, Slimline, Manufacture)
            };

            // Get all brands from database
            var brands = await _context.Brands.ToListAsync();

            if (!brands.Any())
            {
                return (false, "No brands found in database", 0);
            }

            int totalWatchesAdded = 0;

            foreach (var brand in brands)
            {
                _logger.LogInformation("Scraping brand: {Brand}", brand.Name);

                // Get collections for this brand (excluding skipped ones)
                var collections = await _context.Collections
                    .Where(c => c.BrandId == brand.Id && !collectionsToSkip.Contains(c.Name))
                    .ToListAsync();

                if (!collections.Any())
                {
                    _logger.LogWarning("No collections found for brand {Brand}", brand.Name);
                    continue;
                }

                // Determine watches per collection based on brand tier
                int collectionCount = collections.Count;
                int watchesPerCollection;
                int targetWatches;

                if (holyTrinityBrands.Contains(brand.Name))
                {
                    // Holy Trinity: 5 collections × 12 watches = 60 total
                    // If they have more than 5 collections, limit to 5
                    if (collectionCount > 5)
                    {
                        collections = collections.Take(5).ToList();
                        collectionCount = 5;
                    }
                    watchesPerCollection = 12;
                    targetWatches = collectionCount * 12;
                    _logger.LogInformation("Holy Trinity brand {Brand}: {Count} collections × 12 watches = {Total} watches",
                        brand.Name, collectionCount, targetWatches);
                }
                else
                {
                    // Other brands: fewer watches distributed across collections
                    // Target ~20-25 watches for most brands
                    targetWatches = 20;
                    watchesPerCollection = targetWatches / collectionCount;

                    // Ensure at least 5 watches per collection
                    if (watchesPerCollection < 5)
                    {
                        watchesPerCollection = 5;
                    }

                    _logger.LogInformation("Brand {Brand}: {Count} collections × ~{Watches} watches = ~{Total} watches",
                        brand.Name, collectionCount, watchesPerCollection, collectionCount * watchesPerCollection);
                }

                // Scrape each collection
                foreach (var collection in collections)
                {
                    try
                    {
                        var (success, message, watchesAdded) = await ScrapeAndCacheCollectionAsync(
                            brand.Name,
                            collection.Name,
                            watchesPerCollection);

                        if (success)
                        {
                            totalWatchesAdded += watchesAdded;
                        }

                        // Polite scraping: delay between collections
                        await Task.Delay(2000);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error scraping {Brand} - {Collection}",
                            brand.Name, collection.Name);
                        // Continue with next collection
                    }
                }
            }

            var successMessage = $"Completed scraping all brands. Total watches added: {totalWatchesAdded}";
            _logger.LogInformation(successMessage);
            return (true, successMessage, totalWatchesAdded);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Error during bulk scraping: {ex.Message}";
            _logger.LogError(ex, errorMessage);
            return (false, errorMessage, 0);
        }
    }

    /// <summary>
    /// Returns the count of cached (scraped) watches
    /// </summary>
    public async Task<int> GetCachedWatchCountAsync()
    {
        return await _context.Watches.CountAsync();
    }

    /// <summary>
    /// Gets statistics about scraped data
    /// </summary>
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

    /// <summary>
    /// Clears all watches from database except the 9 showcase watches from CSV
    /// Showcase watch IDs: 2, 4, 11, 13, 18, 24, 28, 30, 35
    /// </summary>
    public async Task<(bool success, string message, int deletedCount)> ClearAllWatchesAsync()
    {
        try
        {
            _logger.LogInformation("Clearing all watches except showcase watches");

            // IDs of the 9 showcase watches to keep (from DbInitializer)
            var showcaseWatchIds = new HashSet<int> { 2, 4, 11, 13, 18, 24, 28, 30, 35 };

            // Get all watches that are NOT showcase watches
            var watchesToDelete = await _context.Watches
                .Where(w => !showcaseWatchIds.Contains(w.Id))
                .ToListAsync();

            int deletedCount = watchesToDelete.Count;

            if (deletedCount == 0)
            {
                return (true, "No watches to delete. Database already clean.", 0);
            }

            // Delete all price trends for these watches first (foreign key constraint)
            var watchIdsToDelete = watchesToDelete.Select(w => w.Id).ToList();
            var priceTrendsToDelete = await _context.PriceTrends
                .Where(pt => watchIdsToDelete.Contains(pt.WatchId))
                .ToListAsync();

            _context.PriceTrends.RemoveRange(priceTrendsToDelete);
            _context.Watches.RemoveRange(watchesToDelete);

            await _context.SaveChangesAsync();

            var successMessage = $"Successfully deleted {deletedCount} watches. Kept 9 showcase watches.";
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
            var existingWatch = await _context.Watches
                .FirstOrDefaultAsync(w =>
                    w.Name == scrapedWatch.Name &&
                    w.BrandId == brand.Id);

            if (existingWatch != null)
            {
                _logger.LogDebug("Watch already exists: {Name}", scrapedWatch.Name);
                // Optionally update price
                UpdateWatchPrice(existingWatch, scrapedWatch.CurrentPrice);
                return false;
            }

            // Parse price
            decimal parsedPrice = ParsePrice(scrapedWatch.CurrentPrice);

            // Create new watch
            var watch = new Watch
            {
                Name = scrapedWatch.Name,
                BrandId = brand.Id,
                CollectionId = collection?.Id,
                CurrentPrice = parsedPrice,
                Description = scrapedWatch.Description,
                Specs = scrapedWatch.Specs,
                Image = scrapedWatch.ImageUrl
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

    #endregion
}
