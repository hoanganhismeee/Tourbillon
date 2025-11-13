// Service for caching Watch API data in the database
// Minimizes API calls by storing all data locally

using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class WatchApiCacheService
{
    private readonly IWatchApiService _watchApiService;
    private readonly TourbillonContext _context;
    private readonly ILogger<WatchApiCacheService> _logger;

    public WatchApiCacheService(
        IWatchApiService watchApiService,
        TourbillonContext context,
        ILogger<WatchApiCacheService> logger)
    {
        _watchApiService = watchApiService;
        _context = context;
        _logger = logger;
    }

    public async Task<(bool Success, string Message, int WatchesAdded)> SyncWatchesFromApiAsync()
    {
        try
        {
            _logger.LogInformation("Starting Watch API sync...");

            // Test connection first
            var (connectionSuccess, connectionMessage) = await _watchApiService.TestConnectionAsync();
            if (!connectionSuccess)
            {
                return (false, $"API connection failed: {connectionMessage}", 0);
            }

            int totalWatchesAdded = 0;
            int currentPage = 1;
            bool hasMorePages = true;

            while (hasMorePages)
            {
                _logger.LogInformation("Fetching page {Page} from API", currentPage);

                var response = await _watchApiService.GetWatchesAsync(currentPage, 100);

                if (response == null || response.Data == null || response.Data.Count == 0)
                {
                    hasMorePages = false;
                    break;
                }

                // Process each watch from the API
                foreach (var apiWatch in response.Data)
                {
                    try
                    {
                        await ProcessWatchAsync(apiWatch);
                        totalWatchesAdded++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to process watch: {Reference}", apiWatch.Reference ?? apiWatch.ReferenceNumber);
                    }
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("Saved {Count} watches from page {Page}", response.Data.Count, currentPage);

                // Check if there are more pages
                if (response.Data.Count < 100 || currentPage * 100 >= response.Total)
                {
                    hasMorePages = false;
                }
                else
                {
                    currentPage++;
                }
            }

            var message = $"Successfully synced {totalWatchesAdded} watches from API";
            _logger.LogInformation(message);
            return (true, message, totalWatchesAdded);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing watches from API");
            return (false, $"Sync failed: {ex.Message}", 0);
        }
    }

    private async Task ProcessWatchAsync(WatchApiDto apiWatch)
    {
        // Get or create brand
        var brand = await GetOrCreateBrandAsync(apiWatch.Brand);

        // Get or create collection (if specified)
        Collection? collection = null;
        if (!string.IsNullOrEmpty(apiWatch.Collection))
        {
            collection = await GetOrCreateCollectionAsync(apiWatch.Collection, brand.Id);
        }

        // Build specs from available data
        var specs = BuildSpecsString(apiWatch);

        // Check if watch already exists by reference number
        var reference = apiWatch.Reference ?? apiWatch.ReferenceNumber ?? "";
        var existingWatch = await _context.Watches
            .FirstOrDefaultAsync(w => w.Name == apiWatch.Model && w.BrandId == brand.Id);

        if (existingWatch != null)
        {
            // Update existing watch
            existingWatch.Description = apiWatch.Description ?? existingWatch.Description;
            existingWatch.CurrentPrice = apiWatch.Price ?? existingWatch.CurrentPrice;
            existingWatch.Specs = specs ?? existingWatch.Specs;
            existingWatch.Image = apiWatch.ImageUrl ?? apiWatch.Images?.FirstOrDefault() ?? existingWatch.Image;
            existingWatch.CollectionId = collection?.Id ?? existingWatch.CollectionId;

            _logger.LogDebug("Updated existing watch: {Name}", apiWatch.Model);
        }
        else
        {
            // Create new watch
            var newWatch = new Watch
            {
                Name = apiWatch.Model ?? "Unknown Model",
                Description = apiWatch.Description,
                CurrentPrice = apiWatch.Price ?? 0,
                BrandId = brand.Id,
                CollectionId = collection?.Id,
                Specs = specs,
                Image = apiWatch.ImageUrl ?? apiWatch.Images?.FirstOrDefault()
            };

            _context.Watches.Add(newWatch);
            _logger.LogDebug("Added new watch: {Name}", newWatch.Name);

            // Add price trend if price is available
            if (apiWatch.Price.HasValue && apiWatch.Price.Value > 0)
            {
                // We'll add the price trend after the watch is saved
                await _context.SaveChangesAsync();

                var priceTrend = new PriceTrend
                {
                    WatchId = newWatch.Id,
                    PriceHistory = apiWatch.Price.Value,
                    Date = apiWatch.LastUpdated ?? DateTime.UtcNow
                };

                _context.PriceTrends.Add(priceTrend);
            }
        }
    }

    private async Task<Brand> GetOrCreateBrandAsync(string? brandName)
    {
        if (string.IsNullOrEmpty(brandName))
        {
            brandName = "Unknown Brand";
        }

        var existingBrand = await _context.Brands
            .FirstOrDefaultAsync(b => b.Name == brandName);

        if (existingBrand != null)
        {
            return existingBrand;
        }

        var newBrand = new Brand
        {
            Name = brandName,
            Description = $"{brandName} watches from API",
            Summary = $"{brandName} collection"
        };

        _context.Brands.Add(newBrand);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created new brand: {Brand}", brandName);
        return newBrand;
    }

    private async Task<Collection> GetOrCreateCollectionAsync(string collectionName, int brandId)
    {
        var existingCollection = await _context.Collections
            .FirstOrDefaultAsync(c => c.Name == collectionName && c.BrandId == brandId);

        if (existingCollection != null)
        {
            return existingCollection;
        }

        var newCollection = new Collection
        {
            Name = collectionName,
            Description = $"{collectionName} collection",
            BrandId = brandId
        };

        _context.Collections.Add(newCollection);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created new collection: {Collection} for brand ID {BrandId}", collectionName, brandId);
        return newCollection;
    }

    private string? BuildSpecsString(WatchApiDto apiWatch)
    {
        var specs = new List<string>();

        if (!string.IsNullOrEmpty(apiWatch.Movement))
            specs.Add($"Movement: {apiWatch.Movement}");

        if (!string.IsNullOrEmpty(apiWatch.CaseMaterial))
            specs.Add($"Case Material: {apiWatch.CaseMaterial}");

        if (!string.IsNullOrEmpty(apiWatch.CaseDiameter))
            specs.Add($"Case Diameter: {apiWatch.CaseDiameter}");

        if (apiWatch.YearOfProduction.HasValue)
            specs.Add($"Year: {apiWatch.YearOfProduction}");

        if (!string.IsNullOrEmpty(apiWatch.Reference) || !string.IsNullOrEmpty(apiWatch.ReferenceNumber))
            specs.Add($"Reference: {apiWatch.Reference ?? apiWatch.ReferenceNumber}");

        return specs.Count > 0 ? string.Join(" | ", specs) : null;
    }

    public async Task<int> GetCachedWatchCountAsync()
    {
        return await _context.Watches.CountAsync();
    }

    public async Task<DateTime?> GetLastSyncTimeAsync()
    {
        // This is a simple implementation. For production, you might want a dedicated sync log table.
        var latestWatch = await _context.Watches
            .OrderByDescending(w => w.Id)
            .FirstOrDefaultAsync();

        return latestWatch != null ? DateTime.UtcNow : null;
    }
}
