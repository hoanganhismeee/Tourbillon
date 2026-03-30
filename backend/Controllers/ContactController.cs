// Handles advisor inquiries — primarily for Price on Request watches.
// Requires authentication; sends confirmation email to user and notification to admin.
using System.Security.Claims;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContactController : ControllerBase
{
    private readonly IContactInquiryService _inquiryService;

    public ContactController(IContactInquiryService inquiryService)
    {
        _inquiryService = inquiryService;
    }

    // GET /api/contact/my-inquiries — list the current user's inquiries
    [HttpGet("my-inquiries")]
    public async Task<IActionResult> GetMyInquiries()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var inquiries = await _inquiryService.GetByUserIdAsync(userId.Value);
        return Ok(inquiries.Select(i => new
        {
            i.Id,
            i.WatchName,
            i.WatchReference,
            i.Message,
            i.Status,
            i.CreatedAt
        }));
    }

    // POST /api/contact/inquiry — submit an advisor inquiry
    [HttpPost("inquiry")]
    public async Task<IActionResult> SubmitInquiry([FromBody] CreateContactInquiryDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var inquiry = await _inquiryService.SendInquiryAsync(userId.Value, dto);
            return Ok(new ContactInquiryResponseDto
            {
                Id = inquiry.Id,
                CreatedAt = inquiry.CreatedAt
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
