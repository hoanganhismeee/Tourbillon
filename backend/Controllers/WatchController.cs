// Manages individual watch products (specific models customers can buy).

using Microsoft.AspNetCore.Mvc;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WatchController : ControllerBase
{
    private readonly TourbillonContext _context;

    public WatchController(TourbillonContext context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult GetAllWatches()
    {
        var watches = _context.Watches.ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    [HttpGet("{id}")]
    public IActionResult GetWatch(int id) // Return a specific watch from database from id
    {
        var watch = _context.Watches.Find(id);
        if (watch == null) return NotFound();

        var watchDto = WatchDto.FromWatch(watch);
        return Ok(watchDto);
    }

    [HttpGet("collection/{collectionId}")]
    public IActionResult GetByCollection(int collectionId) // Returns all watches from a specific collection by its collection ID.
    {
        var watches = _context.Watches.Where(w => w.CollectionId == collectionId).ToList();
        var watchDtos = watches.Select(w => WatchDto.FromWatch(w)).ToList();
        return Ok(watchDtos);
    }

    [HttpGet("brand/{brandId}")]
    public IActionResult GetByBrand(int brandId) // Returns all watches for a specific brand by its brand ID.
    {
        var watches = _context.Watches.Where(w => w.BrandId == brandId).ToList();
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
            var showcaseWatchIds = new HashSet<int> { 2, 4, 11, 13, 18, 24, 28, 30, 35 };

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
