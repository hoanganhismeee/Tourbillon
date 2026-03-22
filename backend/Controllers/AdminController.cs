// Admin controller for watch data management
// Provides endpoints for scraping and data management from official brand websites

using backend.Database;
using backend.DTOs;
using backend.Models;
using backend.Services;
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
            var externalImages = allWatches.Where(w => w.Image.StartsWith("http")).Select(w => w.Id).ToList();
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
            var watches = await context.Watches
                .OrderBy(w => w.Id)
                .Select(w => new
                {
                    w.Id,
                    w.Name,
                    w.CurrentPrice,
                    w.Image,
                    w.BrandId,
                    w.CollectionId
                })
                .ToListAsync();

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
            var watch = await context.Watches.FindAsync(id);

            if (watch == null) return NotFound(new { Message = "Watch not found" });

            return Ok(watch);
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

            var brandExists = await context.Brands.AnyAsync(b => b.Id == dto.BrandId);
            if (!brandExists)
                return BadRequest(new { Message = "Brand not found" });

            if (dto.CollectionId.HasValue)
            {
                var collectionExists = await context.Collections.AnyAsync(c => c.Id == dto.CollectionId.Value && c.BrandId == dto.BrandId);
                if (!collectionExists)
                    return BadRequest(new { Message = "Collection does not exist for this brand" });
            }

            if (!string.IsNullOrEmpty(dto.Specs))
            {
                try { JsonDocument.Parse(dto.Specs); }
                catch { return BadRequest(new { Message = "Invalid Specs JSON format" }); }
            }

            var watch = new Watch
            {
                Name = dto.Name,
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

    /// Uploads an image to Cloudinary and returns the public ID
    /// POST: api/admin/watches/upload-image
    [HttpPost("watches/upload-image")]
    public async Task<IActionResult> AdminUploadImage(IFormFile file, [FromForm] string? slug = null)
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

            using var stream = file.OpenReadStream();
            
            // Use slug if provided, otherwise use original filename
            string filenameToUse = !string.IsNullOrEmpty(slug) ? $"{slug}{ext}" : file.FileName;
            
            string publicId = await cloudinaryService.UploadImageAsync(stream, filenameToUse);

            if (string.IsNullOrEmpty(publicId))
                return StatusCode(500, new { Message = "Failed to upload image to Cloudinary" });

            return Ok(new { 
                Success = true, 
                PublicId = publicId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image");
            return StatusCode(500, new { Message = ex.Message });
        }
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
    /// POST: api/admin/editorial/seed
    [AllowAnonymous]
    [HttpPost("editorial/seed")]
    public async Task<IActionResult> SeedEditorial()
    {
        _logger.LogInformation("Admin: editorial seeding started");
        try
        {
            var (seeded, linked, skipped) = await _editorialService.SeedAllAsync();
            return Ok(new
            {
                Success = true,
                Seeded = seeded,
                Linked = linked,
                Skipped = skipped,
                Timestamp = DateTime.UtcNow,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Editorial seeding failed");
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    /// Returns editorial coverage stats.
    /// GET: api/admin/editorial/status
    [HttpGet("editorial/status")]
    public async Task<IActionResult> GetEditorialStatus()
    {
        var (total, withEditorial, pct) = await _editorialService.GetStatusAsync();
        return Ok(new { Total = total, WithEditorial = withEditorial, CoveragePct = pct });
    }

    /// Deletes all editorial content and links. Use before re-seeding with a different model.
    /// DELETE: api/admin/editorial
    [HttpDelete("editorial")]
    public async Task<IActionResult> ClearEditorial()
    {
        var deleted = await _editorialService.ClearAllAsync();
        return Ok(new { Success = true, Deleted = deleted });
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
