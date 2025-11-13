// Admin controller for Watch API management
// Provides endpoints to test API connection and manually sync watches

using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IWatchApiService _watchApiService;
    private readonly WatchApiCacheService _cacheService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IWatchApiService watchApiService,
        WatchApiCacheService cacheService,
        ILogger<AdminController> logger)
    {
        _watchApiService = watchApiService;
        _cacheService = cacheService;
        _logger = logger;
    }

    // GET: api/admin/test-api
    // Tests the Watch API connection and authentication
    [HttpGet("test-api")]
    public async Task<IActionResult> TestApi()
    {
        _logger.LogInformation("Testing Watch API connection");

        var (success, message) = await _watchApiService.TestConnectionAsync();

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

    // POST: api/admin/sync-watches
    // Manually triggers a sync of watches from the API to the database
    [HttpPost("sync-watches")]
    public async Task<IActionResult> SyncWatches()
    {
        _logger.LogInformation("Manual watch sync triggered");

        var (success, message, watchesAdded) = await _cacheService.SyncWatchesFromApiAsync();

        if (success)
        {
            return Ok(new
            {
                Success = true,
                Message = message,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }

        return BadRequest(new
        {
            Success = false,
            Message = message,
            WatchesAdded = watchesAdded,
            Timestamp = DateTime.UtcNow
        });
    }

    // GET: api/admin/sync-status
    // Returns information about the current sync status
    [HttpGet("sync-status")]
    public async Task<IActionResult> GetSyncStatus()
    {
        _logger.LogInformation("Retrieving sync status");

        var cachedWatchCount = await _cacheService.GetCachedWatchCountAsync();
        var lastSyncTime = await _cacheService.GetLastSyncTimeAsync();

        return Ok(new
        {
            CachedWatchCount = cachedWatchCount,
            LastSyncTime = lastSyncTime,
            Timestamp = DateTime.UtcNow
        });
    }

    // GET: api/admin/search-watches
    // Test endpoint to search watches from the API
    [HttpGet("search-watches")]
    public async Task<IActionResult> SearchWatches([FromQuery] string query)
    {
        if (string.IsNullOrEmpty(query))
        {
            return BadRequest(new { Message = "Query parameter is required" });
        }

        _logger.LogInformation("Searching watches: {Query}", query);

        var watches = await _watchApiService.SearchWatchesAsync(query);

        return Ok(new
        {
            Query = query,
            ResultCount = watches.Count,
            Watches = watches.Take(10) // Return only first 10 for testing
        });
    }

    // GET: api/admin/get-brands
    // Test endpoint to fetch brands from the API
    [HttpGet("get-brands")]
    public async Task<IActionResult> GetBrands()
    {
        _logger.LogInformation("Fetching brands from API");

        var brands = await _watchApiService.GetBrandsAsync();

        return Ok(new
        {
            BrandCount = brands.Count,
            Brands = brands
        });
    }
}
