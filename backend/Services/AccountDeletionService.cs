// This service implements secure account deletion with password verification.
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class AccountDeletionService : IAccountDeletionService
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly ILogger<AccountDeletionService> _logger;

    public AccountDeletionService(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        ILogger<AccountDeletionService> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    public async Task<(bool success, string message)> DeleteAccountAsync(string userId, DeleteAccountDto deleteDto)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return (false, "User not found");
            }

            // Verify current password is provided
            if (string.IsNullOrEmpty(deleteDto.CurrentPassword))
            {
                return (false, "Current password is required to delete account");
            }

            // Verify current password is correct
            var isCurrentPasswordValid = await _userManager.CheckPasswordAsync(user, deleteDto.CurrentPassword);
            if (!isCurrentPasswordValid)
            {
                return (false, "Current password is incorrect");
            }

            // Verify password confirmation matches
            if (deleteDto.CurrentPassword != deleteDto.ConfirmPassword)
            {
                return (false, "Password confirmation does not match");
            }

            // Delete the user account (this will cascade delete related data)
            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToList();
                var errorMessage = string.Join(", ", errors);
                return (false, errorMessage);
            }

            // Sign out the user after account deletion
            await _signInManager.SignOutAsync();

            _logger.LogInformation("Account deleted successfully for userId: {UserId}", userId);
            return (true, "Account deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting account for userId: {UserId}", userId);
            return (false, "An unexpected error occurred during account deletion.");
        }
    }
} 