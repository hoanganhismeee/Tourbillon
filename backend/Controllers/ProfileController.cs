// This controller handles user profile management operations.
// It follows Single Responsibility Principle by focusing only on profile concerns.
using backend.DTOs;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly IUserProfileService _userProfileService;
    private readonly IPasswordChangeService _passwordChangeService;
    private readonly IPasswordSetupService _passwordSetupService;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(
        UserManager<User> userManager,
        IUserProfileService userProfileService,
        IPasswordChangeService passwordChangeService,
        IPasswordSetupService passwordSetupService,
        ILogger<ProfileController> logger)
    {
        _userManager = userManager;
        _userProfileService = userProfileService;
        _passwordChangeService = passwordChangeService;
        _passwordSetupService = passwordSetupService;
        _logger = logger;
    }

    // GET: api/profile/me
    // Gets the currently authenticated user's profile information.
    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        var profile = await _userProfileService.GetUserProfileAsync(user.Id.ToString());
        if (profile == null)
        {
            return NotFound(new { Message = "Profile not found" });
        }

        return Ok(profile);
    }

    // PUT: api/profile/update
    // Updates the currently authenticated user's profile information.
    [HttpPut("update")]
    public async Task<IActionResult> UpdateProfile(UpdateUserDto updateDto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        // Handle password change separately if provided
        if (!string.IsNullOrEmpty(updateDto.NewPassword))
        {
            // Verify current password is provided
            if (string.IsNullOrEmpty(updateDto.CurrentPassword))
            {
                return BadRequest(new { Message = "Current password is required to change password" });
            }

            // Log the attempt for debugging
            _logger.LogInformation("Password change attempt for user: {Email}", user.Email);

            // Use secure password change service
            var (success, message) = await _passwordChangeService.ChangePasswordAsync(
                user, 
                updateDto.CurrentPassword, 
                updateDto.NewPassword
            );

            if (!success)
            {
                _logger.LogWarning("Password change failed for user: {Email} - {Message}", user.Email, message);
                return BadRequest(new { Message = message });
            }

            _logger.LogInformation("Password change successful for user: {Email}", user.Email);
            // Return success for password change only
            return Ok(new { Message = "Password changed successfully" });
        }

        // Update profile information only (no password change)
        var (updateSuccess, updateMessage) = await _userProfileService.UpdateUserProfileAsync(
            user.Id.ToString(), 
            updateDto
        );

        if (!updateSuccess)
        {
            return BadRequest(new { Message = updateMessage });
        }

        return Ok(new { Message = updateMessage });
    }

    // POST: api/profile/verify-current-password
    // Checks whether the provided password matches the current user's password; returns a boolean only.
    [HttpPost("verify-current-password")]
    public async Task<IActionResult> VerifyCurrentPassword([FromBody] VerifyPasswordDto dto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        var result = await _passwordChangeService.VerifyCurrentPasswordAsync(user, dto.Password);
        return Ok(new { valid = result.Success });
    }

    // POST: api/profile/reset-password
    // Sets a new password for the authenticated user without requiring the current password.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] AuthenticatedResetPasswordDto dto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        var result = await _passwordChangeService.ResetPasswordAuthenticatedAsync(user, dto.NewPassword);
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok();
    }

    // POST: api/profile/setup-password/request
    // Sends a one-time code to the user's email to initiate first-time password setup.
    [HttpPost("setup-password/request")]
    public async Task<IActionResult> RequestPasswordSetup()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        try
        {
            await _passwordSetupService.RequestAsync(user);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/profile/setup-password/confirm
    // Verifies the OTP code and sets the new password for the authenticated user.
    [HttpPost("setup-password/confirm")]
    public async Task<IActionResult> ConfirmPasswordSetup([FromBody] PasswordSetupConfirmDto dto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        var result = await _passwordSetupService.ConfirmAsync(user, dto.Code, dto.NewPassword);
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok();
    }
}