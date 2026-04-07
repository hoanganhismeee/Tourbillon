// Manages watch taste profiles for authenticated users.
// GET returns the current profile (empty defaults if not yet set).
// POST sends plain text to the LLM extraction pipeline and upserts the structured profile.
using backend.Extensions;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TasteController : ControllerBase
{
    private readonly ITasteProfileService _tasteService;

    public TasteController(ITasteProfileService tasteService)
    {
        _tasteService = tasteService;
    }

    // GET /api/taste — returns current user's taste profile (empty if not yet set)
    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var profile = await _tasteService.GetProfileAsync(userId.Value);
        return Ok(profile);
    }

    // POST /api/taste — parses plain-text taste description via LLM and saves the profile
    [HttpPost]
    public async Task<IActionResult> SaveTaste([FromBody] SaveTasteDto dto)
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        // Enforce 50-word limit server-side (client enforces too, but never trust only the client)
        var wordCount = dto.TasteText.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        if (wordCount > 50)
            return BadRequest(new { message = "Taste description exceeds 50 words." });

        var profile = await _tasteService.ParseAndSaveAsync(userId.Value, dto.TasteText.Trim());
        return Ok(profile);
    }

    // POST /api/taste/generate — derives a taste profile from the user's browsing history via AI
    [HttpPost("generate")]
    public async Task<IActionResult> GenerateFromBehavior()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var profile = await _tasteService.GenerateFromBehaviorAsync(userId.Value);
        return Ok(profile);
    }

}
