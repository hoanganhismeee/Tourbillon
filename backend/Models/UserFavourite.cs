// Represents a single watch saved to a user's Favourites bucket.
// Composite PK (UserId, WatchId) ensures one row per user-watch pair.
namespace backend.Models;

public class UserFavourite
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int WatchId { get; set; }
    public Watch Watch { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
