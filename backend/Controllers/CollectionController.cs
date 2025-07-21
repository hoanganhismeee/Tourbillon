// Manage collection within each brands

using Microsoft.AspNetCore.Mvc;
using backend.Database;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CollectionController : ControllerBase
{
    private readonly TourbillonContext _context;

    public CollectionController(TourbillonContext context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult GetCollections() => Ok(_context.Collections.ToList()); // Return all collection from database

    [HttpGet("{id}")]
    public IActionResult GetCollection(int id) // Return a specific collection from database from id
    {
        var collection = _context.Collections.Find(id);
        return collection == null ? NotFound() : Ok(collection);
    }
}
