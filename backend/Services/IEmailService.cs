// Interface for email sending service via SMTP
// Returns success/failure for email delivery attempts

namespace backend.Services;

public interface IEmailService
{
    Task<bool> SendEmailAsync(string to, string subject, string body);
}

