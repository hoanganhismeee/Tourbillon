// Chat concierge controller — handles message routing and session management.
// No [Authorize] required — anonymous users can chat (rate limited by IP).
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

    public ChatController(ChatService chatService)
    {
        _chatService = chatService;
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

        var result = await _chatService.HandleMessageAsync(request.SessionId, request.Message, userId, ipAddress, request.BehaviorSummary);

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
