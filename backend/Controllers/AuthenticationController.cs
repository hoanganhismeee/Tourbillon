// Handles user authentication operations (login, logout, register)
// Follows Single Responsibility Principle by focusing only on authentication concerns
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthenticationController : ControllerBase
{
    private readonly SignInManager<User> _signInManager;
    private readonly UserManager<User> _userManager;
    private readonly IUserRegistrationService _userRegistrationService;
    private readonly IEmailService _emailService;
    private readonly ILogger<AuthenticationController> _logger;

    public AuthenticationController(
        SignInManager<User> signInManager,
        UserManager<User> userManager,
        IUserRegistrationService userRegistrationService,
        IEmailService emailService,
        ILogger<AuthenticationController> logger)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _userRegistrationService = userRegistrationService;
        _emailService = emailService;
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

    // POST: api/authentication/email-login
    // Sends login link via email for passwordless authentication.
    [HttpPost("email-login")]
    public async Task<IActionResult> EmailLogin([FromBody] EmailLoginDto emailLoginDto)
    {
        var user = await _userManager.FindByEmailAsync(emailLoginDto.Email);
        if (user == null)
        {
            // Don't reveal if user exists or not for security
            return Ok(new { Message = "If an account with this email exists, a login link has been sent." });
        }

        var token = await _userManager.GenerateUserTokenAsync(user, "Default", "EmailLogin");
        var callbackUrl = $"{Request.Scheme}://{Request.Host}/reset-password?token={token}&type=login";

        var emailSent = await _emailService.SendLoginLinkAsync(user.Email!, token, callbackUrl);
        
        if (emailSent)
        {
            _logger.LogInformation("Login link sent to: {Email}", emailLoginDto.Email);
            return Ok(new { Message = "If an account with this email exists, a login link has been sent." });
        }

        return BadRequest(new { Message = "Failed to send login link. Please try again." });
    }

    // POST: api/authentication/verify-email-token
    // Verifies email token and signs user in.
    [HttpPost("verify-email-token")]
    public async Task<IActionResult> VerifyEmailToken([FromBody] ResetPasswordDto resetDto)
    {
        var user = await _userManager.FindByEmailAsync(resetDto.Token.Split(':')[0]); // Token format: email:token
        if (user == null)
        {
            return BadRequest(new { Message = "Invalid token." });
        }

        var isValid = await _userManager.VerifyUserTokenAsync(user, "Default", "EmailLogin", resetDto.Token);
        if (!isValid)
        {
            return BadRequest(new { Message = "Invalid or expired token." });
        }

        // Sign in the user
        await _signInManager.SignInAsync(user, isPersistent: false);
        
        // Mark that user logged in via email (no password required for changes)
        user.HasPassword = false;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("User logged in via email: {Email}", user.Email);
        return Ok(new { Message = "Login successful" });
    }

    // POST: api/authentication/forgot-password
    // Sends password reset link via email.
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto forgotPasswordDto)
    {
        var user = await _userManager.FindByEmailAsync(forgotPasswordDto.EmailOrPhone);
        if (user == null)
        {
            // Don't reveal if user exists or not for security
            return Ok(new { Message = "If an account with this email exists, a password reset link has been sent." });
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var callbackUrl = $"{Request.Scheme}://{Request.Host}/reset-password?token={token}&type=reset";

        var emailSent = await _emailService.SendPasswordResetLinkAsync(user.Email!, token, callbackUrl);
        
        if (emailSent)
        {
            _logger.LogInformation("Password reset link sent to: {Email}", forgotPasswordDto.EmailOrPhone);
            return Ok(new { Message = "If an account with this email exists, a password reset link has been sent." });
        }

        return BadRequest(new { Message = "Failed to send password reset link. Please try again." });
    }

    // POST: api/authentication/reset-password
    // Resets user password using token.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto resetDto)
    {
        if (resetDto.NewPassword != resetDto.ConfirmPassword)
        {
            return BadRequest(new { Message = "Passwords do not match." });
        }

        var user = await _userManager.FindByEmailAsync(resetDto.Token.Split(':')[0]); // Token format: email:token
        if (user == null)
        {
            return BadRequest(new { Message = "Invalid token." });
        }

        var result = await _userManager.ResetPasswordAsync(user, resetDto.Token, resetDto.NewPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { Message = string.Join(", ", errors) });
        }

        // Mark that user now has a password
        user.HasPassword = true;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Password reset successful for: {Email}", user.Email);
        return Ok(new { Message = "Password has been reset successfully." });
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