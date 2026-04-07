// Extension methods for ClaimsPrincipal — shared auth helpers used across controllers.
using System.Security.Claims;

namespace backend.Extensions;

public static class ClaimsPrincipalExtensions
{
    // Returns the authenticated user's integer ID, or null if the claim is missing or unparseable.
    public static int? GetUserId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
