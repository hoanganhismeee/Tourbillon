// This service implements user profile management with email uniqueness validation.
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class UserProfileService : IUserProfileService
{
    private readonly UserManager<User> _userManager;
    private readonly ILogger<UserProfileService> _logger;

    public UserProfileService(
        UserManager<User> userManager,
        ILogger<UserProfileService> logger)
    {
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<UserProfileDto?> GetUserProfileAsync(string userId)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return null;
            }

            var roles = await _userManager.GetRolesAsync(user);

            return new UserProfileDto
            {
                Email = user.Email ?? string.Empty,
                FirstName = user.FirstName,
                LastName = user.LastName,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                DateOfBirth = user.DateOfBirth,
                Address = user.Address,
                City = user.City,
                State = user.State,
                Country = user.Country,
                Roles = roles.ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user profile for userId: {UserId}", userId);
            return null;
        }
    }

    public async Task<(bool success, string message)> UpdateUserProfileAsync(string userId, UpdateUserDto updateDto)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return (false, "User not found");
            }

            // Check if email is being changed and if the new email already exists
            if (user.Email != updateDto.Email)
            {
                var existingUser = await _userManager.FindByEmailAsync(updateDto.Email);
                if (existingUser != null)
                {
                    return (false, "An account with this email already exists.");
                }
            }

            // Update user properties
            user.FirstName = updateDto.FirstName;
            user.LastName = updateDto.LastName;
            user.Email = updateDto.Email;
            user.UserName = updateDto.Email; // Update username as well
            user.PhoneNumber = updateDto.PhoneNumber;
            user.DateOfBirth = updateDto.DateOfBirth;
            user.Address = updateDto.Address;
            user.City = updateDto.City;
            user.State = updateDto.State;
            user.Country = updateDto.Country;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                // Handle specific validation errors
                var errors = result.Errors.Select(e => e.Description).ToList();
                var errorMessage = string.Join(", ", errors);
                
                // Provide specific message for duplicate email
                if (errors.Any(e => e.Contains("already taken") || e.Contains("already exists")))
                {
                    return (false, "An account with this email already exists.");
                }
                
                return (false, errorMessage);
            }

            _logger.LogInformation("User profile updated successfully for userId: {UserId}", userId);
            return (true, "User updated successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile for userId: {UserId}", userId);
            return (false, "An unexpected error occurred during profile update.");
        }
    }
} 
