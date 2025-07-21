// Manages individual watch products (specific models customers can buy).

using Microsoft.AspNetCore.Mvc;
using backend.Database;
using backend.Models;

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
    public IActionResult GetAllWatches() => Ok(_context.Watches.ToList()); // Return all watch from database

    [HttpGet("{id}")]
    public IActionResult GetWatch(int id) // Return a specific watch from database from id
    {
        var watch = _context.Watches.Find(id);
        return watch == null ? NotFound() : Ok(watch);
    }

    [HttpGet("collection/{collectionId}")]
    public IActionResult GetByCollection(int collectionId) // Returns all watches from a specific collection by its collection ID.
    {
        var watches = _context.Watches.Where(w => w.CollectionId == collectionId).ToList();
        return Ok(watches);
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
}
