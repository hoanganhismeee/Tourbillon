// Handles Register Your Interest submissions — supports both authenticated and guest users.
using System.Security.Claims;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/register-interest")]
public class RegisterInterestController : ControllerBase
{
    private readonly IRegisterInterestService _service;

    public RegisterInterestController(IRegisterInterestService service)
    {
        _service = service;
    }

    // GET /api/register-interest/my-submissions — list the current user's interest registrations
    [HttpGet("my-submissions")]
    [Authorize]
    public async Task<IActionResult> GetMySubmissions()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var submissions = await _service.GetByUserIdAsync(userId.Value);
        return Ok(submissions.Select(r => new
        {
            r.Id,
            r.BrandName,
            r.CollectionName,
            r.WatchDescription,
            r.WatchReference,
            r.Status,
            r.CreatedAt
        }));
    }

    // POST /api/register-interest — submit a registration of interest
    [HttpPost]
    public async Task<IActionResult> RegisterInterest([FromBody] CreateRegisterInterestDto dto)
    {
        var userId = GetCurrentUserId();

        try
        {
            var entry = await _service.RegisterAsync(userId, dto);
            return Ok(new RegisterInterestResponseDto
            {
                Id = entry.Id,
                CreatedAt = entry.CreatedAt
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
