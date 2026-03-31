// Manages individual watch products (specific models customers can buy).

using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using backend.Database;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WatchController : ControllerBase
{
    private readonly TourbillonContext _context;
    private readonly WatchFinderService _watchFinderService;
    private readonly IHttpClientFactory _httpClientFactory;

    public WatchController(TourbillonContext context, WatchFinderService watchFinderService, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _watchFinderService = watchFinderService;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("find")]
    public async Task<IActionResult> FindWatches([FromBody] WatchFinderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return BadRequest(new { error = "Query is required" });

        var result = await _watchFinderService.FindWatchesAsync(request.Query);
        return Ok(result);
    }

    // On-demand explanation for a single watch — called when user clicks "Why this?" in Smart Search
    [HttpPost("explain")]
    public async Task<IActionResult> ExplainWatch([FromBody] ExplainWatchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Query) || request.WatchId <= 0)
            return BadRequest(new { error = "query and watchId are required" });

        var watch = await _context.Watches.Include(w => w.Brand).AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == request.WatchId);
        if (watch == null) return NotFound();

        var specs = DeserialiseSpecs(watch.Specs);
        var payload = new
        {
            query = request.Query,
            watch = new
            {
                id = watch.Id,
                name = watch.Name,
                brand = watch.Brand?.Name ?? "",
                description = watch.Description ?? "",
                price = (double)watch.CurrentPrice,
                specs_summary = BuildSpecsSummary(specs)
            }
        };

        var httpClient = _httpClientFactory.CreateClient("ai-service");
        try
        {
            var resp = await httpClient.PostAsJsonAsync("/watch-finder/explain", payload);
            if (!resp.IsSuccessStatusCode)
                return StatusCode((int)resp.StatusCode, new { error = "AI service error" });

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            return Ok(json);
        }
        catch
        {
            return StatusCode(503, new { error = "AI service unavailable" });
        }
    }

    // Returns distinct spec values from the full catalog — used to populate Smart Search filter dropdowns
    [HttpGet("filter-options")]
    public IActionResult GetFilterOptions()
    {
        var watches = _context.Watches.AsNoTracking().ToList();
        var specsList = watches
            .Select(w => DeserialiseSpecs(w.Specs))
            .Where(s => s != null)
            .Select(s => s!)
            .ToList();

        static IEnumerable<string> Distinct(IEnumerable<string?> vals) =>
            vals.Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(v => v);

        var options = new
        {
            caseMaterials    = Distinct(specsList.Select(s => s.Case?.Material)).ToList(),
            movementTypes    = Distinct(specsList.Select(s => s.Movement?.Type)).ToList(),
            dialColors       = Distinct(specsList.Select(s => s.Dial?.Color)).ToList(),
            waterResistance  = Distinct(specsList.Select(s => s.Case?.WaterResistance)).ToList(),
            powerReserve     = Distinct(specsList.Select(s => s.Movement?.PowerReserve)).ToList(),
            complications    = specsList
                .SelectMany(s => s.Movement?.Functions ?? [])
                .Where(f => !string.IsNullOrWhiteSpace(f))
                .Select(f => f!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(f => f)
                .ToList(),
        };
        return Ok(options);
    }

    private static WatchSpecs? DeserialiseSpecs(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<WatchSpecs>(json); }
        catch { return null; }
    }

    private static string BuildSpecsSummary(WatchSpecs? specs)
    {
        if (specs == null) return "";
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(specs.Case?.Material))  parts.Add(specs.Case.Material);
        if (!string.IsNullOrEmpty(specs.Case?.Diameter))  parts.Add(specs.Case.Diameter);
        if (!string.IsNullOrEmpty(specs.Case?.Thickness)) parts.Add($"{specs.Case.Thickness} thick");
        if (!string.IsNullOrEmpty(specs.Movement?.Type))  parts.Add(specs.Movement.Type);
        if (!string.IsNullOrEmpty(specs.Dial?.Color))     parts.Add($"{specs.Dial.Color} dial");
        if (!string.IsNullOrEmpty(specs.Strap?.Material)) parts.Add(specs.Strap.Material);
        return string.Join(", ", parts);
    }

    [HttpGet]
    public IActionResult GetAllWatches()
    {
        var watches = _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    // Slug-based detail — primary public endpoint
    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> GetWatchBySlug(string slug)
    {
        var watch = await _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .Include(w => w.EditorialLink)
                .ThenInclude(l => l!.EditorialContent)
            .FirstOrDefaultAsync(w => w.Slug == slug);

        if (watch == null) return NotFound();

        var watchDto = WatchDto.FromWatch(watch, editorial: watch.EditorialLink?.EditorialContent);
        return Ok(watchDto);
    }

    // Numeric ID detail — kept for admin/internal use
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetWatch(int id)
    {
        var watch = await _context.Watches
            .Include(w => w.EditorialLink)
                .ThenInclude(l => l!.EditorialContent)
            .FirstOrDefaultAsync(w => w.Id == id);

        if (watch == null) return NotFound();

        var watchDto = WatchDto.FromWatch(watch, editorial: watch.EditorialLink?.EditorialContent);
        return Ok(watchDto);
    }

    // Slug-based collection filter — primary public endpoint
    [HttpGet("collection/by-slug/{slug}")]
    public IActionResult GetByCollectionSlug(string slug)
    {
        var collection = _context.Collections.FirstOrDefault(c => c.Slug == slug);
        if (collection == null) return NotFound();

        var watches = _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .Where(w => w.CollectionId == collection.Id).ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    [HttpGet("collection/{collectionId:int}")]
    public IActionResult GetByCollection(int collectionId)
    {
        var watches = _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .Where(w => w.CollectionId == collectionId).ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    // Slug-based brand filter — primary public endpoint
    [HttpGet("brand/by-slug/{slug}")]
    public IActionResult GetByBrandSlug(string slug)
    {
        var brand = _context.Brands.FirstOrDefault(b => b.Slug == slug);
        if (brand == null) return NotFound();

        var watches = _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .Where(w => w.BrandId == brand.Id).ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    [HttpGet("brand/{brandId:int}")]
    public IActionResult GetByBrand(int brandId)
    {
        var watches = _context.Watches
            .Include(w => w.Brand).Include(w => w.Collection)
            .Where(w => w.BrandId == brandId).ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    [HttpPost]
    public IActionResult CreateWatch([FromBody] Watch watch) // Creates a new watch in the database.
    {
        _context.Watches.Add(watch);
        _context.SaveChanges();
        return CreatedAtAction(nameof(GetWatch), new { id = watch.Id }, watch);
    }

    [HttpPut("{id}")]
    public IActionResult UpdateWatch(int id, [FromBody] Watch updatedWatch) // Updates an existing watch in the database.
    {
        var watch = _context.Watches.Find(id);
        if (watch == null)
        {
            return NotFound();
        }

        watch.Name = updatedWatch.Name;
        watch.Description = updatedWatch.Description;
        watch.Image = updatedWatch.Image;
        watch.CurrentPrice = updatedWatch.CurrentPrice;
        watch.BrandId = updatedWatch.BrandId;
        watch.CollectionId = updatedWatch.CollectionId;

        _context.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteWatch(int id) // Deletes a watch from the database.
    {
        var watch = _context.Watches.Find(id);
        if (watch == null)
        {
            return NotFound();
        }

        _context.Watches.Remove(watch);
        _context.SaveChanges();
        return NoContent();
    }

    [HttpDelete("brand/{brandId}/scrape-test")]
    public async Task<IActionResult> DeleteWatchesByBrandForScrapingAsync(int brandId)
    {
        try
        {
            // Showcase watch IDs to preserve (9 Holy Trinity watches)
            var showcaseWatchIds = new HashSet<int> { 1, 2, 3, 32, 33, 34, 57, 58, 59 };

            // Get watches for the brand (excluding showcase watches)
            var watchesToDelete = await _context.Watches
                .Where(w => w.BrandId == brandId && !showcaseWatchIds.Contains(w.Id))
                .ToListAsync();

            int deletedCount = watchesToDelete.Count;

            if (deletedCount == 0)
            {
                return Ok(new { message = "No watches to delete for this brand.", deletedCount = 0 });
            }

            // Delete associated price trends first (foreign key constraint)
            var watchIds = watchesToDelete.Select(w => w.Id).ToList();
            var priceTrendsToDelete = await _context.PriceTrends
                .Where(pt => watchIds.Contains(pt.WatchId))
                .ToListAsync();

            _context.PriceTrends.RemoveRange(priceTrendsToDelete);
            _context.Watches.RemoveRange(watchesToDelete);
            await _context.SaveChangesAsync();

            return Ok(new {
                message = $"Successfully deleted {deletedCount} watches for brand ID {brandId}. Ready to rescrape.",
                deletedCount
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
