// Hangfire-compatible email dispatch service.
// Wraps IEmailService so failures throw and trigger Hangfire's automatic retry (10 attempts).

using Hangfire;

namespace backend.Services;

public class BackgroundEmailService
{
    private readonly IEmailService _emailService;
    private readonly ILogger<BackgroundEmailService> _logger;

    public BackgroundEmailService(IEmailService emailService, ILogger<BackgroundEmailService> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    // Sends an email; throws on failure so Hangfire will retry automatically.
    [AutomaticRetry(Attempts = 10)]
    public async Task SendAsync(string to, string subject, string body)
    {
        var success = await _emailService.SendEmailAsync(to, subject, body);
        if (success)
        {
            _logger.LogInformation("Email delivered to={To} subject={Subject}", to, subject);
            return;
        }
        _logger.LogWarning("Email delivery failed to {To} — subject: {Subject}", to, subject);
        throw new InvalidOperationException($"Email delivery failed to {to}");
    }
}
