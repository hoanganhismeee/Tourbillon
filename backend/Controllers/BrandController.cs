// Handle everything related to brands

using Microsoft.AspNetCore.Mvc;
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
    public IActionResult GetAllBrands() // Return all brand from database
    {
        var brands = _context.Brands.ToList();
        return Ok(brands);
    }

    [HttpGet("{id}")]
    public IActionResult GetBrand(int id)
    {
        var brand = _context.Brands.Find(id);
        return brand == null ? NotFound() : Ok(brand);
    }
}
