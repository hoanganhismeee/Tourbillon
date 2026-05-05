// Passwordless email OTP sign-in service.
// Generates a 6-character alphanumeric code, stores it in Redis with a 10-minute TTL,
// and delivers it via IEmailService. VerifyAsync finds or auto-creates the user on success.
using System.Security.Cryptography;
using backend.Models;
using Microsoft.AspNetCore.Identity;

namespace backend.Services;

public interface IMagicLoginService
{
    Task RequestAsync(string email);
    Task<(User? user, bool isNewAccount)> VerifyAsync(string email, string code);
}

public class MagicLoginService : IMagicLoginService
{
    private readonly UserManager<User> _userManager;
    private readonly IEmailService _emailService;
    private readonly IRedisService _redis;
    private readonly IRoleManagementService _roleManagement;
    private readonly ILogger<MagicLoginService> _logger;

    // Unambiguous charset: no 0/O, 1/I/L to avoid visual confusion in email
    private const string CodeChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 6;
    private const int TtlMinutes = 10;

    public MagicLoginService(
        UserManager<User> userManager,
        IEmailService emailService,
        IRedisService redis,
        IRoleManagementService roleManagement,
        ILogger<MagicLoginService> logger)
    {
        _userManager = userManager;
        _emailService = emailService;
        _redis = redis;
        _roleManagement = roleManagement;
        _logger = logger;
    }

    // Generates and emails a one-time code. Always returns 200 — never reveals if email exists.
    public async Task RequestAsync(string email)
    {
        var cacheKey = $"magic:{email.ToLowerInvariant()}";

        // Generate fresh code each request (unlike password reset, no reuse — keeps it simpler)
        var code = GenerateCode();
        await _redis.SetStringAsync(cacheKey, code, TimeSpan.FromMinutes(TtlMinutes));

        // Look up user for a personalised greeting; proceed even if not found (auto-create on verify)
        var user = await _userManager.FindByEmailAsync(email);
        var firstName = user?.FirstName ?? "there";

        var title = "Your Tourbillon sign-in code";
        var greeting = System.Net.WebUtility.HtmlEncode(firstName);
        var innerRows = $@"
                <tr><td style=""padding:36px 40px 8px;"">
                    <h2 style=""margin:0 0 16px;color:#1a1613;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;"">Your sign-in code</h2>
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:15px;line-height:1.7;"">Hello {greeting},</p>
                    <p style=""margin:0 0 8px;color:#4a4440;font-size:15px;line-height:1.7;"">Use the code below to sign in to your Tourbillon account.</p>
                </td></tr>
{TransactionalEmailLayout.CodePillRow(code)}
                <tr><td style=""padding:8px 40px 36px;"">
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:14px;line-height:1.7;"">This code expires in {TtlMinutes} minutes. If you didn't request this, you can safely ignore it.</p>
                    <p style=""margin:0;color:#4a4440;font-size:14px;line-height:1.7;"">Best regards,<br>Tourbillon</p>
                </td></tr>";
        var emailBody = TransactionalEmailLayout.BuildCustomerEmail(title, innerRows);

        var sent = await _emailService.SendEmailAsync(email, title, emailBody);
        if (!sent)
            _logger.LogError("Magic login: failed to send code to {Email}", email);
        else
            _logger.LogInformation("Magic login: code sent to {Email}", email);
    }

    // Validates the OTP. Returns the User (creating one if the email is new) or null on mismatch/expiry.
    public async Task<(User? user, bool isNewAccount)> VerifyAsync(string email, string code)
    {
        var cacheKey = $"magic:{email.ToLowerInvariant()}";

        var storedCode = await _redis.GetStringAsync(cacheKey);
        if (storedCode == null || storedCode != code.ToUpperInvariant())
        {
            _logger.LogWarning("Magic login: invalid or expired code for {Email}", email);
            return (null, false);
        }

        // Consume the code — one-time use only
        await _redis.RemoveAsync(cacheKey);

        var user = await _userManager.FindByEmailAsync(email);
        var isNewAccount = false;
        if (user == null)
        {
            // Auto-create a minimal passwordless account; user can add a password later
            user = new User { UserName = email, Email = email, FirstName = string.Empty, LastName = string.Empty };
            var result = await _userManager.CreateAsync(user);
            if (!result.Succeeded)
            {
                _logger.LogError("Magic login: failed to create user {Email}: {Errors}",
                    email, string.Join(", ", result.Errors.Select(e => e.Description)));
                return (null, false);
            }
            isNewAccount = true;
            _logger.LogInformation("Magic login: auto-created account for {Email}", email);
        }

        await _roleManagement.AssignAdminIfConfiguredAsync(user);
        return (user, isNewAccount);
    }

    private static string GenerateCode()
    {
        var chars = new char[CodeLength];
        for (int i = 0; i < CodeLength; i++)
            chars[i] = CodeChars[RandomNumberGenerator.GetInt32(CodeChars.Length)];
        return new string(chars);
    }
}
