// Chat concierge controller — handles message routing and session management.
// No [Authorize] required — anonymous users can chat (rate limited by IP).
using backend.Infrastructure;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly ChatService _chatService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(ChatService chatService, ILogger<ChatController> logger)
    {
        _chatService = chatService;
        _logger = logger;
    }

    // POST /api/chat/message
    [HttpPost("message")]
    public async Task<IActionResult> SendMessage([FromBody] ChatMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "sessionId and message are required" });

        var userId    = User.Identity?.IsAuthenticated == true
            ? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            : null;
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var isAdmin = User.Identity?.IsAuthenticated == true && User.IsInRole("Admin");

        // Every model, embedding and SQL stage below records into this, and the totals go back in
        // the Server-Timing header, where the eval harness and the browser's network panel read them.
        var timings = StageTimings.Begin();
        ChatApiResponse result;
        try
        {
            result = await _chatService.HandleMessageAsync(
                request.SessionId,
                request.Message,
                userId,
                ipAddress,
                request.BehaviorSummary,
                request.PreferredLanguage,
                isAdmin,
                cancellationToken: HttpContext.RequestAborted);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected before a response was produced — quota was not charged.
            return StatusCode(499);
        }

        var serverTiming = timings.ToServerTimingHeader();
        Response.Headers["Server-Timing"] = serverTiming;
        _logger.LogInformation("Chat timing path={RoutingPath} {ServerTiming}", result.RoutingPath, serverTiming);

        if (result.RateLimited)
            return StatusCode(429, result);

        return Ok(result);
    }

    // DELETE /api/chat/session/{sessionId}
    [HttpDelete("session/{sessionId}")]
    public async Task<IActionResult> ClearSession(string sessionId)
    {
        await _chatService.ClearSessionAsync(sessionId);
        return NoContent();
    }
}
