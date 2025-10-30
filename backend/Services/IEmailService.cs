// Email service interface for sending emails via SMTP

namespace backend.Services;

public interface IEmailService
{
    Task<bool> SendEmailAsync(string to, string subject, string body);
}

