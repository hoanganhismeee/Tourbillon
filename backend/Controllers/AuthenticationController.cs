// This controller handles user authentication operations (login, logout, register).
// It follows Single Responsibility Principle by focusing only on authentication concerns.
using System.Security.Claims;
using backend.Models;
using backend.Services;
using backend.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthenticationController : ControllerBase
{
    private readonly SignInManager<User> _signInManager;
    private readonly UserManager<User> _userManager;
    private readonly RoleManager<IdentityRole<int>> _roleManager;
    private readonly IUserRegistrationService _userRegistrationService;
    private readonly IPasswordResetService _passwordResetService;
    private readonly IMagicLoginService _magicLoginService;
    private readonly IRoleManagementService _roleManagement;
    private readonly ILogger<AuthenticationController> _logger;

    public AuthenticationController(
        SignInManager<User> signInManager,
        UserManager<User> userManager,
        RoleManager<IdentityRole<int>> roleManager,
        IUserRegistrationService userRegistrationService,
        IPasswordResetService passwordResetService,
        IMagicLoginService magicLoginService,
        IRoleManagementService roleManagement,
        ILogger<AuthenticationController> logger)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _roleManager = roleManager;
        _userRegistrationService = userRegistrationService;
        _passwordResetService = passwordResetService;
        _magicLoginService = magicLoginService;
        _roleManagement = roleManagement;
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

    // POST: api/authentication/setup-first-admin
    // Initial setup endpoint to promote the first authenticated user to Admin role
    // Only works if no admins exist yet (one-time setup)
    // After first admin is assigned, this endpoint returns an error
    [HttpPost("setup-first-admin")]
    [Authorize]
    public async Task<IActionResult> SetupFirstAdmin()
    {
        try
        {
            // Check if Admin role exists
            var adminRoleExists = await _roleManager.RoleExistsAsync("Admin");
            if (!adminRoleExists)
            {
                return BadRequest(new { Message = "Admin role has not been created yet. Please try again later." });
            }

            // Check if any admin users already exist
            var adminRole = await _roleManager.FindByNameAsync("Admin");
            var adminUsersCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;

            if (adminUsersCount > 0)
            {
                return BadRequest(new
                {
                    Message = "Admin already exists. For security reasons, only the first user can use this endpoint."
                });
            }

            // Get the current authenticated user
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized(new { Message = "User not found" });
            }

            // Assign Admin role to current user
            var result = await _userManager.AddToRoleAsync(currentUser, "Admin");
            if (result.Succeeded)
            {
                _logger.LogInformation("User {Email} has been promoted to Admin role during initial setup", currentUser.Email);
                return Ok(new
                {
                    Success = true,
                    Message = $"Successfully promoted {currentUser.Email} to Admin role",
                    Email = currentUser.Email,
                    Role = "Admin"
                });
            }

            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Failed to promote user {Email} to Admin: {Errors}", currentUser.Email, errors);
            return BadRequest(new { Message = $"Failed to assign Admin role: {errors}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SetupFirstAdmin");
            return StatusCode(500, new { Message = $"Error during admin setup: {ex.Message}" });
        }
    }

    // GET: api/authentication/google
    // Initiates Google OAuth flow — full browser redirect, not XHR.
    [HttpGet("google")]
    [AllowAnonymous]
    public IActionResult GoogleLogin()
    {
        // redirectUrl is where the OAuth middleware redirects AFTER it processes /signin-google
        var redirectUrl = Url.Action(nameof(GoogleCallback), "Authentication");
        var properties  = _signInManager.ConfigureExternalAuthenticationProperties("Google", redirectUrl);
        return Challenge(properties, "Google");
    }

    // GET: api/authentication/google-callback
    // Receives the user after the Google middleware has validated the auth code and stored
    // the external login info in a temporary cookie. Finds or creates a local account,
    // signs the user in, and redirects to the frontend.
    [HttpGet("google-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback()
    {
        const string frontendBase = "http://localhost:3000";

        var info = await _signInManager.GetExternalLoginInfoAsync();
        if (info == null)
            return Redirect($"{frontendBase}/login?error=google-failed");

        var email = info.Principal.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email))
            return Redirect($"{frontendBase}/login?error=no-email");

        // Find existing account by email — avoid duplicate users for same address
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            // Auto-create a passwordless account (user can add a password later via Edit Details)
            var firstName = info.Principal.FindFirstValue(ClaimTypes.GivenName) ?? string.Empty;
            var lastName  = info.Principal.FindFirstValue(ClaimTypes.Surname)   ?? string.Empty;
            user = new User { UserName = email, Email = email, FirstName = firstName, LastName = lastName };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                _logger.LogError("Google OAuth: failed to create user {Email}: {Errors}",
                    email, string.Join(", ", createResult.Errors.Select(e => e.Description)));
                return Redirect($"{frontendBase}/login?error=create-failed");
            }
        }

        // Sign in and set the application cookie
        await _signInManager.SignInAsync(user, isPersistent: false);
        await _roleManagement.AssignAdminIfConfiguredAsync(user);
        _logger.LogInformation("Google OAuth sign-in: {Email}", email);
        return Redirect($"{frontendBase}/auth/callback");
    }

    // POST: api/authentication/magic-login/request
    // Step 1: Send a 6-char OTP to the given email. Always 200 — never reveals if email exists.
    [HttpPost("magic-login/request")]
    [AllowAnonymous]
    public async Task<IActionResult> MagicLoginRequest([FromBody] MagicLoginRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { Message = "Email is required." });

        await _magicLoginService.RequestAsync(dto.Email.Trim());
        return Ok(new { Message = "If that email is valid, a sign-in code has been sent." });
    }

    // POST: api/authentication/magic-login/verify
    // Step 2: Validate the OTP, sign the user in (creating account if new), return 200.
    [HttpPost("magic-login/verify")]
    [AllowAnonymous]
    public async Task<IActionResult> MagicLoginVerify([FromBody] MagicLoginVerifyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(new { Message = "Email and code are required." });

        var user = await _magicLoginService.VerifyAsync(dto.Email.Trim(), dto.Code.Trim());
        if (user == null)
            return Unauthorized(new { Message = "Invalid or expired code." });

        await _signInManager.SignInAsync(user, isPersistent: false);
        _logger.LogInformation("Magic login sign-in: {Email}", user.Email);
        return Ok(new { Message = "Sign-in successful." });
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