// DTOs for appointment booking
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class CreateAppointmentDto
{
    public int? WatchId { get; set; }

    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Phone { get; set; }

    [Required]
    public string BoutiqueName { get; set; } = string.Empty;

    [Required]
    public string VisitPurpose { get; set; } = string.Empty;

    public string? BrandName { get; set; }

    [Required]
    public DateTime AppointmentDate { get; set; }
}

public class AppointmentResponseDto
{
    public int Id { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
