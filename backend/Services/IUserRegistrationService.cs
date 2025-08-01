// This service handles user registration logic, following Single Responsibility Principle.
using backend.Models;

namespace backend.Services;

public interface IUserRegistrationService
{
    Task<(bool success, string message)> RegisterUserAsync(RegisterDto registerDto);
} 