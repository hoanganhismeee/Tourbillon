// Admin controller for watch data management
// Provides endpoints for scraping and data management from official brand websites

using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly WatchCacheService _cacheService;
    private readonly BrandScraperService _brandScraperService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        WatchCacheService cacheService,
        BrandScraperService brandScraperService,
        ILogger<AdminController> logger)
    {
        _cacheService = cacheService;
        _brandScraperService = brandScraperService;
        _logger = logger;
    }

    /// Gets statistics about scraped watch data
    /// GET: api/admin/scrape-stats
    [HttpGet("scrape-stats")]
    public async Task<IActionResult> GetScrapeStats()
    {
        _logger.LogInformation("Retrieving scrape statistics");

        var stats = await _cacheService.GetScrapeStatsAsync();

        return Ok(stats);
    }

    /// Scrapes watches from official brand website (Patek Philippe, Vacheron Constantin, etc.)
    /// POST: api/admin/scrape-brand-official?brand=Patek Philippe&collection=Calatrava&maxWatches=50
    [HttpPost("scrape-brand-official")]
    public async Task<IActionResult> ScrapeBrandOfficial(
        [FromQuery] string brand,
        [FromQuery] string collection,
        [FromQuery] int maxWatches = 50)
    {
        if (string.IsNullOrEmpty(brand) || string.IsNullOrEmpty(collection))
        {
            return BadRequest(new
            {
                Success = false,
                Message = "Brand and collection parameters are required"
            });
        }

        _logger.LogInformation("Scraping {Brand} - {Collection} from official website (max {Max} watches)",
            brand, collection, maxWatches);

        try
        {
            // Scrape from brand's official website
            var scrapedWatches = await _brandScraperService.ScrapeCollectionAsync(
                brand, collection, maxWatches);

            if (scrapedWatches == null || scrapedWatches.Count == 0)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = $"No watches found for {brand} - {collection}",
                    Brand = brand,
                    Collection = collection,
                    WatchesScraped = 0,
                    Timestamp = DateTime.UtcNow
                });
            }

            // Cache the scraped watches to database (with duplicate checking and showcase watch preservation)
            var (success, message, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(scrapedWatches);

            if (success)
            {
                return Ok(new
                {
                    Success = true,
                    Message = message,
                    Brand = brand,
                    Collection = collection,
                    WatchesScraped = scrapedWatches.Count,
                    WatchesAdded = watchesAdded,
                    Timestamp = DateTime.UtcNow
                });
            }

            return BadRequest(new
            {
                Success = false,
                Message = message,
                Brand = brand,
                Collection = collection,
                WatchesScraped = scrapedWatches.Count,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping {Brand} - {Collection} from official website", brand, collection);
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error scraping: {ex.Message}",
                Brand = brand,
                Collection = collection,
                Timestamp = DateTime.UtcNow
            });
        }
    }

    /// Scrapes multiple brands with error isolation - safe for 12+ brands
    /// POST: api/admin/scrape-multiple
    /// Body: { "brands": [{"brandName": "Patek Philippe", "collectionName": "Calatrava", "maxWatches": 50}, ...] }
    [HttpPost("scrape-multiple")]
    public async Task<IActionResult> ScrapeMultipleBrands(
        [FromBody] ScrapeMultipleBrandsRequest request,
        [FromQuery] int timeoutSecondsPerBrand = 300)
    {
        if (request?.Brands == null || request.Brands.Count == 0)
        {
            return BadRequest(new
            {
                Success = false,
                Message = "At least one brand must be specified",
                Timestamp = DateTime.UtcNow
            });
        }

        _logger.LogInformation("Starting multi-brand scrape for {Count} brands with {Timeout}s timeout per brand",
            request.Brands.Count, timeoutSecondsPerBrand);

        try
        {
            // Convert request to format expected by service
            var brandsToScrape = request.Brands
                .Select(b => (b.BrandName, b.CollectionName, b.MaxWatches))
                .ToList();

            // Scrape all brands with error isolation
            var scrapeResults = await _brandScraperService.ScrapeMultipleBrandsAsync(
                brandsToScrape, timeoutSecondsPerBrand);

            // Cache successful scrapes to database
            var cacheResults = new List<object>();
            foreach (var scrapeResult in scrapeResults.Where(r => r.Success && r.WatchesScraped > 0))
            {
                // Get the watches that were just scraped for this brand
                var brandRequest = request.Brands.FirstOrDefault(b => b.BrandName == scrapeResult.BrandName);
                if (brandRequest == null) continue;

                var watches = await _brandScraperService.ScrapeCollectionAsync(
                    scrapeResult.BrandName,
                    scrapeResult.CollectionName,
                    brandRequest.MaxWatches);

                var (cacheSuccess, cacheMessage, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(watches);

                cacheResults.Add(new
                {
                    BrandName = scrapeResult.BrandName,
                    CollectionName = scrapeResult.CollectionName,
                    CacheSuccess = cacheSuccess,
                    WatchesAdded = watchesAdded,
                    CacheMessage = cacheMessage
                });

                scrapeResult.WatchesAdded = watchesAdded;
            }

            var successCount = scrapeResults.Count(r => r.Success);
            var failedCount = scrapeResults.Count(r => !r.Success);

            return Ok(new
            {
                Success = true,
                Message = $"Scraping completed: {successCount} succeeded, {failedCount} failed",
                TotalBrands = request.Brands.Count,
                SuccessCount = successCount,
                FailedCount = failedCount,
                Results = scrapeResults,
                CacheResults = cacheResults,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in multi-brand scraping");
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error scraping multiple brands: {ex.Message}",
                Timestamp = DateTime.UtcNow
            });
        }
    }

    /// Clears watches from database with optional brand filtering
    /// If brandId is provided: deletes only that brand's scraped watches (preserves showcase watches)
    /// If no brandId: deletes all watches except the 9 showcase watches
    /// Use this to reset before scraping fresh data
    /// DELETE: api/admin/clear-watches
    /// DELETE: api/admin/clear-watches?brandId=2
    [HttpDelete("clear-watches")]
    public async Task<IActionResult> ClearWatches([FromQuery] int? brandId = null)
    {
        if (brandId.HasValue)
        {
            _logger.LogInformation("Clearing all scraped watches for brand ID {BrandId}", brandId);
        }
        else
        {
            _logger.LogInformation("Clearing all watches except showcase watches");
        }

        var (success, message, deletedCount) = await _cacheService.ClearAllWatchesAsync(brandId);

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                BrandId = brandId,
                WatchesDeleted = deletedCount,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            BrandId = brandId,
            WatchesDeleted = deletedCount,
            Timestamp = DateTime.UtcNow
        });
    }

    /// Caches external images locally and updates database with local paths
    /// POST: api/admin/cache-images?brandId=2
    /// This eliminates 404 errors from external CDNs by downloading images once
    [HttpPost("cache-images")]
    public async Task<IActionResult> CacheImagesLocally([FromQuery] int brandId)
    {
        _logger.LogInformation("Starting image caching for brand ID {BrandId}", brandId);

        try
        {
            // Create Images directory if it doesn't exist
            var imagesDir = Path.Combine(Directory.GetCurrentDirectory(), "Images");
            if (!Directory.Exists(imagesDir))
            {
                Directory.CreateDirectory(imagesDir);
            }

            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

            int successCount = 0;
            int failureCount = 0;

            // Get all watches for the brand that have external URLs (starting with http)
            var context = HttpContext.RequestServices.GetRequiredService<backend.Database.TourbillonContext>();
            var watchesToCache = await context.Watches
                .Where(w => w.BrandId == brandId && w.Image.StartsWith("http"))
                .ToListAsync();

            _logger.LogInformation("Found {Count} watches with external URLs for brand {BrandId}", watchesToCache.Count.ToString(), brandId.ToString());

            foreach (var watch in watchesToCache)
            {
                try
                {
                    // Strip transformation parameters from URL (e.g., .transform.vacdetail.png -> .png)
                    string imageUrl = watch.Image;
                    if (imageUrl.Contains(".transform."))
                    {
                        imageUrl = System.Text.RegularExpressions.Regex.Replace(imageUrl, @"\.transform\.[^.]+(\.\w+)$", "$1");
                    }

                    // Download image
                    var imageResponse = await httpClient.GetAsync(imageUrl);
                    if (!imageResponse.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to download image for watch {WatchId} from {Url}: {StatusCode}",
                            watch.Id, imageUrl, imageResponse.StatusCode);
                        failureCount++;
                        continue;
                    }

                    // Save locally with unique filename
                    var imageBytes = await imageResponse.Content.ReadAsByteArrayAsync();
                    var extension = Path.GetExtension(new Uri(imageUrl).LocalPath) ?? ".png";
                    var localFilename = $"VC_{watch.Id}_{Path.GetFileNameWithoutExtension(watch.Name).Replace("/", "_")}{extension}";
                    var localPath = Path.Combine(imagesDir, localFilename);

                    await System.IO.File.WriteAllBytesAsync(localPath, imageBytes);

                    // Update database with local filename
                    watch.Image = localFilename;
                    context.Watches.Update(watch);

                    _logger.LogInformation("Cached image for watch {WatchId}: {Filename}", watch.Id, localFilename);
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error caching image for watch {WatchId}", watch.Id);
                    failureCount++;
                }
            }

            // Save all changes to database
            await context.SaveChangesAsync();

            return Ok(new
            {
                Success = true,
                Message = $"Image caching completed for brand {brandId}",
                TotalWatches = watchesToCache.Count,
                CachedCount = successCount,
                FailedCount = failureCount,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in image caching process");
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error caching images: {ex.Message}",
                Timestamp = DateTime.UtcNow
            });
        }
    }
}

/// Request DTO for scraping multiple brands
public class ScrapeMultipleBrandsRequest
{
    public List<BrandScrapeRequest> Brands { get; set; } = new();
}

/// Individual brand scrape request
public class BrandScrapeRequest
{
    public string BrandName { get; set; } = string.Empty;
    public string CollectionName { get; set; } = string.Empty;
    public int MaxWatches { get; set; } = 50;
}
