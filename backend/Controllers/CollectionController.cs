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
    public IActionResult GetCollection(int id) // Returns a specific collection from the database by its ID.
    {
        var collection = _context.Collections.Find(id);
        return collection == null ? NotFound() : Ok(collection);
    }

    [HttpGet("brand/{brandId}")]
    public IActionResult GetCollectionsByBrand(int brandId)
    {
        var collections = _context.Collections.Where(c => c.BrandId == brandId).ToList();
        return Ok(collections);
    }

    [HttpPost]
    public IActionResult CreateCollection([FromBody] Collection collection) // Creates a new collection in the database.
    {
        _context.Collections.Add(collection);
        _context.SaveChanges();
        return CreatedAtAction(nameof(GetCollection), new { id = collection.Id }, collection);
    }

    [HttpPut("{id}")]
    public IActionResult UpdateCollection(int id, [FromBody] Collection updatedCollection) // Updates an existing collection in the database.
    {
        var collection = _context.Collections.Find(id);
        if (collection == null)
        {
            return NotFound();
        }

        collection.Name = updatedCollection.Name;
        collection.Description = updatedCollection.Description;
        collection.Image = updatedCollection.Image;
        collection.BrandId = updatedCollection.BrandId;

        _context.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteCollection(int id) // Deletes a collection from the database.
    {
        var collection = _context.Collections.Find(id);
        if (collection == null)
        {
            return NotFound();
        }

        _context.Collections.Remove(collection);
        _context.SaveChanges();
        return NoContent();
    }
}
