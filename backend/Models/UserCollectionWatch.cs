// Junction table linking watches to user-created collections.
// Composite PK (UserCollectionId, WatchId) ensures each watch appears at most once per collection.
namespace backend.Models;

public class UserCollectionWatch
{
    public int UserCollectionId { get; set; }
    public UserCollection UserCollection { get; set; } = null!;

    public int WatchId { get; set; }
    public Watch Watch { get; set; } = null!;

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
