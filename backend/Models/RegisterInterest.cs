// Stores "Register Your Interest" submissions from the watch detail page
namespace backend.Models;

public class RegisterInterest
{
    public int Id { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }

    public int? WatchId { get; set; }
    public Watch? Watch { get; set; }

    // Personal details (snapshot — immutable after submission)
    public string Salutation { get; set; } = string.Empty;
    public string CustomerFirstName { get; set; } = string.Empty;
    public string CustomerLastName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? PhoneRegionCode { get; set; }

    // Customer's free-text request
    public string? Message { get; set; }

    // Watch snapshot (captured at submission time)
    public string? BrandName { get; set; }
    public string? CollectionName { get; set; }
    public string? WatchDescription { get; set; }
    public string? WatchReference { get; set; }

    public string Status { get; set; } = "Received";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
