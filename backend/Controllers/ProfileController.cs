// This controller handles user profile management operations.
// It follows Single Responsibility Principle by focusing only on profile concerns.
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
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(
        UserManager<User> userManager,
        IUserProfileService userProfileService,
        IPasswordChangeService passwordChangeService,
        ILogger<ProfileController> logger)
    {
        _userManager = userManager;
        _userProfileService = userProfileService;
        _passwordChangeService = passwordChangeService;
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
} 