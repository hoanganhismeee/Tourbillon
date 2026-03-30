// Handles advisor inquiries — persists to DB, emails user confirmation + admin notification
using backend.Database;
using backend.Models;
using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class ContactInquiryService : IContactInquiryService
{
    private readonly TourbillonContext _context;
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ContactInquiryService> _logger;

    public ContactInquiryService(
        TourbillonContext context,
        UserManager<User> userManager,
        IConfiguration configuration,
        ILogger<ContactInquiryService> logger)
    {
        _context = context;
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<ContactInquiry> SendInquiryAsync(int userId, CreateContactInquiryDto dto)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new InvalidOperationException("User not found");

        Watch? watch = null;
        if (dto.WatchId.HasValue)
        {
            watch = await _context.Watches
                .Include(w => w.Brand)
                .FirstOrDefaultAsync(w => w.Id == dto.WatchId.Value);
        }

        var inquiry = new ContactInquiry
        {
            UserId = userId,
            WatchId = dto.WatchId,
            UserEmail = user.Email ?? string.Empty,
            UserName = $"{user.FirstName} {user.LastName}".Trim(),
            WatchName = watch?.Description,
            WatchReference = watch?.Name,
            Message = dto.Message,
            CreatedAt = DateTime.UtcNow
        };

        _context.ContactInquiries.Add(inquiry);
        await _context.SaveChangesAsync();

        // Auto-advance status to In Review after 30 minutes (portfolio demo effect)
        BackgroundJob.Schedule<IContactInquiryService>(
            s => s.AdvanceStatusAsync(inquiry.Id),
            TimeSpan.FromMinutes(30));

        // Enqueue emails as durable Hangfire jobs — retried automatically on SMTP failure
        var userEmail = user.Email;
        if (!string.IsNullOrEmpty(userEmail))
        {
            var userBody = BuildUserConfirmationBody(user, watch, dto.Message);
            BackgroundJob.Enqueue<BackgroundEmailService>(x =>
                x.SendAsync(userEmail, "Your Tourbillon Inquiry", userBody));
        }

        var adminEmail = _configuration["AdminSettings:SeedAdminEmail"];
        if (!string.IsNullOrEmpty(adminEmail))
        {
            var adminBody = BuildAdminNotificationBody(user, watch, dto.Message);
            BackgroundJob.Enqueue<BackgroundEmailService>(x =>
                x.SendAsync(adminEmail, "New Advisor Inquiry — Tourbillon", adminBody));
        }

        return inquiry;
    }

    public async Task<List<ContactInquiry>> GetByUserIdAsync(int userId) =>
        await _context.ContactInquiries
            .Where(i => i.UserId == userId)
            .OrderByDescending(i => i.CreatedAt)
            .AsNoTracking()
            .ToListAsync();

    // Invoked by Hangfire 30 minutes after submission — advances status from Received to In Review.
    public async Task AdvanceStatusAsync(int inquiryId)
    {
        var inquiry = await _context.ContactInquiries.FindAsync(inquiryId);
        if (inquiry == null || inquiry.Status != "Received") return;
        inquiry.Status = "In Review";
        await _context.SaveChangesAsync();
    }

    private static string BuildUserConfirmationBody(User user, Watch? watch, string message)
    {
        var firstName = !string.IsNullOrEmpty(user.FirstName) ? user.FirstName : "there";
        var watchLine = watch != null
            ? $"about <strong>{watch.Description ?? watch.Name}</strong>"
            : "";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .quote {{ padding: 16px 20px; background: #f0e6d2; border-left: 4px solid #bfa68a;
                  border-radius: 6px; margin: 20px 0; color: #333; font-style: italic; }}
    </style>
</head>
<body>
    <div class=""container"">
        <h2>Inquiry Received</h2>
        <p>Hello {firstName},</p>
        <p>We've received your inquiry {watchLine}. Our advisor team will respond within 24-48 hours.</p>
        <div class=""quote"">{System.Net.WebUtility.HtmlEncode(message)}</div>
        <p>Best regards,<br>Tourbillon</p>
    </div>
</body>
</html>";
    }

    private static string BuildAdminNotificationBody(User user, Watch? watch, string message)
    {
        var watchInfo = watch != null
            ? $"<strong>{watch.Description ?? watch.Name}</strong> ({watch.Name})"
            : "General inquiry";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .detail {{ padding: 12px 16px; background: #f0e6d2; border-radius: 6px; margin: 8px 0; }}
        .quote {{ padding: 16px 20px; background: #f0e6d2; border-left: 4px solid #bfa68a;
                  border-radius: 6px; margin: 20px 0; color: #333; }}
    </style>
</head>
<body>
    <div class=""container"">
        <h2>New Advisor Inquiry</h2>
        <div class=""detail""><strong>From:</strong> {System.Net.WebUtility.HtmlEncode($"{user.FirstName} {user.LastName}".Trim())} ({user.Email})</div>
        <div class=""detail""><strong>Watch:</strong> {watchInfo}</div>
        <p><strong>Message:</strong></p>
        <div class=""quote"">{System.Net.WebUtility.HtmlEncode(message)}</div>
    </div>
</body>
</html>";
    }
}
