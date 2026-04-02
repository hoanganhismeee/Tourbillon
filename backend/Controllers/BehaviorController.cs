// REST endpoints for storing user browsing events and merging anonymous sessions on login.
using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BehaviorController : ControllerBase
{
    private readonly IBehaviorService _behaviorService;

    public BehaviorController(IBehaviorService behaviorService)
    {
        _behaviorService = behaviorService;
    }

    // Accepts a batch of browsing events from the client (anonymous or authenticated).
    [HttpPost("events")]
    public async Task<IActionResult> FlushEvents([FromBody] BrowsingEventBatchDto batch)
    {
        int? userId = null;
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
            userId = parsedId;

        await _behaviorService.FlushEventsAsync(userId, batch.AnonymousId, batch.Events);
        return Ok();
    }

    // Merges anonymous browsing events into the authenticated user's account.
    [HttpPost("merge")]
    [Authorize]
    public async Task<IActionResult> MergeAnonymous([FromBody] MergeAnonymousDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
            return Unauthorized();

        await _behaviorService.MergeAnonymousAsync(userId, dto.AnonymousId);
        return Ok();
    }
}
