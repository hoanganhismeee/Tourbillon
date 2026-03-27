// DTOs for the Favourites feature: state reads, collection management, and paginated watch queries.
using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

// Full state snapshot returned on GET /api/favourites — IDs only, cheap to compute.
public class FavouritesStateDto
{
    public int[] FavouriteWatchIds { get; set; } = Array.Empty<int>();
    public List<UserCollectionDto> Collections { get; set; } = new();
}

// Summary of a single user collection including its watch membership.
public class UserCollectionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int[] WatchIds { get; set; } = Array.Empty<int>();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Body for POST /api/favourites/collections.
public class CreateCollectionDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}

// Body for PATCH /api/favourites/collections/{id}.
public class RenameCollectionDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}

// Query parameters for GET /api/favourites/watches.
public class FavouriteWatchesQueryDto
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public int[]? CollectionIds { get; set; }
    public string? SortBy { get; set; } // "recent" | "brand" | "price_desc" | "price_asc"
}

// Paginated response for GET /api/favourites/watches.
public class FavouriteWatchesResponseDto
{
    public List<WatchDto> Watches { get; set; } = new();
    // Maps watchId → list of collectionIds the watch belongs to (for label pills on cards).
    public Dictionary<int, int[]> WatchCollectionMembership { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
