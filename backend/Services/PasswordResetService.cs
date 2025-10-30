// Service for password reset operations using 6-digit verification codes
// Implements security best practices: rate limiting, code expiration, and fire-and-forget email delivery
// Follows SOLID principles with single responsibility for password reset workflow
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
    private const int CooldownSeconds = 30; // Prevent spam: minimum time between requests

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

    // Generates a 6-digit verification code and sends it via email
    // Implements cooldown to prevent spam and reuses existing codes to avoid confusion
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

            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            var cooldownKey = $"password_reset_cooldown_{email.ToLowerInvariant()}";

            // Check cooldown to prevent spam (30-second limit between requests)
            if (_cache.TryGetValue(cooldownKey, out _))
            {
                _logger.LogWarning("Cooldown in effect for password reset request: {Email}", email);
                return (false, $"Please wait {CooldownSeconds} seconds before requesting another code.");
            }

            // Check if a valid code already exists - reuse it instead of generating a new one
            string code;
            if (_cache.TryGetValue(cacheKey, out string? existingCode))
            {
                code = existingCode!;
                _logger.LogInformation("Reusing existing password reset code for {Email}", email);
            }
            else
            {
                // Generate new 6-digit code
                var random = new Random();
                code = random.Next(100000, 999999).ToString();

                // Store code in cache with expiration
                var cacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CodeExpirationMinutes)
                };
                _cache.Set(cacheKey, code, cacheOptions);
                _logger.LogInformation("Generated new password reset code for {Email}", email);
            }

            // Set cooldown timer to prevent rapid successive requests
            var cooldownOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(CooldownSeconds)
            };
            _cache.Set(cooldownKey, true, cooldownOptions);

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

            // Fire-and-forget email sending for instant user feedback
            // Email is sent in background without blocking the response
            var userEmail = user.Email!;
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendEmailAsync(
                        userEmail,
                        "Your Tourbillon Password Reset Code",
                        emailBody);
                    _logger.LogInformation("Password reset code email sent successfully to {Email}", email);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send password reset email to {Email} in background task", email);
                }
            });

            _logger.LogInformation("Password reset code generated for {Email}, email queued for delivery", email);
            return (true, "If an account with that email exists, a verification code has been sent.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing password reset request for {Email}", email);
            return (false, "An error occurred. Please try again later.");
        }
    }

    // Verifies if the provided 6-digit code matches the cached code for the email
    // Does not reset password, only validates the code for multi-step flow
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

    // Resets the user's password after verifying the 6-digit code
    // Removes the code from cache after successful reset to prevent reuse
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

