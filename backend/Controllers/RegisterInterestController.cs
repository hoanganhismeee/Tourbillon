// Handles Register Your Interest submissions — supports both authenticated and guest users.
using backend.Extensions;
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
        var userId = User.GetUserId();
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
            r.CreatedAt,
            WatchSlug = r.Watch?.Slug,
            WatchImage = r.Watch?.Image,
        }));
    }

    // POST /api/register-interest — submit a registration of interest
    [HttpPost]
    public async Task<IActionResult> RegisterInterest([FromBody] CreateRegisterInterestDto dto)
    {
        var userId = User.GetUserId();

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

}
