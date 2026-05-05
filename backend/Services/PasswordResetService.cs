// password reset operations using 6-digit verification codes
// Implements security best practices: cooldown, code expiration via Redis TTL, email delivery

using System.Net;
using System.Security.Cryptography;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class PasswordResetService : IPasswordResetService
{
    private readonly UserManager<User> _userManager;
    private readonly IEmailService _emailService;
    private readonly IRedisService _redis;
    private readonly ILogger<PasswordResetService> _logger;
    private const int CodeExpirationMinutes = 10;
    private const int CooldownSeconds = 30; // Prevent spam: minimum time between requests

    public PasswordResetService(
        UserManager<User> userManager,
        IEmailService emailService,
        IRedisService redis,
        ILogger<PasswordResetService> logger)
    {
        _userManager = userManager;
        _emailService = emailService;
        _redis = redis;
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
                return (true, "A verification code has been sent to your email.");
            }

            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            var cooldownKey = $"password_reset_cooldown_{email.ToLowerInvariant()}";

            // Check cooldown to prevent spam (30-second limit between requests)
            if (await _redis.GetStringAsync(cooldownKey) != null)
            {
                _logger.LogWarning("Cooldown in effect for password reset request: {Email}", email);
                return (false, $"Please wait {CooldownSeconds} seconds before requesting another code.");
            }

            // Check if a valid code already exists — reuse it instead of generating a new one
            string code;
            var existingCode = await _redis.GetStringAsync(cacheKey);
            if (existingCode != null)
            {
                code = existingCode;
                _logger.LogInformation("Reusing existing password reset code for {Email}", email);
            }
            else
            {
                // Generate new 6-digit code and store with TTL
                code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
                await _redis.SetStringAsync(cacheKey, code, TimeSpan.FromMinutes(CodeExpirationMinutes));
                _logger.LogInformation("Generated new password reset code for {Email}", email);
            }

            // Set cooldown timer to prevent rapid successive requests
            await _redis.SetStringAsync(cooldownKey, "1", TimeSpan.FromSeconds(CooldownSeconds));

                var docTitle = "Your Tourbillon password reset code";
                var greet = string.IsNullOrWhiteSpace(user.FirstName) ? "there" : user.FirstName;
                var greeting = WebUtility.HtmlEncode(greet);
                var innerRows = $@"
                <tr><td style=""padding:36px 40px 8px;"">
                    <h2 style=""margin:0 0 16px;color:#1a1613;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;"">Password reset verification</h2>
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:15px;line-height:1.7;"">Hello {greeting},</p>
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:15px;line-height:1.7;"">You requested to reset your password for your Tourbillon account. Use the code below on the password reset page to continue.</p>
                </td></tr>
{TransactionalEmailLayout.CodePillRow(code)}
                <tr><td style=""padding:8px 40px 36px;"">
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:14px;line-height:1.7;"">This code expires in {CodeExpirationMinutes} minutes.</p>
                    <p style=""margin:0 0 12px;color:#4a4440;font-size:14px;line-height:1.7;"">If you didn't request this password reset, you can safely ignore this email.</p>
                    <p style=""margin:0;color:#4a4440;font-size:14px;line-height:1.7;"">Best regards,<br>Tourbillon</p>
                </td></tr>";
                var emailBody = TransactionalEmailLayout.BuildCustomerEmail(docTitle, innerRows);

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

            // Verify code from Redis
            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            var storedCode = await _redis.GetStringAsync(cacheKey);
            if (storedCode == null || storedCode != code)
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

            // Verify code from Redis
            var cacheKey = $"password_reset_{email.ToLowerInvariant()}";
            var storedCode = await _redis.GetStringAsync(cacheKey);
            if (storedCode == null || storedCode != code)
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

            // Remove code from Redis after successful reset
            await _redis.RemoveAsync(cacheKey);

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

