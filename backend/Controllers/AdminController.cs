// Admin controller for watch data management
// Provides endpoints for scraping and data management from Chrono24

using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IChrono24ScraperService _scraperService;
    private readonly Chrono24CacheService _cacheService;
    private readonly BrandScraperService _brandScraperService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IChrono24ScraperService scraperService,
        Chrono24CacheService cacheService,
        BrandScraperService brandScraperService,
        ILogger<AdminController> logger)
    {
        _scraperService = scraperService;
        _cacheService = cacheService;
        _brandScraperService = brandScraperService;
        _logger = logger;
    }

    /// <summary>
    /// Tests connection to Chrono24 to verify scraping is working
    /// GET: api/admin/test-scraper
    /// </summary>
    [HttpGet("test-scraper")]
    public async Task<IActionResult> TestScraper()
    {
        _logger.LogInformation("Testing Chrono24 connection");

        var (success, message) = await _scraperService.TestConnectionAsync();

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Scrapes watches for a specific brand and collection
    /// POST: api/admin/scrape-collection?brand=Rolex&collection=Submariner&maxWatches=40
    /// </summary>
    [HttpPost("scrape-collection")]
    public async Task<IActionResult> ScrapeCollection(
        [FromQuery] string brand,
        [FromQuery] string collection,
        [FromQuery] int maxWatches = 40)
    {
        if (string.IsNullOrEmpty(brand) || string.IsNullOrEmpty(collection))
        {
            return BadRequest(new
            {
                Success = false,
                Message = "Brand and collection parameters are required"
            });
        }

        _logger.LogInformation("Scraping {Brand} - {Collection} (max {Max} watches)",
            brand, collection, maxWatches);

        var (success, message, watchesAdded) = await _cacheService.ScrapeAndCacheCollectionAsync(
            brand, collection, maxWatches);

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                Brand = brand,
                Collection = collection,
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
            WatchesAdded = watchesAdded,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Scrapes watches for an entire brand
    /// POST: api/admin/scrape-brand?brand=Rolex&maxWatchesPerCollection=40
    /// </summary>
    [HttpPost("scrape-brand")]
    public async Task<IActionResult> ScrapeBrand(
        [FromQuery] string brand,
        [FromQuery] int maxWatchesPerCollection = 40)
    {
        if (string.IsNullOrEmpty(brand))
        {
            return BadRequest(new
            {
                Success = false,
                Message = "Brand parameter is required"
            });
        }

        _logger.LogInformation("Scraping all watches for brand: {Brand}", brand);

        var (success, message, watchesAdded) = await _cacheService.ScrapeAndCacheBrandAsync(
            brand, maxWatchesPerCollection);

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                Brand = brand,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            Brand = brand,
            WatchesAdded = watchesAdded,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Scrapes watches for ALL brands from the database
    /// Holy Trinity (Patek Philippe, Vacheron Constantin, Audemars Piguet): 5 collections × 12 watches = 60 each
    /// Other brands: 3-4 collections × ~5-7 watches = ~20-25 each
    /// This will take a long time - use with caution!
    /// POST: api/admin/scrape-all
    /// </summary>
    [HttpPost("scrape-all")]
    public async Task<IActionResult> ScrapeAllBrands(
        [FromQuery] int maxWatchesPerBrand = 30)
    {
        _logger.LogInformation("Starting bulk scrape for all brands (max {Max} watches per brand)",
            maxWatchesPerBrand);

        var (success, message, watchesAdded) = await _cacheService.ScrapeAllBrandsAsync(
            maxWatchesPerBrand);

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                TotalWatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            TotalWatchesAdded = watchesAdded,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Gets statistics about scraped watch data
    /// GET: api/admin/scrape-stats
    /// </summary>
    [HttpGet("scrape-stats")]
    public async Task<IActionResult> GetScrapeStats()
    {
        _logger.LogInformation("Retrieving scrape statistics");

        var stats = await _cacheService.GetScrapeStatsAsync();

        return Ok(stats);
    }

    /// <summary>
    /// Scrapes watches from official brand website (Patek Philippe, Vacheron Constantin, etc.)
    /// POST: api/admin/scrape-brand-official?brand=Patek Philippe&collection=Calatrava&maxWatches=50
    /// </summary>
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

    /// <summary>
    /// Clears all watches from database except the 9 showcase watches
    /// Use this to reset before scraping fresh data
    /// DELETE: api/admin/clear-watches
    /// </summary>
    [HttpDelete("clear-watches")]
    public async Task<IActionResult> ClearWatches()
    {
        _logger.LogInformation("Clearing all watches except showcase watches");

        var (success, message, deletedCount) = await _cacheService.ClearAllWatchesAsync();

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                WatchesDeleted = deletedCount,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            WatchesDeleted = deletedCount,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Caches external images locally and updates database with local paths
    /// POST: api/admin/cache-images?brandId=2
    /// This eliminates 404 errors from external CDNs by downloading images once
    /// </summary>
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
