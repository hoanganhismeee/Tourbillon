// Admin controller for watch data management
// Provides endpoints for scraping and data management from official brand websites

using backend.Database;
using backend.DTOs;
using backend.Jobs;
using backend.Models;
using backend.Services;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly WatchCacheService _cacheService;
    private readonly BrandScraperService _brandScraperService;
    private readonly SitemapScraperService _sitemapScraperService;
    private readonly WatchEmbeddingService _embeddingService;
    private readonly WatchFinderService _watchFinderService;
    private readonly QueryCacheService _queryCache;
    private readonly WatchEditorialService _editorialService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        WatchCacheService cacheService,
        BrandScraperService brandScraperService,
        SitemapScraperService sitemapScraperService,
        WatchEmbeddingService embeddingService,
        WatchFinderService watchFinderService,
        QueryCacheService queryCache,
        WatchEditorialService editorialService,
        ILogger<AdminController> logger)
    {
        _cacheService = cacheService;
        _brandScraperService = brandScraperService;
        _sitemapScraperService = sitemapScraperService;
        _embeddingService = embeddingService;
        _watchFinderService = watchFinderService;
        _queryCache = queryCache;
        _editorialService = editorialService;
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

    /// Scrapes a single watch from any URL using Selenium + Claude API
    /// POST: api/admin/scrape-url?url=https://www.glashuette-original.com/en/watches/senator/...&brand=Glashütte Original

    [AllowAnonymous]
    [HttpPost("scrape-url")]
    public async Task<IActionResult> ScrapeUrl(
        [FromQuery] string url,
        [FromQuery] string brand)
    {
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(brand))
        {
            return BadRequest(new { Success = false, Message = "Both url and brand parameters are required" });
        }

        _logger.LogInformation("Single URL scrape: {Brand} - {Url}", brand, url);

        try
        {
            var watch = await _sitemapScraperService.ScrapeFromUrlAsync(url, brand);
            if (watch == null)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = $"Failed to extract watch data from {url}",
                    Brand = brand,
                    Url = url
                });
            }

            var (success, message, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(new List<ScrapedWatchDto> { watch });

            return Ok(new
            {
                Success = success,
                Message = message,
                Brand = brand,
                WatchName = watch.Name,
                ReferenceNumber = watch.ReferenceNumber,
                Collection = watch.CollectionName,
                Price = watch.CurrentPrice,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping URL {Url}", url);
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error scraping: {ex.Message}",
                Url = url,
                Brand = brand,
                Timestamp = DateTime.UtcNow
            });
        }
    }

    /// Scrapes watches using sitemap-driven discovery with Claude API (no XPath config needed)
    /// POST: api/admin/scrape-sitemap?brand=Glashütte Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Senator&maxWatches=5

    [HttpPost("scrape-sitemap")]
    public async Task<IActionResult> ScrapeSitemap(
        [FromQuery] string brand,
        [FromQuery] string sitemapUrl,
        [FromQuery] string? collection = null,
        [FromQuery] int maxWatches = 50)
    {
        if (string.IsNullOrEmpty(brand) || string.IsNullOrEmpty(sitemapUrl))
        {
            return BadRequest(new { Success = false, Message = "Both brand and sitemapUrl parameters are required" });
        }

        _logger.LogInformation("Sitemap scrape: {Brand} - {Collection} (max {Max})",
            brand, collection ?? "ALL", maxWatches);

        try
        {
            var scrapedWatches = await _sitemapScraperService.ScrapeFromSitemapAsync(
                brand, sitemapUrl, collection, maxWatches);

            if (scrapedWatches.Count == 0)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = $"No watches found for {brand} - {collection ?? "ALL"}",
                    Brand = brand,
                    Collection = collection,
                    WatchesScraped = 0
                });
            }

            var (success, message, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(scrapedWatches);

            return Ok(new
            {
                Success = success,
                Message = message,
                Brand = brand,
                Collection = collection ?? "ALL",
                WatchesScraped = scrapedWatches.Count,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in sitemap scrape for {Brand}", brand);
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error scraping: {ex.Message}",
                Brand = brand,
                Timestamp = DateTime.UtcNow
            });
        }
    }

    /// Scrapes watches from a collection listing page (for brands that block sitemaps)
    /// POST: api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/submariner/all-models&collection=Submariner&maxWatches=50

    [AllowAnonymous]
    [HttpPost("scrape-listing")]
    public async Task<IActionResult> ScrapeListingPage(
        [FromQuery] string brand,
        [FromQuery] string listingUrl,
        [FromQuery] string? collection = null,
        [FromQuery] int maxWatches = 50)
    {
        if (string.IsNullOrEmpty(brand) || string.IsNullOrEmpty(listingUrl))
        {
            return BadRequest(new { Success = false, Message = "Both brand and listingUrl parameters are required" });
        }

        _logger.LogInformation("Listing page scrape: {Brand} - {Collection} from {Url}",
            brand, collection ?? "ALL", listingUrl);

        try
        {
            var scrapedWatches = await _sitemapScraperService.ScrapeFromListingPageAsync(
                brand, listingUrl, collection, maxWatches);

            if (scrapedWatches.Count == 0)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = $"No watches found for {brand} - {collection ?? "ALL"}",
                    Brand = brand,
                    Collection = collection,
                    WatchesScraped = 0
                });
            }

            var (success, message, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(scrapedWatches);

            return Ok(new
            {
                Success = success,
                Message = message,
                Brand = brand,
                Collection = collection ?? "ALL",
                WatchesScraped = scrapedWatches.Count,
                WatchesAdded = watchesAdded,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in listing page scrape for {Brand}", brand);
            return StatusCode(500, new
            {
                Success = false,
                Message = $"Error scraping: {ex.Message}",
                Brand = brand,
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

    /// Adds watches directly from manually extracted data (no Selenium/Claude needed)
    /// POST: api/admin/add-watches
    /// Body: JSON array of ScrapedWatchDto
    [AllowAnonymous]
    [HttpPost("add-watches")]
    public async Task<IActionResult> AddWatchesManually([FromBody] List<ScrapedWatchDto> watches)
    {
        if (watches == null || watches.Count == 0)
        {
            return BadRequest(new { Success = false, Message = "No watches provided" });
        }

        _logger.LogInformation("Manually adding {Count} watches", watches.Count);

        var (success, message, watchesAdded) = await _cacheService.CacheScrapedWatchesAsync(watches);

        return Ok(new
        {
            Success = success,
            Message = message,
            WatchesAdded = watchesAdded,
            TotalProvided = watches.Count,
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
                .Where(w => w.BrandId == brandId && w.Image != null && w.Image.StartsWith("http"))
                .ToListAsync();

            _logger.LogInformation("Found {Count} watches with external URLs for brand {BrandId}", watchesToCache.Count.ToString(), brandId.ToString());

            foreach (var watch in watchesToCache)
            {
                try
                {
                    // Strip transformation parameters from URL (e.g., .transform.vacdetail.png -> .png)
                    var imageUrl = watch.Image;
                    if (string.IsNullOrEmpty(imageUrl))
                    {
                        failureCount++;
                        continue;
                    }

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

    /// Bulk generates JSON specifications for JLC, AP, and ALS watches
    /// POST: api/admin/fill-specs
    [HttpPost("fill-specs")]
    public async Task<IActionResult> FillSpecs()
    {
        _logger.LogInformation("Starting bulk specification generation for JLC, AP, and ALS");

        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            
            // Get all AP, JLC, ALS watches missing specs
            var watchesToUpdate = await context.Watches
                .Where(w => (w.BrandId == 3 || w.BrandId == 4 || w.BrandId == 5) && 
                            (w.Specs == null || w.Specs == "{}"))
                .ToListAsync();

            _logger.LogInformation("Found {Count} watches missing specs", watchesToUpdate.Count);

            int updatedCount = 0;
            foreach (var watch in watchesToUpdate)
            {
                var template = GetSpecsTemplate(watch.CollectionId);
                if (template != null)
                {
                    // Basic tailoring based on name
                    var templateJson = JsonSerializer.Serialize(template);
                    var specsObj = JsonNode.Parse(templateJson);
                    
                    if (specsObj != null)
                    {
                        string watchNameLower = watch.Name.ToLower();
                        
                        if (watchNameLower.Contains("white gold") || watchNameLower.Contains("18k white gold"))
                            specsObj["@case"]!["material"] = "18K White Gold";
                        else if (watchNameLower.Contains("platinum"))
                            specsObj["@case"]!["material"] = "Platinum";
                        else if (watchNameLower.Contains("ceramic"))
                            specsObj["@case"]!["material"] = "Ceramic";

                        watch.Specs = specsObj.ToJsonString();
                        context.Watches.Update(watch);
                        updatedCount++;
                    }
                }
            }

            await context.SaveChangesAsync();

            return Ok(new
            {
                Success = true,
                Message = $"Successfully updated {updatedCount} watches with specifications",
                TotalFound = watchesToUpdate.Count,
                UpdatedCount = updatedCount,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in FillSpecs");
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    /// Verifies and corrects naming conventions according to user rules {Ref} {Variant}
    /// POST: api/admin/verify-naming
    [HttpPost("verify-naming")]
    public async Task<IActionResult> VerifyNaming()
    {
        _logger.LogInformation("Starting naming convention verification");

        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var watches = await context.Watches.ToListAsync();
            int correctedCount = 0;

            foreach (var watch in watches)
            {
                string originalName = watch.Name;
                
                // Rule: Name should be {ReferenceNumber} {Variant}
                // If name repeats brand name or collection name redundantly, clean it up
                var brand = await context.Brands.FindAsync(watch.BrandId);
                var collection = await context.Collections.FindAsync(watch.CollectionId);
                
                string newName = watch.Name;

                // Remove Brand name from start if present
                if (brand != null && newName.StartsWith(brand.Name, StringComparison.OrdinalIgnoreCase))
                {
                    newName = newName.Substring(brand.Name.Length).Trim();
                }

                // Remove redundant collection name if it's at the end
                if (collection != null && newName.EndsWith(collection.Name, StringComparison.OrdinalIgnoreCase) && newName.Length > collection.Name.Length)
                {
                    newName = newName.Substring(0, newName.Length - collection.Name.Length).Trim();
                }

                // Remove redundant collection name if it's at the start
                if (collection != null && newName.StartsWith(collection.Name, StringComparison.OrdinalIgnoreCase) && newName.Length > collection.Name.Length)
                {
                    newName = newName.Substring(collection.Name.Length).Trim();
                }

                watch.Name = newName;

                if (originalName != watch.Name)
                {
                    context.Watches.Update(watch);
                    correctedCount++;
                }
            }

            await context.SaveChangesAsync();

            return Ok(new
            {
                Success = true,
                Message = $"Verified names. Corrected {correctedCount} watches.",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in VerifyNaming");
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    /// Audits the database for quality issues
    /// GET: api/admin/audit
    [HttpGet("audit")]
    public async Task<IActionResult> Audit()
    {
        _logger.LogInformation("Starting database audit");

        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var allWatches = await context.Watches.ToListAsync();
            
            var missingSpecs = allWatches.Where(w => string.IsNullOrEmpty(w.Specs) || w.Specs == "{}").Select(w => w.Id).ToList();
            var zeroPrices = allWatches.Where(w => w.CurrentPrice == 0).Select(w => w.Id).ToList();
            var externalImages = allWatches.Where(w => w.Image != null && w.Image.StartsWith("http")).Select(w => w.Id).ToList();
            var missingCollections = allWatches.Where(w => w.CollectionId == null).Select(w => w.Id).ToList();

            return Ok(new
            {
                TotalWatches = allWatches.Count,
                MissingSpecsCount = missingSpecs.Count,
                ZeroPriceCount = zeroPrices.Count,
                ExternalImageCount = externalImages.Count,
                MissingCollectionCount = missingCollections.Count,
                MissingSpecsSample = missingSpecs.Take(5),
                ZeroPriceSample = zeroPrices.Take(5),
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Audit");
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    /// Retrieves a list of watches for the admin grid
    /// GET: api/admin/watches
    [HttpGet("watches")]
    public async Task<IActionResult> AdminGetWatches()
    {
        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var storage = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var watches = (await context.Watches
                .OrderBy(w => w.Id)
                .ToListAsync())
                .Select(w => new
                {
                    w.Id,
                    w.Name,
                    w.CurrentPrice,
                    w.Image,
                    ImageUrl = storage.GetPublicUrl(w.Image, w.ImageVersion),
                    w.BrandId,
                    w.CollectionId
                })
                .ToList();

            return Ok(watches);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting admin watches");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Retrieves a specific watch for the admin editor
    /// GET: api/admin/watches/{id}
    [HttpGet("watches/{id}")]
    public async Task<IActionResult> AdminGetWatch(int id)
    {
        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var storage = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var watch = await context.Watches
                .Include(w => w.EditorialLink)
                    .ThenInclude(l => l!.EditorialContent)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (watch == null) return NotFound(new { Message = "Watch not found" });

            var dto = WatchDto.FromWatch(watch, storage, editorial: watch.EditorialLink?.EditorialContent);
            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting watch {Id}", id);
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Updates a watch from the admin editor
    /// PUT: api/admin/watches/{id}
    [HttpPut("watches/{id}")]
    public async Task<IActionResult> AdminUpdateWatch(int id, [FromBody] UpdateWatchDto updatedWatch)
    {
        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var watch = await context.Watches.FindAsync(id);

            if (watch == null) return NotFound(new { Message = "Watch not found" });

            // Validation logic
            if (updatedWatch.CurrentPrice < 0)
                return BadRequest(new { Message = "Price cannot be negative" });

            if (updatedWatch.CollectionId.HasValue)
            {
                var collectionExists = await context.Collections.AnyAsync(c => c.Id == updatedWatch.CollectionId.Value && c.BrandId == watch.BrandId);
                if (!collectionExists)
                    return BadRequest(new { Message = "Collection does not exist for this brand" });
            }

            if (!string.IsNullOrEmpty(updatedWatch.Specs))
            {
                try
                {
                    JsonDocument.Parse(updatedWatch.Specs);
                }
                catch
                {
                    return BadRequest(new { Message = "Invalid Specs JSON format" });
                }
            }

            watch.Name = updatedWatch.Name;
            watch.CurrentPrice = updatedWatch.CurrentPrice;
            watch.Image = updatedWatch.Image;
            watch.CollectionId = updatedWatch.CollectionId;
            watch.Specs = updatedWatch.Specs;
            if (updatedWatch.Description != null)
                watch.Description = updatedWatch.Description;

            context.Watches.Update(watch);
            await context.SaveChangesAsync();

            return Ok(new { Success = true, Message = "Watch updated successfully", Watch = watch });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating watch {Id}", id);
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Creates a new watch from the admin editor
    /// POST: api/admin/watches
    [HttpPost("watches")]
    public async Task<IActionResult> AdminCreateWatch([FromBody] CreateWatchDto dto)
    {
        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();

            if (dto.CurrentPrice < 0)
                return BadRequest(new { Message = "Price cannot be negative" });

            var brand = await context.Brands.FindAsync(dto.BrandId);
            if (brand == null)
                return BadRequest(new { Message = "Brand not found" });

            Collection? collection = null;
            if (dto.CollectionId.HasValue)
            {
                collection = await context.Collections.FirstOrDefaultAsync(c => c.Id == dto.CollectionId.Value && c.BrandId == dto.BrandId);
                if (collection == null)
                    return BadRequest(new { Message = "Collection does not exist for this brand" });
            }

            if (!string.IsNullOrEmpty(dto.Specs))
            {
                try { JsonDocument.Parse(dto.Specs); }
                catch { return BadRequest(new { Message = "Invalid Specs JSON format" }); }
            }

            // Generate a unique slug at creation time — avoids unique-index violations on SaveChanges
            var existingSlugs = new HashSet<string>(
                await context.Watches.Select(w => w.Slug).ToListAsync());
            var baseSlug = backend.Helpers.SlugHelper.GenerateSlug(brand.Name, collection?.Name, dto.Name);
            var slug = baseSlug;
            var i = 2;
            while (!existingSlugs.Add(slug))
                slug = $"{baseSlug}-{i++}";

            var watch = new Watch
            {
                Name = dto.Name,
                Slug = slug,
                Description = dto.Description,
                CurrentPrice = dto.CurrentPrice,
                Image = dto.Image,
                BrandId = dto.BrandId,
                CollectionId = dto.CollectionId,
                Specs = dto.Specs
            };

            context.Watches.Add(watch);
            await context.SaveChangesAsync();

            return Ok(new { Success = true, Message = "Watch created successfully", Watch = watch });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating watch");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Uploads a replacement image for a specific watch.
    /// Always uses the canonical public ID (Brand_Collection_Ref) — auto-corrects bad names.
    /// If the current DB image already has a canonical ID, reuses it (no rename). Otherwise deletes the orphan.
    /// Updates Watch.Image + Watch.ImageVersion in DB so all API responses immediately reflect the new URL.
    /// POST: api/admin/watches/{id}/image
    [HttpPost("watches/{id}/image")]
    public async Task<IActionResult> AdminUploadWatchImage(int id, IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "No file uploaded" });

            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { Message = "File size exceeds 10MB limit" });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp")
                return BadRequest(new { Message = "Only PNG, JPG, and WEBP files are allowed" });

            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();

            var watch = await context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (watch == null) return NotFound(new { Message = "Watch not found" });

            // Build canonical public ID using same convention as NormalizeImageNames
            var collectionPart = watch.Collection != null ? SanitizeSegment(watch.Collection.Name) : "NoCollection";
            var canonical = $"watches/{GetBrandAcronym(watch.Brand.Name)}_{collectionPart}_{SanitizeWatchName(watch.Name)}";

            // Detect whether current DB image is already canonical (quality check)
            var currentIsOrphan = !string.IsNullOrEmpty(watch.Image)
                && watch.Image.StartsWith("watches/", StringComparison.OrdinalIgnoreCase)
                && !watch.Image.Equals(canonical, StringComparison.OrdinalIgnoreCase);

            using var stream = file.OpenReadStream();
            var (publicId, version) = await storageService.UploadImageAsync(stream, $"{canonical.Substring("watches/".Length)}{ext}");

            if (string.IsNullOrEmpty(publicId))
                return StatusCode(500, new { Message = "Failed to upload image to storage" });

            // Delete orphaned asset if we just corrected a bad public ID
            if (currentIsOrphan)
                await storageService.DeleteImageAsync(watch.Image!);

            // Persist canonical ID + version — all API responses now serve the new versioned URL
            watch.Image = canonical;
            watch.ImageVersion = version;
            await context.SaveChangesAsync();

            return Ok(new { Success = true, PublicId = canonical, Version = version });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image for watch {Id}", id);
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Legacy upload endpoint — used when creating new watches before they have an ID.
    /// POST: api/admin/watches/upload-image
    [HttpPost("watches/upload-image")]
    public async Task<IActionResult> AdminUploadImageTemp(IFormFile file, [FromForm] string? slug = null)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "No file uploaded" });

            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { Message = "File size exceeds 10MB limit" });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp")
                return BadRequest(new { Message = "Only PNG, JPG, and WEBP files are allowed" });

            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            using var stream = file.OpenReadStream();
            string filenameToUse = !string.IsNullOrEmpty(slug) ? $"{slug}{ext}" : file.FileName;
            var (publicId, version) = await storageService.UploadImageAsync(stream, filenameToUse);

            if (string.IsNullOrEmpty(publicId))
                return StatusCode(500, new { Message = "Failed to upload image to storage" });

            return Ok(new { Success = true, PublicId = publicId, Version = version });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading temp image");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Uploads a raw file to Cloudinary so the user can edit it (background removal, resize) in the Cloudinary dashboard.
    /// Returns the Cloudinary public ID and a direct URL to open in Cloudinary Media Library.
    /// POST: api/admin/watches/stage-cloudinary
    [HttpPost("watches/stage-cloudinary")]
    public async Task<IActionResult> AdminStageOnCloudinary(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "No file uploaded" });
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { Message = "File size exceeds 10MB limit" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp")
                return BadRequest(new { Message = "Only PNG, JPG, and WEBP files are allowed" });

            var cloudinaryService = HttpContext.RequestServices.GetRequiredService<ICloudinaryService>();
            var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
            var cloudName = config["Cloudinary:CloudName"] ?? "dcd9lcdoj";

            using var stream = file.OpenReadStream();
            var (publicId, _) = await cloudinaryService.UploadImageAsync(stream, file.FileName, "watches");

            if (string.IsNullOrEmpty(publicId))
                return StatusCode(500, new { Message = "Failed to stage image on Cloudinary" });

            var cloudinaryUrl = $"https://res.cloudinary.com/{cloudName}/image/upload/{publicId}";
            return Ok(new { Success = true, CloudinaryPublicId = publicId, CloudinaryUrl = cloudinaryUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error staging image on Cloudinary");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Downloads a processed image from Cloudinary and stores it in S3 under the canonical key for this watch.
    /// Use after editing the image in the Cloudinary dashboard (background removal, resize, etc.).
    /// POST: api/admin/watches/{id}/image/from-cloudinary?publicId=watches/...
    [HttpPost("watches/{id:int}/image/from-cloudinary")]
    public async Task<IActionResult> AdminFinalizeFromCloudinary(int id, [FromQuery] string publicId)
    {
        try
        {
            if (string.IsNullOrEmpty(publicId))
                return BadRequest(new { Message = "publicId query parameter is required" });

            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
            var cloudName = config["Cloudinary:CloudName"] ?? "dcd9lcdoj";

            var watch = await context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (watch == null) return NotFound(new { Message = "Watch not found" });

            var collectionPart = watch.Collection != null ? SanitizeSegment(watch.Collection.Name) : "NoCollection";
            var canonical = $"watches/{GetBrandAcronym(watch.Brand.Name)}_{collectionPart}_{SanitizeWatchName(watch.Name)}";

            var currentIsOrphan = !string.IsNullOrEmpty(watch.Image)
                && watch.Image.StartsWith("watches/", StringComparison.OrdinalIgnoreCase)
                && !watch.Image.Equals(canonical, StringComparison.OrdinalIgnoreCase);

            var cloudinaryUrl = $"https://res.cloudinary.com/{cloudName}/image/upload/{publicId}";
            var uploadedKey = await storageService.UploadImageFromUrlAsync(cloudinaryUrl, canonical);

            if (string.IsNullOrEmpty(uploadedKey))
                return StatusCode(500, new { Message = "Failed to download from Cloudinary or upload to S3" });

            if (currentIsOrphan)
                await storageService.DeleteImageAsync(watch.Image!);

            watch.Image = canonical;
            watch.ImageVersion = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            await context.SaveChangesAsync();

            return Ok(new { Success = true, PublicId = canonical, Version = watch.ImageVersion });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finalizing image from Cloudinary for watch {Id}", id);
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Downloads an image from any URL and stages it in S3 as a temporary asset.
    /// Used in AddWatchModal to import a Cloudinary-processed image before a watch ID exists.
    /// POST: api/admin/watches/image-from-url
    [HttpPost("watches/image-from-url")]
    public async Task<IActionResult> AdminUploadImageFromUrl([FromBody] System.Text.Json.JsonDocument body)
    {
        try
        {
            var imageUrl = body.RootElement.GetProperty("imageUrl").GetString();
            if (string.IsNullOrEmpty(imageUrl))
                return BadRequest(new { Message = "imageUrl is required" });

            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var tempKey = $"watches/temp-{Guid.NewGuid():N}";
            var uploadedKey = await storageService.UploadImageFromUrlAsync(imageUrl, tempKey);

            if (string.IsNullOrEmpty(uploadedKey))
                return StatusCode(500, new { Message = "Failed to download or upload image" });

            return Ok(new { Success = true, PublicId = uploadedKey });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image from URL");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Bumps ImageVersion to the current Unix timestamp for all watches (or a single brand).
    /// Call this after replacing images directly in Cloudinary to bust CDN cache without re-uploading.
    /// POST: api/admin/watches/refresh-image-cache?brandId=4
    [HttpPost("watches/refresh-image-cache")]
    public async Task<IActionResult> RefreshImageCache([FromQuery] int? brandId = null)
    {
        var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
        var query = context.Watches.AsQueryable();
        if (brandId.HasValue)
            query = query.Where(w => w.BrandId == brandId.Value);

        var watches = await query.ToListAsync();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        foreach (var w in watches)
            w.ImageVersion = now;

        await context.SaveChangesAsync();
        return Ok(new { Updated = watches.Count, Version = now });
    }

    /// Converts full Cloudinary URLs to public IDs in the database
    /// POST: api/admin/migrate-image-urls?dryRun=true
    /// Use dryRun=true (default) to preview changes, dryRun=false to apply
    [HttpPost("migrate-image-urls")]
    public async Task<IActionResult> MigrateImageUrls([FromQuery] bool dryRun = true)
    {
        try
        {
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();

            // Find all watches with full Cloudinary URLs
            var watches = await context.Watches
                .Where(w => w.Image != null && w.Image.StartsWith("https://res.cloudinary.com"))
                .ToListAsync();

            if (watches.Count == 0)
                return Ok(new { Message = "No watches with full Cloudinary URLs found", Count = 0 });

            var changes = new List<object>();
            var regex = new System.Text.RegularExpressions.Regex(
                @"https://res\.cloudinary\.com/[^/]+/image/upload(?:/v\d+)?/(.+)$");

            foreach (var watch in watches)
            {
                var match = regex.Match(watch.Image!);
                if (match.Success)
                {
                    var publicId = match.Groups[1].Value;
                    // Strip file extension if present (Cloudinary public IDs don't include extensions)
                    publicId = System.Text.RegularExpressions.Regex.Replace(publicId, @"\.\w+$", "");

                    changes.Add(new
                    {
                        WatchId = watch.Id,
                        WatchName = watch.Name,
                        OldImage = watch.Image,
                        NewImage = publicId
                    });

                    if (!dryRun)
                    {
                        watch.Image = publicId;
                    }
                }
            }

            if (!dryRun)
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Migrated {Count} watch images from full URLs to public IDs", changes.Count);
            }

            return Ok(new
            {
                DryRun = dryRun,
                Message = dryRun ? "Preview only — pass ?dryRun=false to apply" : "Migration applied successfully",
                Count = changes.Count,
                Changes = changes
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error migrating image URLs");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Finds and optionally deletes Cloudinary assets in the "watches/" folder
    /// that have no matching Watch.Image in the database (orphaned images).
    /// DELETE: api/admin/cloudinary-orphans?dryRun=true
    /// Use dryRun=true (default) to preview, dryRun=false to permanently delete
    [HttpDelete("cloudinary-orphans")]
    public async Task<IActionResult> CleanCloudinaryOrphans([FromQuery] bool dryRun = true)
    {
        try
        {
            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();

            // Fetch all asset public IDs in the watches folder from storage
            var cloudinaryAssets = await storageService.ListAssetsByPrefixAsync("watches/");

            // Fetch all Watch.Image values that use the watches/ prefix
            var dbImages = (await context.Watches
                .Where(w => w.Image != null && w.Image.StartsWith("watches/"))
                .Select(w => w.Image!)
                .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // Orphans: exist in storage but not referenced by any watch
            var orphans = cloudinaryAssets.Where(id => !dbImages.Contains(id)).ToList();

            int deleted = 0;
            if (!dryRun)
            {
                foreach (var orphan in orphans)
                {
                    if (await storageService.DeleteImageAsync(orphan))
                        deleted++;
                }
                _logger.LogInformation("Deleted {Count}/{Total} orphaned storage assets", deleted, orphans.Count);
            }

            return Ok(new
            {
                DryRun = dryRun,
                Message = dryRun
                    ? $"Preview only — {orphans.Count} orphan(s) found. Pass ?dryRun=false to delete."
                    : $"Deleted {deleted} of {orphans.Count} orphaned asset(s).",
                TotalCloudinaryAssets = cloudinaryAssets.Count,
                TotalDbImages = dbImages.Count,
                OrphanCount = orphans.Count,
                Orphans = orphans
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Cloudinary orphan cleanup");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Renames all watch images in Cloudinary to the canonical format:
    /// watches/{BrandAcronym}_{CollectionName}_{SanitizedWatchName}
    /// Handles full URLs (Cloudinary + external), existing public IDs, and root-level filenames.
    /// POST: api/admin/normalize-image-names?dryRun=true
    [HttpPost("normalize-image-names")]
    public async Task<IActionResult> NormalizeImageNames([FromQuery] bool dryRun = true)
    {
        try
        {
            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();

            var watches = await context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .ToListAsync();

            // Extract public ID from Cloudinary URL: skip optional version segment, capture the rest, strip extension
            var cloudinaryUrlRegex = new System.Text.RegularExpressions.Regex(
                @"https://res\.cloudinary\.com/[^/]+/image/upload(?:/v\d+)?/(.+?)(?:\.\w+)?$");

            var changes = new List<object>();
            var failures = new List<object>();
            int skipped = 0;

            foreach (var watch in watches)
            {
                if (string.IsNullOrEmpty(watch.Image))
                {
                    skipped++;
                    continue;
                }

                // Build canonical target public ID
                var collectionPart = watch.Collection != null
                    ? SanitizeSegment(watch.Collection.Name)
                    : "NoCollection";
                var target = $"watches/{GetBrandAcronym(watch.Brand.Name)}_{collectionPart}_{SanitizeWatchName(watch.Name)}";

                // Determine current Cloudinary public ID
                string? currentPublicId;
                bool isExternalUrl = false;

                if (watch.Image.StartsWith("https://res.cloudinary.com", StringComparison.OrdinalIgnoreCase))
                {
                    var match = cloudinaryUrlRegex.Match(watch.Image);
                    if (!match.Success)
                    {
                        failures.Add(new { watch.Id, watch.Name, watch.Image, Reason = "Could not parse Cloudinary URL" });
                        continue;
                    }
                    // Strip file extension from extracted public ID
                    currentPublicId = System.Text.RegularExpressions.Regex.Replace(match.Groups[1].Value, @"\.\w+$", "");
                }
                else if (watch.Image.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    // External URL (e.g. Vacheron website) — image not yet in storage
                    currentPublicId = null;
                    isExternalUrl = true;
                }
                else if (watch.Image.StartsWith("watches/", StringComparison.OrdinalIgnoreCase))
                {
                    currentPublicId = watch.Image;
                }
                else
                {
                    // Root-level filename like "PP5227G.png" — strip extension
                    currentPublicId = Path.GetFileNameWithoutExtension(watch.Image);
                }

                changes.Add(new { WatchId = watch.Id, WatchName = watch.Name, OldImage = watch.Image, NewImage = target });

                if (dryRun) continue;

                if (isExternalUrl)
                {
                    // Download from external URL and upload to storage with the target name
                    var targetWithoutFolder = target.Substring("watches/".Length);
                    var newId = await storageService.UploadImageFromUrlAsync(watch.Image, targetWithoutFolder, "watches");
                    if (!string.IsNullOrEmpty(newId))
                        watch.Image = target;
                    else
                        failures.Add(new { watch.Id, watch.Name, watch.Image, Reason = "External URL upload failed" });
                }
                else if (currentPublicId == target)
                {
                    // Public ID already correct — just normalize the DB value (may have been stored as URL)
                    watch.Image = target;
                }
                else
                {
                    var ok = await storageService.RenameAssetAsync(currentPublicId!, target);
                    if (ok)
                        watch.Image = target;
                    else
                        failures.Add(new { watch.Id, watch.Name, watch.Image, Reason = $"Storage rename failed ({currentPublicId} → {target})" });
                }
            }

            if (!dryRun)
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("NormalizeImageNames: {Updated} updated, {Skipped} skipped, {Failed} failed",
                    changes.Count - failures.Count, skipped, failures.Count);
            }

            return Ok(new
            {
                DryRun = dryRun,
                Message = dryRun
                    ? $"Preview: {changes.Count} image(s) would be renamed. Pass ?dryRun=false to apply."
                    : $"Done: {changes.Count - failures.Count} renamed, {failures.Count} failed.",
                Total = watches.Count,
                Updated = dryRun ? 0 : changes.Count - failures.Count,
                Skipped = skipped,
                Failed = failures.Count,
                Changes = changes,
                Failures = failures
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error normalizing image names");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Reverts image renames performed by NormalizeImageNames.
    /// Accepts the "changes" array from a previous normalize response as the request body.
    /// Renames Cloudinary assets back and restores DB values. DB is always restored even if Cloudinary rename fails.
    /// POST: api/admin/revert-image-names
    [HttpPost("revert-image-names")]
    public async Task<IActionResult> RevertImageNames([FromBody] List<ImageChangeDto> changes)
    {
        if (changes == null || changes.Count == 0)
            return BadRequest(new { Message = "No changes provided." });

        try
        {
            var storageService = HttpContext.RequestServices.GetRequiredService<IStorageService>();
            var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();

            // Extract public ID from Cloudinary URL: skip optional version segment, capture path, strip extension
            var cloudinaryUrlRegex = new System.Text.RegularExpressions.Regex(
                @"https://res\.cloudinary\.com/[^/]+/image/upload(?:/v\d+)?/(.+?)(?:\.\w+)?$");

            var reverted = new List<object>();
            var failures = new List<object>();

            foreach (var change in changes)
            {
                var watch = await context.Watches.FindAsync(change.WatchId);
                if (watch == null)
                {
                    failures.Add(new { change.WatchId, Reason = "Watch not found" });
                    continue;
                }

                // Attempt storage rename: newImage → original public ID derived from oldImage
                string? targetPublicId = null;

                if (change.OldImage.StartsWith("https://res.cloudinary.com", StringComparison.OrdinalIgnoreCase))
                {
                    var match = cloudinaryUrlRegex.Match(change.OldImage);
                    if (match.Success)
                        targetPublicId = System.Text.RegularExpressions.Regex.Replace(match.Groups[1].Value, @"\.\w+$", "");
                }
                else if (change.OldImage.StartsWith("watches/", StringComparison.OrdinalIgnoreCase))
                {
                    targetPublicId = change.OldImage;
                }
                else if (!change.OldImage.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    // Root-level filename like "PP5227G.png"
                    targetPublicId = Path.GetFileNameWithoutExtension(change.OldImage);
                }
                // else: external URL (e.g. VC website) — skip storage rename, just restore DB

                if (targetPublicId != null && change.NewImage.StartsWith("watches/", StringComparison.OrdinalIgnoreCase))
                {
                    var ok = await storageService.RenameAssetAsync(change.NewImage, targetPublicId);
                    if (!ok)
                        failures.Add(new { change.WatchId, change.OldImage, change.NewImage, Reason = "Storage rename failed — DB still restored" });
                }

                // Always restore the DB value
                watch.Image = change.OldImage;
                reverted.Add(new { change.WatchId, RestoredImage = change.OldImage });
            }

            await context.SaveChangesAsync();
            _logger.LogInformation("RevertImageNames: {Reverted} DB entries restored, {Failed} Cloudinary failures", reverted.Count, failures.Count);

            return Ok(new
            {
                Message = $"Reverted {reverted.Count} watch image(s). {failures.Count} Cloudinary rename failure(s) — DB values restored regardless.",
                Reverted = reverted.Count,
                CloudinaryFailures = failures.Count,
                Failures = failures
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reverting image names");
            return StatusCode(500, new { Message = ex.Message });
        }
    }

    /// Enqueues a Hangfire job to copy all watch images from Cloudinary to S3.
    /// Safe to re-run — S3 PutObject is idempotent (overwrites).
    /// POST: api/admin/migrate-to-s3
    [HttpPost("migrate-to-s3")]
    public async Task<IActionResult> MigrateImagesToS3([FromQuery] bool inline = false)
    {
        if (inline)
        {
            var job = HttpContext.RequestServices.GetRequiredService<MigrateToS3Job>();
            var result = await job.RunAsync();
            return Ok(result);
        }

        var jobId = BackgroundJob.Enqueue<MigrateToS3Job>(job => job.RunAsync());
        return Ok(new
        {
            Message = "Migration job enqueued. Use ?inline=true only for small catalogues when you need the immediate result payload.",
            JobId = jobId
        });
    }

    // Sanitizes a string for use as a Cloudinary public ID segment (collection/brand name).
    // Decomposes unicode, strips diacritics, removes all non-alphanumeric chars, capitalizes first char.
    private static string SanitizeSegment(string s)
    {
        var normalized = s.Normalize(System.Text.NormalizationForm.FormD);
        var ascii = new System.Text.StringBuilder();
        foreach (var c in normalized)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                ascii.Append(c);
        }
        var result = System.Text.RegularExpressions.Regex.Replace(ascii.ToString(), @"[^a-zA-Z0-9]", "");
        if (result.Length > 0 && char.IsLower(result[0]))
            result = char.ToUpper(result[0]) + result.Substring(1);
        return result;
    }

    // Sanitizes a watch name for the public ID ref segment. Keeps hyphens, removes everything else non-alphanumeric.
    private static string SanitizeWatchName(string s)
    {
        var normalized = s.Normalize(System.Text.NormalizationForm.FormD);
        var ascii = new System.Text.StringBuilder();
        foreach (var c in normalized)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                ascii.Append(c);
        }
        return System.Text.RegularExpressions.Regex.Replace(ascii.ToString(), @"[^a-zA-Z0-9\-]", "");
    }

    // Returns the short brand acronym for Cloudinary public ID prefixes.
    private static string GetBrandAcronym(string brandName) => brandName switch
    {
        "Patek Philippe"       => "PP",
        "Vacheron Constantin"  => "VC",
        "Audemars Piguet"      => "AP",
        "Jaeger-LeCoultre"     => "JLC",
        "A. Lange & Söhne"     => "ALS",
        "Glashütte Original"   => "GO",
        "F.P.Journe"           => "FPJ",
        "Greubel Forsey"       => "GF",
        "Grand Seiko"          => "GS",
        "Frederique Constant"  => "FC",
        // Full name brands
        _ => SanitizeSegment(brandName)
    };

    private object? GetSpecsTemplate(int? collectionId)
    {
        if (!collectionId.HasValue) return null;

        return collectionId.Value switch
        {
            10 => new { dial = new { color = "Blue", finish = "Grande Tapisserie", indices = "White gold applied hour-markers", hands = "Royal Oak hands" }, @case = new { material = "Stainless Steel", diameter = "41 mm", thickness = "10.5 mm", waterResistance = "50 m", crystal = "Glareproofed sapphire", caseBack = "Sapphire" }, movement = new { caliber = "4302", type = "Selfwinding", powerReserve = "70 hours", frequency = "28,800 vph", jewels = 32, functions = new[] { "Hours", "Minutes", "Seconds", "Date" } }, strap = new { material = "Stainless steel bracelet", color = "Steel", buckle = "AP folding clasp" } },
            11 => new { dial = new { color = "Black", finish = "Méga Tapisserie", indices = "Applied Arabic numerals", hands = "Royal Oak hands" }, @case = new { material = "Titanium / Ceramic", diameter = "43 mm", thickness = "14.4 mm", waterResistance = "100 m", crystal = "Glareproofed sapphire", caseBack = "Sapphire" }, movement = new { caliber = "4401", type = "Selfwinding Chronograph", powerReserve = "70 hours", frequency = "28,800 vph", jewels = 40, functions = new[] { "Chronograph", "Hours", "Minutes", "Seconds", "Date" } }, strap = new { material = "Rubber", color = "Black", buckle = "Titanium pin buckle" } },
            12 => new { dial = new { color = "Openworked", finish = "Sandblasted", indices = "White gold applied", hands = "Royal Oak hands" }, @case = new { material = "Titanium", diameter = "44 mm", thickness = "16.1 mm", waterResistance = "100 m", crystal = "Glareproofed sapphire", caseBack = "Sapphire" }, movement = new { caliber = "2954", type = "Manual-winding", powerReserve = "237 hours", frequency = "21,600 vph", jewels = 24, functions = new[] { "Flying tourbillon", "GMT 24h", "Hours", "Minutes" } }, strap = new { material = "Rubber", color = "Black", buckle = "Titanium AP folding clasp" } },
            13 => new { dial = new { color = "Silvered grey", finish = "Guilloché", indices = "Black transferred numerals", hands = "Bâton" }, @case = new { material = "Stainless Steel", diameter = "45.6 x 27.4 mm", thickness = "8.5 mm", waterResistance = "30 m", crystal = "Sapphire", caseBack = "Solid" }, movement = new { caliber = "822/2", type = "Manual-winding", powerReserve = "42 hours", frequency = "21,600 vph", jewels = 19, functions = new[] { "Hours", "Minutes" } }, strap = new { material = "Alligator leather", color = "Black", buckle = "Folding clasp" } },
            14 => new { dial = new { color = "Silvered grey", finish = "Sunray-brushed", indices = "Applied", hands = "Dauphine" }, @case = new { material = "Pink Gold", diameter = "39 mm", thickness = "9.3 mm", waterResistance = "50 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "925", type = "Automatic", powerReserve = "70 hours", frequency = "28,800 vph", jewels = 30, functions = new[] { "Hours", "Minutes", "Seconds", "Moon phases", "Date" } }, strap = new { material = "Alligator leather", color = "Brown", buckle = "Pin buckle" } },
            15 => new { dial = new { color = "Ocean blue", finish = "Sunray", indices = "Applied trapezoid", hands = "Bâton" }, @case = new { material = "Stainless Steel", diameter = "42 mm", thickness = "13.92 mm", waterResistance = "200 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "899", type = "Automatic", powerReserve = "70 hours", frequency = "28,800 vph", jewels = 32, functions = new[] { "Hours", "Minutes", "Seconds", "Date" } }, strap = new { material = "Rubber", color = "Blue", buckle = "Folding clasp" } },
            16 => new { dial = new { color = "Silvered", finish = "Grained", indices = "Applied Arabic numerals", hands = "Leaf" }, @case = new { material = "18k Rose Gold", diameter = "40.5 mm", thickness = "13 mm", waterResistance = "50 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "381", type = "Manual-winding", powerReserve = "50 hours", frequency = "21,600 vph", jewels = 40, functions = new[] { "Hours", "Minutes", "Seconds", "Moon phases" } }, strap = new { material = "Alligator leather", color = "Dark Brown", buckle = "Folding clasp" } },
            17 => new { dial = new { color = "Solid silver", finish = "Argenté", indices = "Gold appliques", hands = "Pink gold" }, @case = new { material = "18-carat Pink Gold", diameter = "38.5 mm", thickness = "9.8 mm", waterResistance = "30 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "L121.1", type = "Manual winding", powerReserve = "72 hours", frequency = "21,600 vph", jewels = 43, functions = new[] { "Hours", "Minutes", "Seconds", "Outsize date", "Power reserve" } }, strap = new { material = "Alligator leather", color = "Reddish-brown", buckle = "Prong buckle" } },
            18 => new { dial = new { color = "Solid silver", finish = "Black", indices = "Time bridge", hands = "Straight" }, @case = new { material = "18-carat White Gold", diameter = "41.9 mm", thickness = "12.6 mm", waterResistance = "30 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "L043.1", type = "Manual winding", powerReserve = "36 hours", frequency = "18,000 vph", jewels = 68, functions = new[] { "Jumping hours/minutes", "Seconds", "Power reserve" } }, strap = new { material = "Alligator leather", color = "Black", buckle = "Prong buckle" } },
            19 => new { dial = new { color = "Solid silver", finish = "Black", indices = "Rhodiumed gold", hands = "Luminous" }, @case = new { material = "Platinum", diameter = "41.0 mm", thickness = "13.1 mm", waterResistance = "30 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "L951.6", type = "Manual winding", powerReserve = "60 hours", frequency = "18,000 vph", jewels = 46, functions = new[] { "Chronograph", "Hours", "Minutes", "Seconds", "Date" } }, strap = new { material = "Alligator leather", color = "Black", buckle = "Plat. buckle" } },
            20 => new { dial = new { color = "Solid silver", finish = "Argenté", indices = "Gold batons", hands = "Pink gold" }, @case = new { material = "18-carat Pink Gold", diameter = "35.0 mm", thickness = "7.3 mm", waterResistance = "30 m", crystal = "Sapphire", caseBack = "Sapphire" }, movement = new { caliber = "L941.1", type = "Manual winding", powerReserve = "45 hours", frequency = "21,600 vph", jewels = 21, functions = new[] { "Hours", "Minutes", "Seconds" } }, strap = new { material = "Alligator leather", color = "Dark brown", buckle = "Prong buckle" } },
            _ => null
        };
    }

    // ── Embedding endpoints ────────────────────────────────────────────────────

    /// Generates embeddings for all watches that don't yet have a "full" chunk.
    /// POST: api/admin/embeddings/generate
    [HttpPost("embeddings/generate")]
    public async Task<IActionResult> GenerateEmbeddings()
    {
        _logger.LogInformation("Admin: bulk embedding generation requested");
        var generated = await _embeddingService.GenerateMissingAsync();
        var (total, embedded, pct) = await _embeddingService.GetStatusAsync();
        return Ok(new { generated, total, embedded, coveragePct = pct });
    }

    /// Deletes all watch_finder embeddings and regenerates with current chunk logic.
    /// Use after changing InferCategory, InferOccasions, or BuildChunks.
    /// POST: api/admin/embeddings/regenerate
    [HttpPost("embeddings/regenerate")]
    public async Task<IActionResult> RegenerateEmbeddings()
    {
        _logger.LogInformation("Admin: full embedding regeneration requested");
        var regenerated = await _embeddingService.RegenerateAllAsync();
        var (total, embedded, pct) = await _embeddingService.GetStatusAsync();
        return Ok(new { regenerated, total, embedded, coveragePct = pct });
    }

    /// Returns current embedding coverage stats.
    /// GET: api/admin/embeddings/status
    [HttpGet("embeddings/status")]
    public async Task<IActionResult> GetEmbeddingStatus()
    {
        var (total, embedded, pct) = await _embeddingService.GetStatusAsync();
        return Ok(new { total, embedded, coveragePct = pct });
    }

    // ── Query cache endpoints ──────────────────────────────────────────────────

    // Brand/spec/price queries scoped to the Watch Finder feature.
    // Occasion and lifestyle queries belong to Phase 5 RAG chatbot — see phase5-rag-chatbot.md.
    private static readonly string[] _seedQueries =
    [
        // Brand + collection
        "Patek Philippe Calatrava white gold",
        "Patek Philippe Nautilus steel 40mm",
        "Patek Philippe Aquanaut rubber strap",
        "Vacheron Constantin Patrimony ultra thin",
        "Vacheron Constantin Overseas steel 41mm",
        "Vacheron dress watch 39-40mm",
        "AP Royal Oak steel 41mm",
        "AP Royal Oak Offshore chronograph",
        "JLC Reverso classic manual winding",
        "JLC Reverso under 50k",
        "JLC Master Ultra Thin",
        "JLC Polaris sport watch",
        "A. Lange Söhne Lange 1 gold",
        "A. Lange Söhne Saxonia thin",
        "A. Lange Söhne Datograph chronograph",
        "A. Lange Söhne under 80k",
        "Glashütte Original Senator panorama date",
        "Glashütte Original PanoMatic Lunar",
        "Breguet Classique manual winding",
        "Breguet Marine chronograph",
        "Omega Speedmaster Moonwatch manual",
        "Omega Seamaster 300m steel",
        "Rolex Submariner steel no date",
        "Rolex Daytona chronograph steel",
        "Rolex GMT-Master II ceramic bezel",
        "Rolex Day-Date yellow gold",
        "Grand Seiko Snowflake Spring Drive",
        "Grand Seiko high beat steel",
        "FP Journe independent watchmaker",
        "Greubel Forsey double tourbillon",

        // Price range
        "sport watch under 100k",
        "dress watch under 20k",
        "watch under 10k",
        "luxury watch under 5k",
        "watch between 20k and 50k",
        "watch over 100k",
        "watch under 50k automatic",

        // Specs
        "ultra thin watch under 8mm",
        "watch under 36mm diameter",
        "steel integrated bracelet sport watch",
        "white gold dress watch manual winding",
        "rose gold dress watch",
        "titanium lightweight sport watch",
        "tourbillon complication luxury",
        "perpetual calendar watch",
        "minute repeater chiming watch",
        "flyback chronograph",
        "GMT dual timezone traveler watch",
        "moonphase complication dress watch",
        "annual calendar complication",
        "skeleton movement open dial",
        "guilloché enamel dial",
        "power reserve indicator display",
        "exhibition caseback open movement",
        "large date panorama display",

        // Brand + spec combination
        "thin automatic dress watch under 25k",
        "steel sport watch with date under 30k",
        "German watch precision under 50k",
        "slim gold dress watch Patek or Lange",
        "integrated bracelet sport watch under 50k",
        "Vacheron Patrimony 40mm white gold",
        "AP Royal Oak 37mm steel",

        // Complications + brand
        "Patek Philippe perpetual calendar",
        "Vacheron Constantin moonphase",
        "JLC Reverso Duo",
        "JLC Reverso classic small",
        "A. Lange Söhne perpetual calendar",
        "Breguet moonphase Classique",
        "Patek Philippe annual calendar",
        "Omega Speedmaster professional",
        "Rolex Day-Date platinum",
        "Grand Seiko Spring Drive GMT",
        "FP Journe Chronometre Bleu",
        "AP Royal Oak perpetual calendar",
        "Vacheron Traditionnelle minute repeater",
        "Glashütte Original PanoMaticLunar",
        "thin dress watch white gold under 50k",
        "sport watch steel bracelet under 30k",

        // Case material
        "steel automatic watch 40mm",
        "steel watch 38mm dress",
        "steel watch 42mm sport chronograph",
        "titanium automatic watch 42mm",
        "titanium lightweight sport watch under 30k",
        "gold dress watch 38mm manual winding",
        "gold automatic watch 40mm",
        "platinum dress watch under 100k",
        "ceramic bezel sport watch steel",
        "carbon composite case watch",

        // Diameter — specific sizes
        "dress watch 36mm steel",
        "dress watch 37mm gold manual",
        "automatic watch 38mm steel",
        "sport watch 42mm titanium",
        "watch 43mm automatic chronograph",
        "small dress watch under 34mm",

        // Water resistance buckets
        "dress watch water resistant 30m",
        "everyday watch 100m water resistant automatic",
        "sport watch 150m water resistant steel",
        "dive watch 300m automatic steel",
        "professional dive watch 600m",

        // Movement × material
        "automatic steel dress watch under 20k",
        "manual winding gold dress watch",
        "self-winding platinum watch",
        "Spring Drive automatic steel Grand Seiko",

        // Style / occasion descriptors
        "dress watch",
        "sport watch",
        "chronograph",
        "diver watch",
        "everyday watch",
        "formal watch for black tie",
        "casual everyday steel watch",
        "wedding day watch gold",
        "business professional watch",
        "minimalist clean dial watch",
        "elegant thin watch for suit",
        "rugged outdoor sport watch",
        "pilot aviation watch",
        "racing chronograph watch",
        "weekend casual watch leather strap",

        // Material standalone
        "steel watch",
        "gold watch",
        "rose gold watch",
        "white gold watch",
        "yellow gold watch",
        "titanium watch",
        "platinum watch",
        "ceramic watch",

        // Material × category cross
        "steel chronograph",
        "steel diver",
        "steel dress watch",
        "gold chronograph",
        "gold diver",
        "titanium diver",
        "titanium chronograph",
        "titanium sport watch",
        "platinum chronograph",
        "ceramic sport watch",
        "rose gold dress watch 38mm",
        "white gold chronograph under 80k",

        // Movement standalone + cross
        "automatic watch",
        "manual winding watch",
        "quartz watch",
        "automatic chronograph",
        "automatic diver",
        "automatic dress watch",
        "manual winding dress watch",
        "automatic sport watch steel",

        // Water resistance × material/category
        "300m water resistance steel",
        "200m diver automatic",
        "100m water resistant everyday watch",
        "300m steel diver under 20k",
        "steel diver 300m automatic",

        // Dial color
        "blue dial dress watch",
        "black dial sport watch steel",
        "white dial dress watch gold",
        "salmon dial watch",
        "green dial watch",
        "silver dial automatic watch",

        // Size-focused
        "small watch for thin wrist",
        "large sport watch 44mm",
        "medium size watch 40mm automatic",
        "compact dress watch 35-37mm",
        "oversized chronograph 44mm steel",

        // Natural language / conversational
        "best dress watch for a wedding",
        "affordable luxury watch under 15k",
        "luxury everyday wear watch",
        "gift for watch collector",
        "first luxury watch recommendation",
        "investment grade watch",
        "good travel watch with GMT",
        "watch with moonphase and date",
        "simple time-only dress watch",
        "complicated watch with multiple functions",
        "iconic luxury sport watch",
        "best value steel automatic",
        "hand wound movement watch",
        "watch with exhibition caseback",
        "slim profile dress watch under 9mm thick",

        // Brand-style combos not yet covered
        "Omega dress watch De Ville",
        "Rolex Datejust 36 steel",
        "Rolex Submariner ceramic",
        "Grand Seiko dress watch",
        "Breguet Tradition open-worked",
        "Patek Philippe complications",
        "JLC automatic dress watch",
        "Lange Zeitwerk digital display",
        "Vacheron Overseas diver",
        "AP Royal Oak selfwinding",

        // Price × category combos
        "chronograph under 15k",
        "diver under 10k",
        "dress watch under 30k",
        "sport watch under 20k",
        "gold watch under 50k",
        "tourbillon under 200k",
        "watch between 5k and 15k",
        "watch between 10k and 30k automatic",
    ];

    /// Runs the seed query list through the full finder pipeline, caching each result.
    /// POST: api/admin/query-cache/seed
    [HttpPost("query-cache/seed")]
    public async Task<IActionResult> SeedQueryCache()
    {
        _logger.LogInformation("Admin: query cache seeding started ({Count} queries)", _seedQueries.Length);
        int seeded = 0, skipped = 0;

        foreach (var query in _seedQueries)
        {
            try
            {
                // FindWatchesAsync embeds the query, checks cache, runs pipeline if miss,
                // then stores the result — all in one call.
                await _watchFinderService.FindWatchesAsync(query);
                seeded++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Seed query failed '{Query}': {Err}", query, ex.Message);
                skipped++;
            }
        }

        var cached = await _queryCache.GetCountAsync();
        _logger.LogInformation("Query cache seeding complete: {Cached} entries", cached);
        return Ok(new { seeded, skipped, cached, total = _seedQueries.Length });
    }

    /// Returns query cache stats broken down by feature.
    /// GET: api/admin/query-cache/status
    [HttpGet("query-cache/status")]
    public async Task<IActionResult> GetQueryCacheStatus()
    {
        var total       = await _queryCache.GetCountAsync();
        var watchFinder = await _queryCache.GetCountAsync("watch_finder");
        var ragChat     = await _queryCache.GetCountAsync("rag_chat");
        return Ok(new { total, watch_finder = watchFinder, rag_chat = ragChat });
    }

    /// Clears all cached query results. Use after major catalog changes.
    /// DELETE: api/admin/query-cache
    [HttpDelete("query-cache")]
    public async Task<IActionResult> ClearQueryCache()
    {
        await _queryCache.ClearAsync();
        return Ok(new { message = "Query cache cleared." });
    }

    // ── Editorial endpoints ────────────────────────────────────────────────────

    /// Generates editorial story content for all collections and links all watches.
    /// Run once offline with gemma2:9b before deploy, then pg_dump the editorial tables.
    /// AllowAnonymous: local-only seeding tool, no sensitive data involved.
    /// Enqueues a durable Hangfire job — progress visible at /hangfire dashboard.
    /// POST: api/admin/editorial/seed
    [AllowAnonymous]
    [HttpPost("editorial/seed")]
    public IActionResult SeedEditorial()
    {
        _logger.LogInformation("Admin: editorial seeding enqueued");
        BackgroundJob.Enqueue<WatchEditorialService>(x => x.SeedAllAsync());
        return Accepted(new { Message = "Seeding enqueued. Monitor progress at /hangfire dashboard." });
    }

    /// Returns editorial coverage stats.
    /// GET: api/admin/editorial/status
    [AllowAnonymous]
    [HttpGet("editorial/status")]
    public async Task<IActionResult> GetEditorialStatus()
    {
        var (total, withEditorial, pct) = await _editorialService.GetStatusAsync();
        return Ok(new { Total = total, WithEditorial = withEditorial, CoveragePct = pct });
    }

    /// Deletes all editorial content and links. Use before re-seeding with a different model.
    /// DELETE: api/admin/editorial
    [AllowAnonymous]
    [HttpDelete("editorial")]
    public async Task<IActionResult> ClearEditorial()
    {
        var deleted = await _editorialService.ClearAllAsync();
        return Ok(new { Success = true, Deleted = deleted });
    }

    // ── Collection style tagging ───────────────────────────────────────────────

    /// One-time AI-assisted classification of collection styles (dress / sport / diver).
    /// Run once after DB seeding; new collections should be tagged when created via admin UI.
    /// Pass ?overwrite=true to re-classify already-tagged collections.
    /// POST: api/admin/collections/tag-styles
    [AllowAnonymous]
    [HttpPost("collections/tag-styles")]
    public async Task<IActionResult> TagCollectionStyles([FromQuery] bool overwrite = false)
    {
        var db          = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
        var httpFactory = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();
        var httpClient  = httpFactory.CreateClient("ai-service");

        var collections = await db.Collections
            .Include(c => c.Brand)
            .Where(c => overwrite || c.Styles.Length == 0)
            .ToListAsync();

        if (collections.Count == 0)
            return Ok(new { message = "All collections already tagged.", tagged = 0, skipped = 0 });

        _logger.LogInformation("Admin: classifying styles for {Count} collections", collections.Count);

        var payload = collections.Select(c => new
        {
            id          = c.Id,
            name        = c.Name,
            brand       = c.Brand?.Name ?? "",
            description = c.Description ?? ""
        });

        var response = await httpClient.PostAsJsonAsync("/collections/classify-styles", new { collections = payload });
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            _logger.LogError("AI service style classification failed: {Body}", body);
            return StatusCode(502, new { error = "AI service classification failed.", detail = body });
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        if (!json.TryGetProperty("results", out var results))
            return StatusCode(502, new { error = "Unexpected AI service response format." });

        int tagged = 0, nulled = 0;
        foreach (var item in results.EnumerateArray())
        {
            if (!item.TryGetProperty("id", out var idEl)) continue;
            var col = collections.FirstOrDefault(c => c.Id == idEl.GetInt32());
            if (col == null) continue;

            // Accept either a single string or an array of styles from the AI
            string[] styles = [];
            if (item.TryGetProperty("styles", out var stylesEl) && stylesEl.ValueKind == JsonValueKind.Array)
                styles = stylesEl.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => e.GetString()!.ToLowerInvariant())
                    .ToArray();
            else if (item.TryGetProperty("style", out var styleEl) && styleEl.ValueKind == JsonValueKind.String)
            {
                var s = styleEl.GetString()?.ToLowerInvariant();
                if (s != null) styles = [s];
            }

            col.Styles = styles;
            if (styles.Length > 0) tagged++; else nulled++;
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Admin: collection styles saved — tagged={Tagged} null={Nulled}", tagged, nulled);
        return Ok(new { tagged, nulled, total = collections.Count });
    }

    /// Returns style tag coverage across all collections.
    /// GET: api/admin/collections/style-status
    [AllowAnonymous]
    [HttpGet("collections/style-status")]
    public async Task<IActionResult> GetCollectionStyleStatus()
    {
        var db       = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
        var all      = await db.Collections.Include(c => c.Brand).AsNoTracking().ToListAsync();
        var tagged   = all.Where(c => c.Styles.Length > 0).ToList();
        var untagged = all.Where(c => c.Styles.Length == 0).ToList();
        return Ok(new
        {
            total    = all.Count,
            tagged   = tagged.Count,
            untagged = untagged.Count,
            // Count per style tag — multi-style collections contribute to each tag's count
            breakdown = tagged
                .SelectMany(c => c.Styles)
                .GroupBy(s => s)
                .ToDictionary(g => g.Key, g => g.Count()),
            untaggedCollections = untagged.Select(c => new { c.Id, c.Name, brand = c.Brand?.Name })
        });
    }

    /// Updates the editorial content linked to a specific watch.
    /// Because editorial is shared per-collection, this affects all watches in the same collection.
    /// PUT: api/admin/editorial/{watchId}
    [AllowAnonymous]
    [HttpPut("editorial/{watchId:int}")]
    public async Task<IActionResult> UpdateEditorial(int watchId, [FromBody] UpdateEditorialDto dto)
    {
        var context = HttpContext.RequestServices.GetRequiredService<TourbillonContext>();
        var link = await context.Set<WatchEditorialLink>()
            .Include(l => l.EditorialContent)
            .FirstOrDefaultAsync(l => l.WatchId == watchId);

        if (link == null)
            return NotFound(new { Message = $"No editorial found for watch {watchId}" });

        link.EditorialContent.WhyItMatters    = dto.WhyItMatters;
        link.EditorialContent.CollectorAppeal = dto.CollectorAppeal;
        link.EditorialContent.DesignLanguage  = dto.DesignLanguage;
        link.EditorialContent.BestFor         = dto.BestFor;

        await context.SaveChangesAsync();
        return Ok(new { Success = true });
    }

}

public class UpdateEditorialDto
{
    public string WhyItMatters    { get; set; } = "";
    public string CollectorAppeal { get; set; } = "";
    public string DesignLanguage  { get; set; } = "";
    public string BestFor         { get; set; } = "";
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
