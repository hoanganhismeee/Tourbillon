// Admin controller for watch data management
// Provides endpoints for scraping and data management from Chrono24

using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IChrono24ScraperService _scraperService;
    private readonly Chrono24CacheService _cacheService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IChrono24ScraperService scraperService,
        Chrono24CacheService cacheService,
        ILogger<AdminController> logger)
    {
        _scraperService = scraperService;
        _cacheService = cacheService;
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
}
