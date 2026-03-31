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

    // Slug-based detail — primary public endpoint
    [HttpGet("by-slug/{slug}")]
    public IActionResult GetCollectionBySlug(string slug)
    {
        var collection = _context.Collections.FirstOrDefault(c => c.Slug == slug);
        return collection == null ? NotFound() : Ok(collection);
    }

    // Numeric ID detail — kept for admin/internal use
    [HttpGet("{id:int}")]
    public IActionResult GetCollection(int id)
    {
        var collection = _context.Collections.Find(id);
        return collection == null ? NotFound() : Ok(collection);
    }

    // Slug-based brand filter — primary public endpoint
    [HttpGet("brand/by-slug/{slug}")]
    public IActionResult GetCollectionsByBrandSlug(string slug)
    {
        var brand = _context.Brands.FirstOrDefault(b => b.Slug == slug);
        if (brand == null) return NotFound();

        var collections = _context.Collections.Where(c => c.BrandId == brand.Id).ToList();
        return Ok(collections);
    }

    [HttpGet("brand/{brandId:int}")]
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
