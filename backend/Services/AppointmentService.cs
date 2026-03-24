// Handles appointment bookings — persists to DB, emails user confirmation + admin notification
using backend.Database;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class AppointmentService : IAppointmentService
{
    private readonly TourbillonContext _context;
    private readonly UserManager<User> _userManager;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AppointmentService> _logger;

    public AppointmentService(
        TourbillonContext context,
        UserManager<User> userManager,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<AppointmentService> logger)
    {
        _context = context;
        _userManager = userManager;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<Appointment> BookAppointmentAsync(int? userId, CreateAppointmentDto dto)
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
                .FirstOrDefaultAsync(w => w.Id == dto.WatchId.Value);
        }

        var appointment = new Appointment
        {
            UserId = userId,
            WatchId = dto.WatchId,
            CustomerFirstName = firstName,
            CustomerLastName = lastName,
            CustomerEmail = email,
            CustomerPhone = phone,
            PhoneRegionCode = dto.PhoneRegionCode,
            NotifyByEmail = dto.NotifyByEmail,
            NotifyBySms = dto.NotifyBySms,
            BoutiqueName = dto.BoutiqueName,
            VisitPurpose = dto.VisitPurpose,
            BrandName = dto.BrandName,
            AppointmentDate = dto.AppointmentDate,
            Status = "Confirmed",
            CreatedAt = DateTime.UtcNow
        };

        _context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

        // Send emails (fire-and-forget — appointment is already saved)
        _ = Task.Run(async () =>
        {
            try
            {
                await SendUserConfirmationEmail(appointment, watch);
                await SendAdminNotificationEmail(appointment, watch);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send appointment emails for appointment {AppointmentId}", appointment.Id);
            }
        });

        return appointment;
    }

    private async Task SendUserConfirmationEmail(Appointment appt, Watch? watch)
    {
        var displayName = !string.IsNullOrEmpty(appt.CustomerFirstName) ? appt.CustomerFirstName : "there";
        var fullName = $"{appt.CustomerFirstName} {appt.CustomerLastName}".Trim();
        var dateStr = appt.AppointmentDate.ToString("dddd, d MMMM yyyy");
        var timeStr = appt.AppointmentDate.ToString("h:mm tt");
        var watchLine = watch != null
            ? $@"<tr><td style=""padding:14px 20px;border-bottom:1px solid #e8dcc8;""><span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Regarding</span><br><strong style=""color:#1a1613;"">{System.Net.WebUtility.HtmlEncode(watch.Description ?? watch.Name)}</strong></td></tr>"
            : "";
        var notifyLine = appt.NotifyByEmail && appt.NotifyBySms
            ? "email and SMS"
            : appt.NotifyBySms ? "SMS" : "email";

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
                        We are delighted to confirm your appointment at <strong>{System.Net.WebUtility.HtmlEncode(appt.BoutiqueName)}</strong>. Thank you for choosing Tourbillon — we look forward to welcoming you and providing an exceptional experience.
                    </p>
                </td></tr>
                <!-- Appointment Details -->
                <tr><td style=""padding:0 40px 24px;"">
                    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#faf6f1;border-radius:8px;overflow:hidden;"">
                        <tr><td style=""padding:16px 20px;background:#1a1613;"">
                            <span style=""color:#ecddc8;font-size:13px;text-transform:uppercase;letter-spacing:2px;font-weight:600;"">Appointment Details</span>
                        </td></tr>
                        <tr><td style=""padding:14px 20px;border-bottom:1px solid #e8dcc8;"">
                            <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Guest</span><br>
                            <strong style=""color:#1a1613;"">{System.Net.WebUtility.HtmlEncode(fullName)}</strong>
                        </td></tr>
                        <tr><td style=""padding:14px 20px;border-bottom:1px solid #e8dcc8;"">
                            <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Date</span><br>
                            <strong style=""color:#1a1613;"">{dateStr}</strong>
                        </td></tr>
                        <tr><td style=""padding:14px 20px;border-bottom:1px solid #e8dcc8;"">
                            <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Time</span><br>
                            <strong style=""color:#1a1613;"">{timeStr}</strong>
                        </td></tr>
                        <tr><td style=""padding:14px 20px;border-bottom:1px solid #e8dcc8;"">
                            <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Location</span><br>
                            <strong style=""color:#1a1613;"">{System.Net.WebUtility.HtmlEncode(appt.BoutiqueName)}</strong><br>
                            <span style=""color:#6a6460;font-size:14px;"">123 George Street, Sydney NSW 2000</span>
                        </td></tr>
                        {watchLine}
                        <tr><td style=""padding:14px 20px;"">
                            <span style=""color:#8a7a66;font-size:13px;text-transform:uppercase;letter-spacing:1px;"">Notifications</span><br>
                            <strong style=""color:#1a1613;"">Via {notifyLine}</strong>
                        </td></tr>
                    </table>
                </td></tr>
                <!-- Footer message -->
                <tr><td style=""padding:0 40px 20px;"">
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:14px;line-height:1.7;"">
                        Should you need to reschedule or have any questions before your visit, please do not hesitate to contact us. Our team is here to assist you.
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

        await _emailService.SendEmailAsync(appt.CustomerEmail, "Thank You for Your Tourbillon Appointment", body);
    }

    private async Task SendAdminNotificationEmail(Appointment appt, Watch? watch)
    {
        var adminEmail = _configuration["AdminSettings:SeedAdminEmail"];
        if (string.IsNullOrEmpty(adminEmail)) return;

        var customerName = $"{appt.CustomerFirstName} {appt.CustomerLastName}".Trim();
        var dateStr = appt.AppointmentDate.ToString("dddd, d MMMM yyyy");
        var timeStr = appt.AppointmentDate.ToString("h:mm tt");
        var watchInfo = watch != null
            ? $"{System.Net.WebUtility.HtmlEncode(watch.Description ?? watch.Name)} ({watch.Name})"
            : "No specific watch";

        var body = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .detail {{ padding: 12px 16px; background: #f0e6d2; border-radius: 6px; margin: 8px 0; }}
    </style>
</head>
<body>
    <div class=""container"">
        <h2>New Appointment Booking</h2>
        <div class=""detail""><strong>Customer:</strong> {System.Net.WebUtility.HtmlEncode(customerName)} ({System.Net.WebUtility.HtmlEncode(appt.CustomerEmail)})</div>
        <div class=""detail""><strong>Date:</strong> {dateStr} at {timeStr}</div>
        <div class=""detail""><strong>Boutique:</strong> {System.Net.WebUtility.HtmlEncode(appt.BoutiqueName)}</div>
        <div class=""detail""><strong>Purpose:</strong> {System.Net.WebUtility.HtmlEncode(appt.VisitPurpose)}</div>
        <div class=""detail""><strong>Watch:</strong> {watchInfo}</div>
        {(!string.IsNullOrEmpty(appt.CustomerPhone) ? $@"<div class=""detail""><strong>Phone:</strong> {System.Net.WebUtility.HtmlEncode(appt.CustomerPhone)}</div>" : "")}
    </div>
</body>
</html>";

        await _emailService.SendEmailAsync(adminEmail, "New Appointment Booking — Tourbillon", body);
    }
}
