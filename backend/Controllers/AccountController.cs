// This controller handles account deletion operations.
// It follows Single Responsibility Principle by focusing only on account deletion concerns.
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
    private readonly IAccountDeletionService _accountDeletionService;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<User> userManager,
        IAccountDeletionService accountDeletionService,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _accountDeletionService = accountDeletionService;
        _logger = logger;
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

        var (success, message) = await _accountDeletionService.DeleteAccountAsync(
            user.Id.ToString(), 
            deleteDto
        );

        if (!success)
        {
            return BadRequest(new { Message = message });
        }

        return Ok(new { Message = message });
    }
} 