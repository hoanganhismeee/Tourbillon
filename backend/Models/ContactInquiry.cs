// Advisor inquiry submitted from the contact page (primarily for PoR watches)
namespace backend.Models;

public class ContactInquiry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int? WatchId { get; set; }
    public Watch? Watch { get; set; }

    // Snapshot for display/email even if watch or user changes
    public string UserEmail { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? WatchName { get; set; }
    public string? WatchReference { get; set; }

    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Received";
}
