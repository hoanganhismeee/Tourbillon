// This controller handles user authentication, including registration, login, and logout.
// It provides secure password change functionality using the PasswordChangeService
// to ensure passwords remain anonymous and protected against various attack vectors.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly IPasswordChangeService _passwordChangeService;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<User> userManager, 
        SignInManager<User> signInManager,
        IPasswordChangeService passwordChangeService,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _passwordChangeService = passwordChangeService;
        _logger = logger;
    }

    // POST: api/account/register
    // Registers a new user.
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto registerDto)
    {
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
            return BadRequest(result.Errors);
        }

        await _signInManager.SignInAsync(user, isPersistent: false);
        return Ok(new { Message = "Registration successful" });
    }

    // POST: api/account/login
    // Authenticates a user and signs them in.
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto loginDto)
    {
        var result = await _signInManager.PasswordSignInAsync(loginDto.Email, loginDto.Password, isPersistent: false, lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return Unauthorized(new { Message = "Invalid login attempt." });
        }

        return Ok(new { Message = "Login successful" });
    }

    // POST: api/account/logout
    // Signs the current user out.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { Message = "Logout successful" });
    }

    // GET: api/account/me
    // Gets the currently authenticated user's information.
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            user.Email,
            user.FirstName,
            user.LastName,
            user.PhoneNumber,
            user.Address,
            user.City,
            user.State,
            user.Country
        });
    }

    // PUT: api/account/update
    // Updates the currently authenticated user's information with secure password change support.
    [HttpPut("update")]
    public async Task<IActionResult> Update(UpdateUserDto updateDto)
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

        // Update basic information only (no password change)
        user.FirstName = updateDto.FirstName;
        user.LastName = updateDto.LastName;
        user.Email = updateDto.Email;
        user.UserName = updateDto.Email; // Update username as well
        user.PhoneNumber = updateDto.PhoneNumber;
        user.Address = updateDto.Address;
        user.City = updateDto.City;
        user.State = updateDto.State;
        user.Country = updateDto.Country;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok(new { Message = "User updated successfully" });
    }


    // DELETE: api/account/delete
    // Deletes the currently authenticated user's account with password verification.
    [HttpDelete("delete")]
    public async Task<IActionResult> DeleteAccount(DeleteAccountDto deleteDto)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        // Verify current password is provided
        if (string.IsNullOrEmpty(deleteDto.CurrentPassword))
        {
            return BadRequest(new { Message = "Current password is required to delete account" });
        }

        // Verify current password is correct
        var isCurrentPasswordValid = await _userManager.CheckPasswordAsync(user, deleteDto.CurrentPassword);
        if (!isCurrentPasswordValid)
        {
            return BadRequest(new { Message = "Current password is incorrect" });
        }

        // Verify password confirmation matches
        if (deleteDto.CurrentPassword != deleteDto.ConfirmPassword)
        {
            return BadRequest(new { Message = "Password confirmation does not match" });
        }

        // Delete the user account (this will cascade delete related data)
        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        // Sign out the user after account deletion
        await _signInManager.SignOutAsync();

        return Ok(new { Message = "Account deleted successfully" });
    }
} 