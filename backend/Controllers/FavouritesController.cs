// Handles all favourites and user collection endpoints.
// All routes require authentication; uses GetCurrentUserId() helper for safe claim extraction.
using System.Security.Claims;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FavouritesController : ControllerBase
{
    private readonly IFavouritesService _favouritesService;

    public FavouritesController(IFavouritesService favouritesService)
    {
        _favouritesService = favouritesService;
    }

    // GET /api/favourites — returns IDs of all favourited watches + all collection summaries
    [HttpGet]
    public async Task<IActionResult> GetState()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var state = await _favouritesService.GetStateAsync(userId.Value);
        return Ok(state);
    }

    // POST /api/favourites/{watchId} — add a watch to Favourites (idempotent)
    [HttpPost("{watchId:int}")]
    public async Task<IActionResult> AddFavourite(int watchId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        await _favouritesService.AddFavouriteAsync(userId.Value, watchId);
        return Ok();
    }

    // DELETE /api/favourites/{watchId} — remove a watch from Favourites
    [HttpDelete("{watchId:int}")]
    public async Task<IActionResult> RemoveFavourite(int watchId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        await _favouritesService.RemoveFavouriteAsync(userId.Value, watchId);
        return Ok();
    }

    // GET /api/favourites/watches — paginated watch grid for /favourites page
    [HttpGet("watches")]
    public async Task<IActionResult> GetFavouriteWatches([FromQuery] FavouriteWatchesQueryDto query)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var result = await _favouritesService.GetFavouriteWatchesAsync(userId.Value, query);
        return Ok(result);
    }

    // POST /api/favourites/collections — create a new named collection
    [HttpPost("collections")]
    public async Task<IActionResult> CreateCollection([FromBody] CreateCollectionDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var collection = await _favouritesService.CreateCollectionAsync(userId.Value, dto.Name);
            return Ok(collection);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // DELETE /api/favourites/collections/{id} — delete a collection (owner only)
    [HttpDelete("collections/{id:int}")]
    public async Task<IActionResult> DeleteCollection(int id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _favouritesService.DeleteCollectionAsync(userId.Value, id);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // PUT /api/favourites/collections/{id}/watches/{watchId} — add watch to collection
    [HttpPut("collections/{id:int}/watches/{watchId:int}")]
    public async Task<IActionResult> AddToCollection(int id, int watchId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _favouritesService.AddToCollectionAsync(userId.Value, id, watchId);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // DELETE /api/favourites/collections/{id}/watches/{watchId} — remove watch from collection
    [HttpDelete("collections/{id:int}/watches/{watchId:int}")]
    public async Task<IActionResult> RemoveFromCollection(int id, int watchId)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _favouritesService.RemoveFromCollectionAsync(userId.Value, id, watchId);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
