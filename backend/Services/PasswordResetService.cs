// Handles password reset operations using 6-digit codes with email sending
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class PasswordResetService : IPasswordResetService
{
    private readonly UserManager<User> _userManager;
    private readonly IEmailService _emailService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PasswordResetService> _logger;
    private const int CodeExpirationMinutes = 10;

    public PasswordResetService(
        UserManager<User> userManager,
        IEmailService emailService,
        IMemoryCache cache,
        ILogger<PasswordResetService> logger)
    {
        _userManager = userManager;
        _emailService = emailService;
        _cache = cache;
        _logger = logger;
    }

    // Generates a 6-digit code and sends it via email
    public async Task<(bool Success, string Message)> RequestPasswordResetAsync(string email)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                // Don't reveal if email exists - security best practice
                _logger.LogWarning("Password reset requested for non-existent email: {Email}", email);
                return (true, "If an account with that email exists, a verification code has been sent.");
            }

            // Generate 6-digit code
            var random = new Random();
            var code = random.Next(100000, 999999).ToString();
            
            // Store code in cache with expiration
            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CodeExpirationMinutes)
            };
            _cache.Set(cacheKey, code, cacheOptions);

            var emailBody = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .code {{ font-size: 32px; font-weight: bold; color: #bfa68a; text-align: center; padding: 20px; background: #f0e6d2; border-radius: 10px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class=""container"">
        <h2>Password Reset Verification Code</h2>
        <p>Hello {user.FirstName},</p>
        <p>You requested to reset your password for your Tourbillon account.</p>
        <p>Your verification code is:</p>
        <div class=""code"">{code}</div>
        <p>Enter this code on the password reset page to continue.</p>
        <p>This code will expire in {CodeExpirationMinutes} minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The Tourbillon Team</p>
    </div>
</body>
</html>";

            var emailSent = await _emailService.SendEmailAsync(
                user.Email!,
                "Your Tourbillon Password Reset Code",
                emailBody);

            if (!emailSent)
            {
                _logger.LogError("Failed to send password reset email to {Email}", email);
                return (false, "Failed to send email. Please try again later.");
            }

            _logger.LogInformation("Password reset code sent to {Email}", email);
            return (true, "If an account with that email exists, a verification code has been sent.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing password reset request for {Email}", email);
            return (false, "An error occurred. Please try again later.");
        }
    }

    // Verifies the 6-digit code without resetting the password
    public async Task<(bool Success, string Message)> VerifyCodeAsync(string email, string code)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                return (false, "Invalid verification code.");
            }

            // Verify code from cache
            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            if (!_cache.TryGetValue(cacheKey, out string? storedCode) || storedCode != code)
            {
                _logger.LogWarning("Invalid password reset code verification for {Email}", email);
                return (false, "Invalid or expired verification code. Please request a new code.");
            }

            _logger.LogInformation("Password reset code verified for {Email}", email);
            return (true, "Code verified successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying code for {Email}", email);
            return (false, "An error occurred. Please try again.");
        }
    }

    // Resets the user's password using the provided 6-digit code
    public async Task<(bool Success, string Message)> ResetPasswordAsync(string email, string code, string newPassword)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                return (false, "Invalid verification code.");
            }

            // Verify code from cache
            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            if (!_cache.TryGetValue(cacheKey, out string? storedCode) || storedCode != code)
            {
                _logger.LogWarning("Invalid password reset code for {Email}", email);
                return (false, "Invalid or expired verification code. Please request a new code.");
            }

            // Generate token and reset password
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var result = await _userManager.ResetPasswordAsync(user, token, newPassword);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Password reset failed for {Email}: {Errors}", email, errors);
                return (false, errors);
            }

            // Remove code from cache after successful reset
            _cache.Remove(cacheKey);

            _logger.LogInformation("Password reset successful for {Email}", email);
            return (true, "Password has been reset successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password for {Email}", email);
            return (false, "An error occurred. Please try again.");
        }
    }
}

