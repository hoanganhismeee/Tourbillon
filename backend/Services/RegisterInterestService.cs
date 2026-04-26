// Handles Register Your Interest submissions — persists to DB, emails customer confirmation + admin notification
using backend.Database;
using backend.Models;
using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class RegisterInterestService : IRegisterInterestService
{
    private readonly TourbillonContext _context;
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RegisterInterestService> _logger;
    private readonly IStorageService _storage;

    public RegisterInterestService(
        TourbillonContext context,
        UserManager<User> userManager,
        IConfiguration configuration,
        ILogger<RegisterInterestService> logger,
        IStorageService storage)
    {
        _context = context;
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
        _storage = storage;
    }

    public async Task<RegisterInterest> RegisterAsync(int? userId, CreateRegisterInterestDto dto)
    {
        // Use authenticated user data if available, otherwise use DTO fields
        string firstName = dto.FirstName;
        string lastName = dto.LastName;
        string email = dto.Email;
        string? phone = dto.Phone;

        if (userId.HasValue)
        {
            var user = await _userManager.FindByIdAsync(userId.Value.ToString());
            if (user != null)
            {
                firstName = !string.IsNullOrEmpty(user.FirstName) ? user.FirstName : dto.FirstName;
                lastName = !string.IsNullOrEmpty(user.LastName) ? user.LastName : dto.LastName;
                email = !string.IsNullOrEmpty(user.Email) ? user.Email : dto.Email;
                phone = !string.IsNullOrEmpty(user.PhoneNumber) ? user.PhoneNumber : dto.Phone;
            }
        }

        Watch? watch = null;
        if (dto.WatchId.HasValue)
        {
            watch = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .FirstOrDefaultAsync(w => w.Id == dto.WatchId.Value);
        }

        // Prefer server-loaded data; fall back to frontend snapshot values
        var brandName = watch?.Brand?.Name ?? dto.BrandName;
        var collectionName = watch?.Collection?.Name ?? dto.CollectionName;
        var watchDescription = watch?.Description;
        var watchReference = watch?.Name;

        var entry = new RegisterInterest
        {
            UserId = userId,
            WatchId = dto.WatchId,
            Salutation = dto.Salutation,
            CustomerFirstName = firstName,
            CustomerLastName = lastName,
            CustomerEmail = email,
            CustomerPhone = phone,
            PhoneRegionCode = dto.PhoneRegionCode,
            Message = dto.Message,
            BrandName = brandName,
            CollectionName = collectionName,
            WatchDescription = watchDescription,
            WatchReference = watchReference,
            Status = "Received",
            CreatedAt = DateTime.UtcNow
        };

        _context.RegisterInterests.Add(entry);
        await _context.SaveChangesAsync();

        // Auto-advance status to In Review after 30 minutes (portfolio demo effect)
        BackgroundJob.Schedule<IRegisterInterestService>(
            s => s.AdvanceStatusAsync(entry.Id),
            TimeSpan.FromMinutes(30));

        // Enqueue emails as durable Hangfire jobs — retried automatically on SMTP failure
        var userBody = BuildUserConfirmationBody(entry, watch, _storage);
        BackgroundJob.Enqueue<BackgroundEmailService>(x =>
            x.SendAsync(entry.CustomerEmail, "Your Tourbillon Registration of Interest", userBody));

        var adminEmail = _configuration["AdminSettings:SeedAdminEmail"];
        if (!string.IsNullOrEmpty(adminEmail))
        {
            var adminBody = BuildAdminNotificationBody(entry, watch);
            BackgroundJob.Enqueue<BackgroundEmailService>(x =>
                x.SendAsync(adminEmail, "New Registration of Interest — Tourbillon", adminBody));
        }

        return entry;
    }

    public async Task<List<RegisterInterest>> GetByUserIdAsync(int userId) =>
        await _context.RegisterInterests
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .AsNoTracking()
            .ToListAsync();

    // Invoked by Hangfire 30 minutes after submission — advances status from Received to In Review.
    public async Task AdvanceStatusAsync(int registrationId)
    {
        var reg = await _context.RegisterInterests.FindAsync(registrationId);
        if (reg == null || reg.Status != "Received") return;
        reg.Status = "In Review";
        await _context.SaveChangesAsync();
    }

    private static string BuildUserConfirmationBody(RegisterInterest entry, Watch? watch, IStorageService storage)
    {
        var displayName = !string.IsNullOrEmpty(entry.CustomerFirstName) ? entry.CustomerFirstName : "there";
        var fullName = $"{entry.CustomerFirstName} {entry.CustomerLastName}".Trim();
        var brandLine = !string.IsNullOrEmpty(entry.BrandName)
            ? System.Net.WebUtility.HtmlEncode(entry.BrandName)
            : "this timepiece";

        // Watch product card
        var watchCard = "";
        if (watch != null)
        {
            var imageUrl = storage.GetPublicUrl(watch.Image, watch.ImageVersion);
            var brandName = System.Net.WebUtility.HtmlEncode(watch.Brand?.Name ?? "");
            var collectionName = System.Net.WebUtility.HtmlEncode(watch.Collection?.Name ?? "");
            var refNumber = System.Net.WebUtility.HtmlEncode(watch.Name);
            var priceStr = watch.CurrentPrice == 0
                ? "Price on Request"
                : $"AUD {watch.CurrentPrice:N0}";
            var imgTag = !string.IsNullOrEmpty(imageUrl)
                ? $@"<img src=""{imageUrl}"" alt=""{refNumber}"" width=""120"" height=""120"" style=""display:block;border-radius:8px;object-fit:cover;background:#f0e8dc;"" />"
                : "";

            watchCard = $@"
<tr><td style=""padding:20px;border-bottom:1px solid #e8dcc8;"">
    <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Watch of Interest</span>
    <table cellpadding=""0"" cellspacing=""0"" style=""margin-top:12px;width:100%;"">
        <tr>
            {(!string.IsNullOrEmpty(imgTag) ? $@"<td style=""width:120px;vertical-align:top;padding-right:16px;"">{imgTag}</td>" : "")}
            <td style=""vertical-align:top;"">
                <p style=""margin:0 0 2px;color:#8a7a66;font-size:12px;text-transform:uppercase;letter-spacing:1px;"">{brandName}</p>
                {(!string.IsNullOrEmpty(collectionName) ? $@"<p style=""margin:0 0 4px;color:#8a7a66;font-size:12px;"">{collectionName}</p>" : "")}
                <p style=""margin:0 0 10px;color:#6a6460;font-size:13px;font-family:monospace;"">Ref. {refNumber}</p>
                <p style=""margin:0;display:inline-block;background:#1a1613;color:#ecddc8;font-size:13px;padding:6px 14px;border-radius:20px;letter-spacing:0.5px;"">{priceStr}</p>
            </td>
        </tr>
    </table>
</td></tr>";
        }

        // Optional message quote
        var messageQuote = !string.IsNullOrEmpty(entry.Message)
            ? $@"<tr><td style=""padding:0 40px 20px;"">
                    <p style=""margin:0 0 8px;color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Your Request</p>
                    <div style=""padding:16px 20px;background:#faf6f1;border-left:4px solid #bfa68a;border-radius:6px;color:#4a4440;font-size:14px;line-height:1.7;font-style:italic;"">
                        {System.Net.WebUtility.HtmlEncode(entry.Message)}
                    </div>
                 </td></tr>"
            : "";

        var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
</head>
<body style=""margin:0;padding:0;background-color:#f5f0eb;font-family:'Helvetica Neue',Arial,sans-serif;"">
    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f5f0eb;padding:40px 20px;"">
        <tr><td align=""center"">
            <table width=""600"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;"">
                <!-- Header -->
                <tr><td style=""background-color:#1a1613;padding:32px 40px;text-align:center;"">
                    <h1 style=""margin:0;color:#ecddc8;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;letter-spacing:2px;"">TOURBILLON</h1>
                </td></tr>
                <!-- Greeting -->
                <tr><td style=""padding:36px 40px 20px;"">
                    <h2 style=""margin:0 0 16px;color:#1a1613;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;"">Thank You, {System.Net.WebUtility.HtmlEncode(displayName)}</h2>
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:15px;line-height:1.7;"">
                        We have received your registration of interest in <strong>{brandLine}</strong>. A member of our advisor team will personally reach out to assist you within 24–48 hours.
                    </p>
                </td></tr>
                <!-- Watch card -->
                {(watch != null ? $@"<tr><td style=""padding:0 40px 24px;"">
                    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#faf6f1;border-radius:8px;overflow:hidden;"">
                        <tr><td style=""padding:16px 20px;background:#1a1613;"">
                            <span style=""color:#ecddc8;font-size:13px;text-transform:uppercase;letter-spacing:2px;font-weight:600;"">Watch of Interest</span>
                        </td></tr>
                        {watchCard}
                    </table>
                </td></tr>" : "")}
                <!-- Message quote -->
                {messageQuote}
                <!-- Closing -->
                <tr><td style=""padding:0 40px 20px;"">
                    <p style=""margin:0;color:#4a4440;font-size:14px;line-height:1.7;"">
                        A confirmation of this registration has been sent to your email address. Should you have any questions in the meantime, please do not hesitate to contact us.
                    </p>
                </td></tr>
                <!-- Footer -->
                <tr><td style=""background-color:#1a1613;padding:24px 40px;text-align:center;"">
                    <p style=""margin:0 0 8px;color:#ecddc8;font-family:Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:1px;"">TOURBILLON</p>
                    <p style=""margin:0;color:#8a7a66;font-size:12px;"">123 George Street, Sydney NSW 2000</p>
                    <p style=""margin:4px 0 0;color:#8a7a66;font-size:12px;"">Mon - Sat: 10:00 AM - 6:00 PM</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>";

        return body;
    }

    private static string BuildAdminNotificationBody(RegisterInterest entry, Watch? watch)
    {
        var customerName = $"{entry.Salutation} {entry.CustomerFirstName} {entry.CustomerLastName}".Trim();
        var watchInfo = watch != null
            ? $"{System.Net.WebUtility.HtmlEncode(watch.Description ?? watch.Name)} ({watch.Name})"
            : entry.BrandName ?? "No specific watch";

        var messageBlock = !string.IsNullOrEmpty(entry.Message)
            ? $@"<p><strong>Request:</strong></p>
                 <div class=""quote"">{System.Net.WebUtility.HtmlEncode(entry.Message)}</div>"
            : "";

        var body = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .detail {{ padding: 12px 16px; background: #f0e6d2; border-radius: 6px; margin: 8px 0; }}
        .quote {{ padding: 16px 20px; background: #f0e6d2; border-left: 4px solid #bfa68a;
                  border-radius: 6px; margin: 12px 0; color: #333; }}
    </style>
</head>
<body>
    <div class=""container"">
        <h2>New Registration of Interest</h2>
        <div class=""detail""><strong>Customer:</strong> {System.Net.WebUtility.HtmlEncode(customerName)} ({System.Net.WebUtility.HtmlEncode(entry.CustomerEmail)})</div>
        {(!string.IsNullOrEmpty(entry.CustomerPhone) ? $@"<div class=""detail""><strong>Phone:</strong> {System.Net.WebUtility.HtmlEncode(entry.PhoneRegionCode ?? "")} {System.Net.WebUtility.HtmlEncode(entry.CustomerPhone)}</div>" : "")}
        <div class=""detail""><strong>Watch:</strong> {watchInfo}</div>
        {(!string.IsNullOrEmpty(entry.CollectionName) ? $@"<div class=""detail""><strong>Collection:</strong> {System.Net.WebUtility.HtmlEncode(entry.CollectionName)}</div>" : "")}
        {messageBlock}
    </div>
</body>
</html>";

        return body;
    }
}
