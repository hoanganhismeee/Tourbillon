using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

/// Interface for role management operations
public interface IRoleManagementService
{
    /// Assigns a role to a user
    /// Returns: (Success, Message)
    Task<(bool Success, string Message)> AssignRoleToUserAsync(string userId, string roleName);

    /// Removes a role from a user
    Task<(bool Success, string Message)> RemoveRoleFromUserAsync(string userId, string roleName);

    /// Gets all roles for a user
    Task<IList<string>> GetUserRolesAsync(string userId);

    /// Checks if a user has a specific role
    Task<bool> UserHasRoleAsync(string userId, string roleName);

    /// Creates a role if it doesn't exist
    Task<(bool Success, string Message)> EnsureRoleExistsAsync(string roleName);

    /// Assigns Admin role if the user's email matches the configured seed admin email
    Task AssignAdminIfConfiguredAsync(User user);
}

/// Service for managing user roles
public class RoleManagementService : IRoleManagementService
{
    private readonly UserManager<User> _userManager;
    private readonly RoleManager<IdentityRole<int>> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RoleManagementService> _logger;

    public RoleManagementService(
        UserManager<User> userManager,
        RoleManager<IdentityRole<int>> roleManager,
        IConfiguration configuration,
        ILogger<RoleManagementService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _logger = logger;
    }

    /// Assigns a role to a user
    public async Task<(bool Success, string Message)> AssignRoleToUserAsync(string userId, string roleName)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return (false, $"User with ID {userId} not found");

            // Ensure role exists
            var roleExists = await _roleManager.RoleExistsAsync(roleName);
            if (!roleExists)
                return (false, $"Role '{roleName}' does not exist");

            // Check if user already has this role
            var hasRole = await _userManager.IsInRoleAsync(user, roleName);
            if (hasRole)
                return (false, $"User already has role '{roleName}'");

            var result = await _userManager.AddToRoleAsync(user, roleName);
            if (result.Succeeded)
            {
                _logger.LogInformation("Assigned role '{Role}' to user {UserId}", roleName, userId);
                return (true, $"Successfully assigned role '{roleName}' to user");
            }

            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Failed to assign role '{Role}' to user {UserId}: {Errors}", roleName, userId, errors);
            return (false, $"Failed to assign role: {errors}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning role '{Role}' to user {UserId}", roleName, userId);
            return (false, $"Error assigning role: {ex.Message}");
        }
    }

    /// Removes a role from a user
    public async Task<(bool Success, string Message)> RemoveRoleFromUserAsync(string userId, string roleName)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return (false, $"User with ID {userId} not found");

            var hasRole = await _userManager.IsInRoleAsync(user, roleName);
            if (!hasRole)
                return (false, $"User does not have role '{roleName}'");

            var result = await _userManager.RemoveFromRoleAsync(user, roleName);
            if (result.Succeeded)
            {
                _logger.LogInformation("Removed role '{Role}' from user {UserId}", roleName, userId);
                return (true, $"Successfully removed role '{roleName}' from user");
            }

            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return (false, $"Failed to remove role: {errors}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing role '{Role}' from user {UserId}", roleName, userId);
            return (false, $"Error removing role: {ex.Message}");
        }
    }

    /// Gets all roles for a user
    public async Task<IList<string>> GetUserRolesAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return new List<string>();

        return await _userManager.GetRolesAsync(user);
    }

    /// Checks if a user has a specific role
    public async Task<bool> UserHasRoleAsync(string userId, string roleName)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return false;

        return await _userManager.IsInRoleAsync(user, roleName);
    }

    /// Creates a role if it doesn't exist
    public async Task<(bool Success, string Message)> EnsureRoleExistsAsync(string roleName)
    {
        try
        {
            var roleExists = await _roleManager.RoleExistsAsync(roleName);
            if (roleExists)
                return (true, $"Role '{roleName}' already exists");

            var result = await _roleManager.CreateAsync(new IdentityRole<int>(roleName));
            if (result.Succeeded)
            {
                _logger.LogInformation("Created role '{Role}'", roleName);
                return (true, $"Successfully created role '{roleName}'");
            }

            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Failed to create role '{Role}': {Errors}", roleName, errors);
            return (false, $"Failed to create role: {errors}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role '{Role}'", roleName);
            return (false, $"Error creating role: {ex.Message}");
        }
    }

    /// Assigns Admin role if the user's email matches AdminSettings:SeedAdminEmail
    public async Task AssignAdminIfConfiguredAsync(User user)
    {
        var seedEmail = _configuration["AdminSettings:SeedAdminEmail"];
        if (string.IsNullOrWhiteSpace(seedEmail)) return;
        if (!string.Equals(user.Email, seedEmail, StringComparison.OrdinalIgnoreCase)) return;

        if (!await _userManager.IsInRoleAsync(user, "Admin"))
        {
            var result = await _userManager.AddToRoleAsync(user, "Admin");
            if (result.Succeeded)
                _logger.LogInformation("Auto-assigned Admin role to configured seed user {Email}", user.Email);
            else
                _logger.LogError("Failed to auto-assign Admin role to {Email}: {Errors}",
                    user.Email, string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
}
