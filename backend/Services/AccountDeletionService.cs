// This service implements secure account deletion with password verification.
// All DB writes run inside a single transaction — if any step fails, nothing is committed.
using backend.Database;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class AccountDeletionService : IAccountDeletionService
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly TourbillonContext _context;
    private readonly ILogger<AccountDeletionService> _logger;

    public AccountDeletionService(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        TourbillonContext context,
        ILogger<AccountDeletionService> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
        _logger = logger;
    }

    public async Task<(bool success, string message)> DeleteAccountAsync(string userId, DeleteAccountDto deleteDto)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return (false, "User not found");

        if (string.IsNullOrEmpty(deleteDto.CurrentPassword))
            return (false, "Current password is required to delete account");

        var isCurrentPasswordValid = await _userManager.CheckPasswordAsync(user, deleteDto.CurrentPassword);
        if (!isCurrentPasswordValid)
            return (false, "Current password is incorrect");

        if (deleteDto.CurrentPassword != deleteDto.ConfirmPassword)
            return (false, "Password confirmation does not match");

        // Wrap the delete in a transaction — if cascade deletes or any related cleanup
        // fails mid-way, the entire operation rolls back automatically on dispose.
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                // Transaction disposes without CommitAsync → auto-rollback
                var errorMessage = string.Join(", ", result.Errors.Select(e => e.Description));
                return (false, errorMessage);
            }

            await tx.CommitAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting account for userId: {UserId}", userId);
            return (false, "An unexpected error occurred during account deletion.");
        }

        // Sign out happens after the transaction commits — it is session state, not DB state
        await _signInManager.SignOutAsync();

        _logger.LogInformation("Account deleted successfully for userId: {UserId}", userId);
        return (true, "Account deleted successfully");
    }
} 