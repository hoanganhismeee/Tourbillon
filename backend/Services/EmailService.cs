// Handles sending emails via SMTP configuration from appsettings.json or User Secrets
// Uses MailKit library for reliable Gmail STARTTLS support
using Microsoft.Extensions.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace backend.Services;

public class SmtpOptions
{
    public const string SectionName = "Smtp";
    
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
}

public class EmailService : IEmailService
{
    private readonly SmtpOptions _smtpOptions;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpOptions> smtpOptions, ILogger<EmailService> logger)
    {
        _smtpOptions = smtpOptions.Value;
        _logger = logger;
    }

    // Sends an email using SMTP configuration with MailKit for reliable STARTTLS support
    public async Task<bool> SendEmailAsync(string to, string subject, string body)
    {
        try
        {
            // Log SMTP configuration (without password)
            _logger.LogInformation("Attempting to send email to {To} using SMTP: {Host}:{Port}, SSL: {Ssl}, Username: {Username}", 
                to, _smtpOptions.Host, _smtpOptions.Port, _smtpOptions.EnableSsl, _smtpOptions.Username);

            if (string.IsNullOrWhiteSpace(_smtpOptions.Host) || 
                string.IsNullOrWhiteSpace(_smtpOptions.Username))
            {
                _logger.LogWarning("SMTP configuration is missing. Host: '{Host}', Username: '{Username}'. Email not sent to {Email}", 
                    _smtpOptions.Host ?? "NULL", _smtpOptions.Username ?? "NULL", to);
                return false;
            }

            if (string.IsNullOrWhiteSpace(_smtpOptions.Password))
            {
                _logger.LogWarning("SMTP password is missing. Email not sent to {Email}", to);
                return false;
            }

            // Trim password to remove any whitespace issues
            var trimmedPassword = _smtpOptions.Password.Trim();
            if (string.IsNullOrWhiteSpace(trimmedPassword))
            {
                _logger.LogError("SMTP password is empty after trimming. Email not sent to {Email}", to);
                return false;
            }

            // Validate App Password format (Gmail App Passwords are 16 characters, alphanumeric)
            if (trimmedPassword.Length != 16)
            {
                _logger.LogError("SMTP password length is {Length} characters. Gmail App Passwords must be exactly 16 characters. Email not sent to {Email}", 
                    trimmedPassword.Length, to);
                return false;
            }

            // Log password format validation (without exposing actual password)
            var hasInvalidChars = trimmedPassword.Any(c => !char.IsLetterOrDigit(c));
            if (hasInvalidChars)
            {
                _logger.LogWarning("SMTP password contains non-alphanumeric characters. This may cause authentication issues.");
            }
            else
            {
                _logger.LogInformation("App Password format validated: 16 alphanumeric characters");
            }

            // Debug: Show first and last character (masked) to help verify password is being read correctly
            _logger.LogInformation("Password verification: First char='{First}', Last char='{Last}', HasWhitespace={HasSpace}", 
                trimmedPassword[0], trimmedPassword[15], trimmedPassword != _smtpOptions.Password);

            // Create MIME message
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_smtpOptions.FromName, _smtpOptions.FromEmail));
            message.To.Add(new MailboxAddress("", to));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = body };
            message.Body = bodyBuilder.ToMessageBody();

            // Connect to SMTP server using MailKit with improved configuration
            using var client = new SmtpClient();
            
            // Set timeout to prevent hanging
            client.Timeout = 30000; // 30 seconds
            
            _logger.LogInformation("Connecting to SMTP server {Host}:{Port}...", _smtpOptions.Host, _smtpOptions.Port);
            
            // Use Auto to let MailKit choose the best SSL/TLS option
            SecureSocketOptions socketOptions;
            if (_smtpOptions.Port == 465)
            {
                socketOptions = SecureSocketOptions.SslOnConnect;
                _logger.LogInformation("Using SSL connection (port 465)");
            }
            else if (_smtpOptions.Port == 587)
            {
                socketOptions = SecureSocketOptions.StartTls;
                _logger.LogInformation("Using STARTTLS connection (port 587)");
            }
            else
            {
                // Try Auto for other ports
                socketOptions = SecureSocketOptions.Auto;
                _logger.LogInformation("Using Auto SSL/TLS detection");
            }
            
            // Connect with SSL validation
            await client.ConnectAsync(_smtpOptions.Host, _smtpOptions.Port, socketOptions);
            _logger.LogInformation("SMTP connection established. Server capabilities: {Capabilities}", client.Capabilities);

            // Check if server supports authentication
            if (!client.AuthenticationMechanisms.Contains("PLAIN") && !client.AuthenticationMechanisms.Contains("LOGIN"))
            {
                _logger.LogWarning("Server may not support standard authentication. Available mechanisms: {Mechanisms}", 
                    string.Join(", ", client.AuthenticationMechanisms));
            }

            // Authenticate with trimmed password using explicit PLAIN mechanism
            _logger.LogInformation("Authenticating with username: {Username}, Password length: {Length}", 
                _smtpOptions.Username, trimmedPassword.Length);
            _logger.LogInformation("Available authentication mechanisms: {Mechanisms}", 
                string.Join(", ", client.AuthenticationMechanisms));
            
            try
            {
                // Try PLAIN authentication first (most common for Gmail App Passwords)
                if (client.AuthenticationMechanisms.Contains("PLAIN"))
                {
                    _logger.LogInformation("Attempting PLAIN authentication...");
                    var credentials = new System.Net.NetworkCredential(_smtpOptions.Username, trimmedPassword);
                    await client.AuthenticateAsync(credentials);
                }
                else if (client.AuthenticationMechanisms.Contains("LOGIN"))
                {
                    _logger.LogInformation("Attempting LOGIN authentication...");
                    var credentials = new System.Net.NetworkCredential(_smtpOptions.Username, trimmedPassword);
                    await client.AuthenticateAsync(credentials);
                }
                else
                {
                    // Fallback to default authentication
                    _logger.LogInformation("Attempting default authentication...");
                    await client.AuthenticateAsync(_smtpOptions.Username, trimmedPassword);
                }
                
                _logger.LogInformation("Authentication successful");
            }
            catch (MailKit.Security.AuthenticationException authEx)
            {
                _logger.LogError(authEx, "Authentication failed with all methods. " +
                    "CRITICAL: Please verify the App Password is exactly correct. Common issues:\n" +
                    "1. Copy the App Password directly (no spaces before/after)\n" +
                    "2. App Password was generated AFTER 2-Step Verification was enabled\n" +
                    "3. App Password might have been revoked - check: https://myaccount.google.com/apppasswords\n" +
                    "4. Ensure you're using the App Password (16 chars), NOT your regular Gmail password\n" +
                    "5. Try deleting all App Passwords and creating a fresh one\n" +
                    "Current config: Host={Host}, Port={Port}, Username={Username}, PasswordLength={Length}",
                    _smtpOptions.Host, _smtpOptions.Port, _smtpOptions.Username, trimmedPassword.Length);
                await client.DisconnectAsync(true);
                return false;
            }
            
            _logger.LogInformation("Sending email...");
            
            // Send email
            await client.SendAsync(message);
            
            // Disconnect gracefully
            await client.DisconnectAsync(true);
            
            _logger.LogInformation("Email sent successfully to {Email}", to);
            return true;
        }
        catch (MailKit.Security.AuthenticationException authEx)
        {
            _logger.LogError(authEx, "SMTP Authentication failed for {Email}. This usually means: " +
                "1) The App Password is incorrect or expired, " +
                "2) 2-Step Verification is not enabled on your Gmail account, " +
                "3) Less secure app access needs to be enabled, or " +
                "4) The App Password contains spaces or extra characters. " +
                "Please generate a new App Password at: https://myaccount.google.com/apppasswords", 
                to);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}. Exception Type: {Type}, Message: {Message}", 
                to, ex.GetType().Name, ex.Message);
            return false;
        }
    }
}

