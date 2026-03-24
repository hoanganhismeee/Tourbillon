// In-store appointment booking — stores boutique visit requests with customer snapshot data
namespace backend.Models;

public class Appointment
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }

    public int? WatchId { get; set; }
    public Watch? Watch { get; set; }

    // Snapshot fields (immutable after creation)
    public string CustomerFirstName { get; set; } = string.Empty;
    public string CustomerLastName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? PhoneRegionCode { get; set; }

    // Notification preferences
    public bool NotifyByEmail { get; set; } = true;
    public bool NotifyBySms { get; set; }

    public string BoutiqueName { get; set; } = string.Empty;
    public string VisitPurpose { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = "Confirmed";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
