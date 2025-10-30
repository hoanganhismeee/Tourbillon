// This controller handles user authentication operations (login, logout, register).
// It follows Single Responsibility Principle by focusing only on authentication concerns.
using backend.Models;
using backend.Services;
using backend.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthenticationController : ControllerBase
{
    private readonly SignInManager<User> _signInManager;
    private readonly IUserRegistrationService _userRegistrationService;
    private readonly IPasswordResetService _passwordResetService;
    private readonly ILogger<AuthenticationController> _logger;

    public AuthenticationController(
        SignInManager<User> signInManager,
        IUserRegistrationService userRegistrationService,
        IPasswordResetService passwordResetService,
        ILogger<AuthenticationController> logger)
    {
        _signInManager = signInManager;
        _userRegistrationService = userRegistrationService;
        _passwordResetService = passwordResetService;
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

    // POST: api/authentication/forgot-password
    // Sends a password reset email to the user.
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
            {
                return BadRequest(new { Message = "Email is required." });
            }

            var (success, message) = await _passwordResetService.RequestPasswordResetAsync(dto.Email);
            
            if (!success)
            {
                return BadRequest(new { Message = message });
            }

            return Ok(new { Message = message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in ForgotPassword");
            return StatusCode(500, new { Message = "An error occurred. Please try again later." });
        }
    }

    // POST: api/authentication/verify-code
    // Verifies the password reset code without resetting the password.
    [HttpPost("verify-code")]
    public async Task<IActionResult> VerifyCode(VerifyCodeDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Code))
            {
                return BadRequest(new { Message = "Email and code are required." });
            }

            var (success, message) = await _passwordResetService.VerifyCodeAsync(dto.Email, dto.Code);
            
            if (!success)
            {
                return BadRequest(new { Message = message });
            }

            return Ok(new { Message = message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in VerifyCode");
            return StatusCode(500, new { Message = "An error occurred. Please try again later." });
        }
    }

    // POST: api/authentication/reset-password
    // Resets the user's password using the provided 6-digit code.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.NewPassword))
            {
                return BadRequest(new { Message = "Email, code, and new password are required." });
            }

            var (success, message) = await _passwordResetService.ResetPasswordAsync(
                dto.Email,
                dto.Code,
                dto.NewPassword);

            if (!success)
            {
                return BadRequest(new { Message = message });
            }

            return Ok(new { Message = message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in ResetPassword");
            return StatusCode(500, new { Message = "An error occurred. Please try again later." });
        }
    }

    // POST: api/authentication/test-email
    // Test endpoint to verify email configuration (REMOVE IN PRODUCTION)
    [HttpPost("test-email")]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
            {
                return BadRequest(new { Message = "Email is required." });
            }

            _logger.LogInformation("Testing email send to {Email}", dto.Email);

            var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();
            var result = await emailService.SendEmailAsync(
                dto.Email,
                "Test Email from Tourbillon",
                "<h1>Test Email</h1><p>If you received this, your SMTP configuration is working correctly!</p>");

            if (result)
            {
                return Ok(new { Message = "Test email sent successfully! Check your inbox." });
            }
            else
            {
                return BadRequest(new { Message = "Failed to send test email. Check server logs for details." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test email");
            return StatusCode(500, new { Message = $"Error: {ex.Message}" });
        }
    }
} 