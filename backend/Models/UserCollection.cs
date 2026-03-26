// A named collection created by a user (e.g. "Dress Watches", "Grail List").
// One user can have many collections; each collection holds many watches via UserCollectionWatch.
namespace backend.Models;

public class UserCollection
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserCollectionWatch> Watches { get; set; } = new List<UserCollectionWatch>();
}
