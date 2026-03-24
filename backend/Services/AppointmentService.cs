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
        var dateStr = appt.AppointmentDate.ToString("dddd, d MMMM yyyy");
        var timeStr = appt.AppointmentDate.ToString("h:mm tt");
        var watchLine = watch != null
            ? $"<p>Regarding: <strong>{System.Net.WebUtility.HtmlEncode(watch.Description ?? watch.Name)}</strong></p>"
            : "";

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
        <h2>Appointment Confirmed</h2>
        <p>Hello {System.Net.WebUtility.HtmlEncode(displayName)},</p>
        <p>Your appointment has been confirmed.</p>
        <div class=""detail""><strong>Date:</strong> {dateStr}</div>
        <div class=""detail""><strong>Time:</strong> {timeStr}</div>
        <div class=""detail""><strong>Location:</strong> {System.Net.WebUtility.HtmlEncode(appt.BoutiqueName)}</div>
        {watchLine}
        <p>We look forward to welcoming you.</p>
        <p>Best regards,<br>Tourbillon</p>
    </div>
</body>
</html>";

        await _emailService.SendEmailAsync(appt.CustomerEmail, "Your Tourbillon Appointment", body);
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
