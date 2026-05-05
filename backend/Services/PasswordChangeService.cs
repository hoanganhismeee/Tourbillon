// This service handles secure password changes with proper logging and security measures
// It ensures passwords remain completely anonymous in logs while providing comprehensive
// security validation, rate limiting, and audit trail capabilities.
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using backend.Models;

namespace backend.Services;

public interface IPasswordChangeService
{
    Task<(bool Success, string Message)> ChangePasswordAsync(User user, string currentPassword, string newPassword);
    Task<(bool Success, string Message)> VerifyCurrentPasswordAsync(User user, string password);
    Task<(bool Success, string Message)> ResetPasswordAuthenticatedAsync(User user, string newPassword);
}

// Handles all password change operations with security measures including rate limiting,
// anonymous logging, and proper validation using ASP.NET Core Identity.
public class PasswordChangeService : IPasswordChangeService
{
    private readonly UserManager<User> _userManager;
    private readonly ILogger<PasswordChangeService> _logger;
    private readonly IPasswordChangeRateLimitService _rateLimitService;

    public PasswordChangeService(
        UserManager<User> userManager, 
        ILogger<PasswordChangeService> logger,
        IPasswordChangeRateLimitService rateLimitService)
    {
        _userManager = userManager;
        _logger = logger;
        _rateLimitService = rateLimitService;
    }

    // Securely changes a user's password with comprehensive security validation including rate limiting and anonymous logging
    public async Task<(bool Success, string Message)> ChangePasswordAsync(User user, string currentPassword, string newPassword)
    {
        try
        {
            // Check rate limiting first
            if (await _rateLimitService.IsRateLimitedAsync(user.Id.ToString()))
            {
                return (false, "Too many password change attempts. Please try again later.");
            }

            // Log password change attempt (without sensitive data)
            _logger.LogInformation("Password change attempt for user: {UserId} at {Timestamp}", 
                user.Id, DateTime.UtcNow);

            // Record the attempt for rate limiting
            await _rateLimitService.RecordAttemptAsync(user.Id.ToString());

            // Verify current password is correct
            var isCurrentPasswordValid = await _userManager.CheckPasswordAsync(user, currentPassword);
            if (!isCurrentPasswordValid)
            {
                _logger.LogWarning("Failed password change attempt for user: {UserId} - Invalid current password", user.Id);
                return (false, "Current password is incorrect");
            }

            // Validate new password requirements
            var passwordValidator = _userManager.PasswordValidators.FirstOrDefault();
            if (passwordValidator != null)
            {
                var validationResult = await passwordValidator.ValidateAsync(_userManager, user, newPassword);
                if (!validationResult.Succeeded)
                {
                    var errors = string.Join(", ", validationResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed password change attempt for user: {UserId} - Password validation failed: {Errors}", 
                        user.Id, errors);
                    return (false, errors);
                }
            }

            // Change password
            var changePasswordResult = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
            if (!changePasswordResult.Succeeded)
            {
                var errors = string.Join(", ", changePasswordResult.Errors.Select(e => e.Description));
                _logger.LogError("Failed password change for user: {UserId} - {Errors}", user.Id, errors);
                return (false, errors);
            }

            // Log successful password change (without sensitive data)
            _logger.LogInformation("Password successfully changed for user: {UserId} at {Timestamp}", 
                user.Id, DateTime.UtcNow);

            return (true, "Password changed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during password change for user: {UserId}", user.Id);
            return (false, "An unexpected error occurred during password change");
        }
    }

    // Verifies the current password without changing it — used for blur validation in the UI.
    public async Task<(bool Success, string Message)> VerifyCurrentPasswordAsync(User user, string password)
    {
        try
        {
            if (await _rateLimitService.IsRateLimitedAsync(user.Id.ToString()))
                return (false, "Too many attempts. Please try again later.");

            var valid = await _userManager.CheckPasswordAsync(user, password);
            if (!valid)
            {
                await _rateLimitService.RecordAttemptAsync(user.Id.ToString());
                _logger.LogWarning("Failed password verify for user: {UserId}", user.Id);
                return (false, "Incorrect password");
            }
            return (true, "Password verified");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error verifying password for user: {UserId}", user.Id);
            return (false, "An unexpected error occurred");
        }
    }

    // Resets a password for an already-authenticated user without requiring the current password.
    // Safe because the caller must be authenticated; no code or old password needed.
    public async Task<(bool Success, string Message)> ResetPasswordAuthenticatedAsync(User user, string newPassword)
    {
        try
        {
            _logger.LogInformation("Authenticated password reset for user: {UserId}", user.Id);

            if (await _rateLimitService.IsRateLimitedAsync(user.Id.ToString()))
                return (false, "Too many attempts. Please try again later.");

            await _rateLimitService.RecordAttemptAsync(user.Id.ToString());

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var result = await _userManager.ResetPasswordAsync(user, token, newPassword);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Password reset failed for user: {UserId} - {Errors}", user.Id, errors);
                return (false, errors);
            }

            _logger.LogInformation("Password reset successful for user: {UserId}", user.Id);
            return (true, "Password updated successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error resetting password for user: {UserId}", user.Id);
            return (false, "An unexpected error occurred");
        }
    }
}
