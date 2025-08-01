// This service implements user registration logic with email uniqueness validation.
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public class UserRegistrationService : IUserRegistrationService
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly ILogger<UserRegistrationService> _logger;

    public UserRegistrationService(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        ILogger<UserRegistrationService> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    public async Task<(bool success, string message)> RegisterUserAsync(RegisterDto registerDto)
    {
        try
        {
            // Check if user already exists
            var existingUser = await _userManager.FindByEmailAsync(registerDto.Email);
            if (existingUser != null)
            {
                return (false, "An account with this email already exists.");
            }

            var user = new User
            {
                UserName = registerDto.Email,
                Email = registerDto.Email,
                FirstName = registerDto.FirstName,
                LastName = registerDto.LastName,
                PhoneNumber = registerDto.PhoneNumber
            };

            var result = await _userManager.CreateAsync(user, registerDto.Password);

            if (!result.Succeeded)
            {
                // Handle specific validation errors
                var errors = result.Errors.Select(e => e.Description).ToList();
                var errorMessage = string.Join(", ", errors);
                
                // Provide specific message for duplicate email (in case the above check didn't catch it)
                if (errors.Any(e => e.Contains("already taken") || e.Contains("already exists")))
                {
                    return (false, "An account with this email already exists.");
                }
                
                return (false, errorMessage);
            }

            await _signInManager.SignInAsync(user, isPersistent: false);
            _logger.LogInformation("User registered successfully: {Email}", registerDto.Email);
            
            return (true, "Registration successful");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during user registration for email: {Email}", registerDto.Email);
            return (false, "An unexpected error occurred during registration.");
        }
    }
} 