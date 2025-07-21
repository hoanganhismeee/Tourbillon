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
    public IActionResult GetByCollection(int collectionId) // Return all watch from a specific collection from database from collectionId
    {
        var watches = _context.Watches.Where(w => w.CollectionId == collectionId).ToList();
        return Ok(watches);
    }
}
