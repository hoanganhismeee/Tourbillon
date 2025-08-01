// This service handles user profile management operations, following Single Responsibility Principle.
using backend.Models;

namespace backend.Services;

public interface IUserProfileService
{
    Task<UserProfileDto?> GetUserProfileAsync(string userId);
    Task<(bool success, string message)> UpdateUserProfileAsync(string userId, UpdateUserDto updateDto);
} 