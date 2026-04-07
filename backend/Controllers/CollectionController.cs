// Manage collection within each brands

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    public async Task<IActionResult> GetCollections() // Return all collections from database
    {
        var collections = await _context.Collections.ToListAsync();
        return Ok(collections);
    }

    // Slug-based detail — primary public endpoint
    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> GetCollectionBySlug(string slug)
    {
        var collection = await _context.Collections.FirstOrDefaultAsync(c => c.Slug == slug);
        return collection == null ? NotFound() : Ok(collection);
    }

    // Numeric ID detail — kept for admin/internal use
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetCollection(int id)
    {
        var collection = await _context.Collections.FindAsync(id);
        return collection == null ? NotFound() : Ok(collection);
    }

    // Slug-based brand filter — primary public endpoint
    [HttpGet("brand/by-slug/{slug}")]
    public async Task<IActionResult> GetCollectionsByBrandSlug(string slug)
    {
        var brand = await _context.Brands.FirstOrDefaultAsync(b => b.Slug == slug);
        if (brand == null) return NotFound();

        var collections = await _context.Collections.Where(c => c.BrandId == brand.Id).ToListAsync();
        return Ok(collections);
    }

    [HttpGet("brand/{brandId:int}")]
    public async Task<IActionResult> GetCollectionsByBrand(int brandId)
    {
        var collections = await _context.Collections.Where(c => c.BrandId == brandId).ToListAsync();
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
