// Admin controller for watch data management
// Provides endpoints for scraping and data management

using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly ILogger<AdminController> _logger;

    public AdminController(ILogger<AdminController> logger)
    {
        _logger = logger;
    }

    // Placeholder for future scraper endpoints
    // Will be implemented after scraper services are created
}
