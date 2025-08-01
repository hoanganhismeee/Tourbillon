// This controller handles user authentication operations (login, logout, register).
// It follows Single Responsibility Principle by focusing only on authentication concerns.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthenticationController : ControllerBase
{
    private readonly SignInManager<User> _signInManager;
    private readonly IUserRegistrationService _userRegistrationService;
    private readonly ILogger<AuthenticationController> _logger;

    public AuthenticationController(
        SignInManager<User> signInManager,
        IUserRegistrationService userRegistrationService,
        ILogger<AuthenticationController> logger)
    {
        _signInManager = signInManager;
        _userRegistrationService = userRegistrationService;
        _logger = logger;
    }

    // POST: api/authentication/register
    // Registers a new user.
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto registerDto)
    {
        var (success, message) = await _userRegistrationService.RegisterUserAsync(registerDto);
        
        if (!success)
        {
            return BadRequest(new { Message = message });
        }

        return Ok(new { Message = message });
    }

    // POST: api/authentication/login
    // Authenticates a user and signs them in.
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto loginDto)
    {
        var result = await _signInManager.PasswordSignInAsync(
            loginDto.Email, 
            loginDto.Password, 
            isPersistent: false, 
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return Unauthorized(new { Message = "Invalid login attempt." });
        }

        _logger.LogInformation("User logged in successfully: {Email}", loginDto.Email);
        return Ok(new { Message = "Login successful" });
    }

    // POST: api/authentication/logout
    // Signs the current user out.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        _logger.LogInformation("User logged out successfully");
        return Ok(new { Message = "Logout successful" });
    }
} 