// Stores browsing events for Watch DNA behavioral profile generation.
// UserId is null for anonymous users; AnonymousId links anonymous events to an account on login.
namespace backend.Models;

public class UserBrowsingEvent
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? AnonymousId { get; set; }
    public string EventType { get; set; } = string.Empty;  // watch_view | brand_view | collection_view | search
    public int? EntityId { get; set; }
    public string? EntityName { get; set; }
    public int? BrandId { get; set; }
    public DateTime Timestamp { get; set; }
}
