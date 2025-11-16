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
            int apiCallsUsed = 0;

            // Get brands from OUR database (not from the API)
            // We only want to fetch watches for our curated 15 brands
            _logger.LogInformation("Loading brands from local database...");
            var localBrands = await _context.Brands.ToListAsync();

            if (localBrands == null || localBrands.Count == 0)
            {
                return (false, "No brands found in local database", 0);
            }

            _logger.LogInformation("Found {Count} brands in local database", localBrands.Count);

            // Search keywords for each brand (popular models/collections)
            var brandSearchKeywords = GetBrandSearchKeywords();

            // For each brand, search by popular model keywords
            foreach (var brand in localBrands)
            {
                try
                {
                    // Check how many watches we already have for this brand
                    var existingWatchCount = await _context.Watches
                        .Where(w => w.BrandId == brand.Id)
                        .CountAsync();

                    // Target: 30 watches per brand
                    if (existingWatchCount >= 30)
                    {
                        _logger.LogInformation("Brand '{Brand}' already has {Count} watches (target: 30), skipping", brand.Name, existingWatchCount);
                        continue;
                    }

                    _logger.LogInformation("Brand '{Brand}' has {Existing} watches, fetching more (target: 30)", brand.Name, existingWatchCount);

                    // Skip brand search on free plan (usually returns "too_many_results" error)
                    // Go straight to specific model searches which are more likely to work
                    var watches = new List<WatchApiDto>();
                    if (!brandSearchKeywords.TryGetValue(brand.Name, out var keywords))
                    {
                        _logger.LogWarning("No search keywords configured for brand: {Brand}", brand.Name);
                        continue;
                    }

                    // Search for watches using each keyword
                    // Track consecutive failures to skip brands with no data
                    int consecutiveFailures = 0;
                    const int maxConsecutiveFailures = 3; // Skip brand after 3 failed searches in a row
                    
                    foreach (var keyword in keywords)
                    {
                        // Check if we've reached the target for this brand
                        existingWatchCount = await _context.Watches
                            .Where(w => w.BrandId == brand.Id)
                            .CountAsync();

                        if (existingWatchCount >= 30)
                        {
                            _logger.LogInformation("Brand '{Brand}' reached target of 30 watches", brand.Name);
                            break;
                        }

                        // Check API limit before making the call
                        if (apiCallsUsed >= 25)
                        {
                            _logger.LogWarning("Reached API call limit for today (25 calls). Added {Added} watches so far. Run again tomorrow to continue.", totalWatchesAdded);
                            var message = $"Successfully synced {totalWatchesAdded} watches ({apiCallsUsed}/25 API calls used). Reached daily limit.";
                            return (true, message, totalWatchesAdded);
                        }

                        // Search for watches
                        var searchQuery = $"{brand.Name} {keyword}";
                        _logger.LogInformation("Searching: {Query}", searchQuery);

                        watches = await _watchApiService.SearchWatchesAsync(searchQuery);
                        apiCallsUsed++;

                        if (watches == null || watches.Count == 0)
                        {
                            consecutiveFailures++;
                            _logger.LogInformation("No watches found for: {Query} (consecutive failures: {Failures})", searchQuery, consecutiveFailures);
                            
                            // Skip remaining keywords for this brand if too many failures
                            if (consecutiveFailures >= maxConsecutiveFailures)
                            {
                                _logger.LogInformation("Skipping remaining keywords for '{Brand}' - {Failures} consecutive searches returned no results", brand.Name, consecutiveFailures);
                                break;
                            }
                        }
                        else
                        {
                            consecutiveFailures = 0; // Reset counter on success
                            _logger.LogInformation("Found {Count} watches for: {Query}", watches.Count, searchQuery);

                            // Process each watch
                            foreach (var apiWatch in watches)
                            {
                                try
                                {
                                    await ProcessWatchAsync(apiWatch);
                                    totalWatchesAdded++;
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning(ex, "Failed to process watch: {Model}", apiWatch.Model);
                                }
                            }

                            // Save after each search to avoid losing progress
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing brand: {Brand}", brand.Name);
                    // Continue with next brand
                }
            }

            var finalMessage = $"Successfully synced {totalWatchesAdded} watches from {localBrands.Count} brands ({apiCallsUsed} API calls used)";
            _logger.LogInformation(finalMessage);
            return (true, finalMessage, totalWatchesAdded);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing watches from API");
            return (false, $"Sync failed: {ex.Message}", 0);
        }
    }

    // Popular model/collection keywords for targeted searches
    private Dictionary<string, List<string>> GetBrandSearchKeywords()
    {
        return new Dictionary<string, List<string>>
        {
            { "Patek Philippe", new List<string> { "Calatrava", "Nautilus", "Aquanaut", "Complications", "Perpetual Calendar", "Chronograph", "World Time" } },
            { "Vacheron Constantin", new List<string> { "Patrimony", "Overseas", "Historiques", "Fiftysix", "Traditionnelle", "Perpetual Calendar" } },
            { "Audemars Piguet", new List<string> { "Royal Oak", "Royal Oak Offshore", "Royal Oak Concept", "Millenary", "Code 11.59", "Chronograph" } },
            { "Jaeger-LeCoultre", new List<string> { "Reverso", "Master Ultra Thin", "Polaris", "Duometre", "Master Control", "Perpetual Calendar" } },
            { "A. Lange & Söhne", new List<string> { "Lange 1", "Zeitwerk", "Datograph", "Saxonia", "Odysseus", "Perpetual Calendar", "Tourbillon" } },
            { "Glashütte Original", new List<string> { "Senator", "PanoMatic", "SeaQ", "Seventies", "Chronograph", "Perpetual Calendar" } },
            { "F.P.Journe", new List<string> { "Chronometre Souverain", "Octa", "Tourbillon Souverain", "Resonance", "Chronograph" } },
            { "Greubel Forsey", new List<string> { "Double Tourbillon", "Tourbillon 24 Secondes", "Balancier", "GMT", "Quadruple Tourbillon" } },
            { "Rolex", new List<string> { "Submariner", "Daytona", "GMT-Master", "Datejust", "Day-Date", "Explorer", "Oyster Perpetual", "Sea-Dweller" } },
            { "Breguet", new List<string> { "Classique", "Marine", "Tradition", "Type XX", "Tourbillon", "Chronograph", "Perpetual Calendar" } },
            { "Blancpain", new List<string> { "Fifty Fathoms", "Villeret", "Air Command", "Bathyscaphe", "Complete Calendar", "Tourbillon" } },
            { "Omega", new List<string> { "Speedmaster", "Seamaster", "Constellation", "Aqua Terra", "Planet Ocean", "Moonwatch", "Professional" } },
            { "Grand Seiko", new List<string> { "Heritage", "Evolution 9", "Sport", "Snowflake", "Spring Drive", "Hi-Beat", "GMT" } },
            { "IWC Schaffhausen", new List<string> { "Portugieser", "Pilot", "Ingenieur", "Big Pilot", "Chronograph", "Perpetual Calendar", "Portofino" } },
            { "Frederique Constant", new List<string> { "Classics", "Slimline", "Manufacture", "Perpetual Calendar", "Moonphase", "Chronograph", "World Timer" } }
        };
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

        // Check if watch already exists (by model name + brand, or by reference number)
        var reference = apiWatch.Reference ?? apiWatch.ReferenceNumber ?? "";
        var existingWatch = await _context.Watches
            .FirstOrDefaultAsync(w => 
                w.BrandId == brand.Id &&
                (w.Name == apiWatch.Model || 
                 (!string.IsNullOrEmpty(reference) && w.Specs != null && w.Specs.Contains($"Reference: {reference}"))));

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

    // Bulk cache method optimized for paid plans - caches ALL available data
    // Use this during your paid subscription month to maximize data collection
    public async Task<(bool Success, string Message, int WatchesAdded)> BulkCacheAllWatchesAsync(int maxApiCalls = 1000)
    {
        try
        {
            _logger.LogInformation("Starting BULK cache operation (max {MaxCalls} API calls)...", maxApiCalls);

            // Test connection first
            var (connectionSuccess, connectionMessage) = await _watchApiService.TestConnectionAsync();
            if (!connectionSuccess)
            {
                return (false, $"API connection failed: {connectionMessage}", 0);
            }

            int totalWatchesAdded = 0;
            int apiCallsUsed = 0;

            // Get brands from OUR database (not from the API)
            _logger.LogInformation("Loading brands from local database...");
            var localBrands = await _context.Brands.ToListAsync();

            if (localBrands == null || localBrands.Count == 0)
            {
                return (false, "No brands found in local database", 0);
            }

            _logger.LogInformation("Found {Count} brands in local database", localBrands.Count);

            // For each brand, try to get ALL watches using GetWatchesByBrandAsync
            // This method might return more results on paid plans
            foreach (var brand in localBrands)
            {
                try
                {
                    // Check existing count
                    var existingWatchCount = await _context.Watches
                        .Where(w => w.BrandId == brand.Id)
                        .CountAsync();

                    _logger.LogInformation("Brand '{Brand}' currently has {Existing} watches. Fetching all available from API...", brand.Name, existingWatchCount);

                    // Try to get all watches for this brand
                    var watches = await _watchApiService.GetWatchesByBrandAsync(brand.Name);
                    apiCallsUsed++;

                    if (watches == null || watches.Count == 0)
                    {
                        _logger.LogInformation("No watches found for brand: {Brand}", brand.Name);
                        continue;
                    }

                    _logger.LogInformation("Found {Count} watches for brand: {Brand}", watches.Count, brand.Name);

                    // Process each watch
                    int brandWatchesAdded = 0;
                    foreach (var apiWatch in watches)
                    {
                        try
                        {
                            // Check if watch already exists (by reference number or model name)
                            var reference = apiWatch.Reference ?? apiWatch.ReferenceNumber ?? "";
                            var existingWatch = await _context.Watches
                                .FirstOrDefaultAsync(w => 
                                    (w.BrandId == brand.Id) &&
                                    (w.Name == apiWatch.Model || 
                                     (!string.IsNullOrEmpty(reference) && w.Specs != null && w.Specs.Contains(reference))));

                            if (existingWatch == null)
                            {
                                await ProcessWatchAsync(apiWatch);
                                brandWatchesAdded++;
                                totalWatchesAdded++;
                            }
                            else
                            {
                                // Update existing watch with latest price if available
                                if (apiWatch.Price.HasValue && apiWatch.Price.Value > 0)
                                {
                                    existingWatch.CurrentPrice = apiWatch.Price.Value;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to process watch: {Model}", apiWatch.Model);
                        }
                    }

                    // Save after each brand to avoid losing progress
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Added {Added} new watches for brand: {Brand} (total now: {Total})", 
                        brandWatchesAdded, brand.Name, existingWatchCount + brandWatchesAdded);

                    // Check API call limit
                    if (apiCallsUsed >= maxApiCalls)
                    {
                        _logger.LogWarning("Reached API call limit ({MaxCalls}). Processed {Brands} brands. Run again to continue.", 
                            maxApiCalls, localBrands.IndexOf(brand) + 1);
                        var message = $"Bulk cache paused: {totalWatchesAdded} watches added ({apiCallsUsed}/{maxApiCalls} API calls used). Run again to continue.";
                        return (true, message, totalWatchesAdded);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing brand: {Brand}", brand.Name);
                    // Continue with next brand
                }
            }

            var finalMessage = $"Bulk cache complete: {totalWatchesAdded} watches added from {localBrands.Count} brands ({apiCallsUsed} API calls used)";
            _logger.LogInformation(finalMessage);
            return (true, finalMessage, totalWatchesAdded);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in bulk cache operation");
            return (false, $"Bulk cache failed: {ex.Message}", 0);
        }
    }
}
