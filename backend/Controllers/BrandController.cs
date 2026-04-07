// Handle everything related to brands

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Database;
using backend.Models;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BrandController : ControllerBase
{
    private readonly TourbillonContext _context;

    public BrandController(TourbillonContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllBrands() // Return all brands ordered by ID
    {
        var brands = await _context.Brands.OrderBy(b => b.Id).ToListAsync();
        return Ok(brands);
    }

    // Slug-based detail — primary public endpoint
    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> GetBrandBySlug(string slug)
    {
        var brand = await _context.Brands.FirstOrDefaultAsync(b => b.Slug == slug);
        return brand == null ? NotFound() : Ok(brand);
    }

    // Numeric ID detail — kept for admin/internal use
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetBrand(int id)
    {
        var brand = await _context.Brands.FindAsync(id);
        return brand == null ? NotFound() : Ok(brand);
    }

    [HttpPost]
    public IActionResult CreateBrand([FromBody] Brand brand) // Creates a new brand in the database.
    {
        _context.Brands.Add(brand);
        _context.SaveChanges();
        return CreatedAtAction(nameof(GetBrand), new { id = brand.Id }, brand);
    }

    [HttpPut("{id}")]
    public IActionResult UpdateBrand(int id, [FromBody] Brand updatedBrand) // Updates an existing brand in the database.
    {
        var brand = _context.Brands.Find(id);
        if (brand == null)
        {
            return NotFound();
        }

        brand.Name = updatedBrand.Name;
        brand.Description = updatedBrand.Description;
        brand.Image = updatedBrand.Image;

        _context.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteBrand(int id) // Deletes a brand from the database.
    {
        var brand = _context.Brands.Find(id);
        if (brand == null)
        {
            return NotFound();
        }

        _context.Brands.Remove(brand);
        _context.SaveChanges();
        return NoContent();
    }
}
