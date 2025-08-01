// Handles email sending for passwordless login and password reset using Gmail SMTP
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;

namespace backend.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SendLoginLinkAsync(string email, string token, string callbackUrl)
    {
        try
        {
            var subject = "Sign in to Tourbillon";
            var body = $@"
                <h2>Welcome to Tourbillon</h2>
                <p>Click the link below to sign in to your account:</p>
                <p><a href='{callbackUrl}?token={token}&type=login'>Sign In to Tourbillon</a></p>
                <p>This link will expire in 15 minutes.</p>
                <p>If you didn't request this email, please ignore it.</p>";

            return await SendEmailAsync(email, subject, body);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send login link to {Email}", email);
            return false;
        }
    }

    public async Task<bool> SendPasswordResetLinkAsync(string email, string token, string callbackUrl)
    {
        try
        {
            var subject = "Reset Your Tourbillon Password";
            var body = $@"
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <p><a href='{callbackUrl}?token={token}&type=reset'>Reset Password</a></p>
                <p>This link will expire in 15 minutes.</p>
                <p>If you didn't request this email, please ignore it.</p>";

            return await SendEmailAsync(email, subject, body);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset link to {Email}", email);
            return false;
        }
    }

    private async Task<bool> SendEmailAsync(string toEmail, string subject, string body)
    {
        try
        {
            var email = new MimeMessage();
            email.From.Add(MailboxAddress.Parse(_configuration["EmailSettings:FromEmail"]));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = subject;
            email.Body = new TextPart(TextFormat.Html) { Text = body };

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(
                _configuration["EmailSettings:SmtpServer"],
                int.Parse(_configuration["EmailSettings:Port"]),
                SecureSocketOptions.StartTls
            );
            
            await smtp.AuthenticateAsync(
                _configuration["EmailSettings:Username"],
                _configuration["EmailSettings:Password"]
            );
            
            await smtp.SendAsync(email);
            await smtp.DisconnectAsync(true);

            _logger.LogInformation("Email sent successfully to {Email}", toEmail);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", toEmail);
            return false;
        }
    }
} 