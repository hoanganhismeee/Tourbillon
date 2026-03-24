// DTOs for Register Your Interest submissions
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class CreateRegisterInterestDto
{
    [Required, MaxLength(20)]
    public string Salutation { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(10)]
    public string? PhoneRegionCode { get; set; }

    [MaxLength(2000)]
    public string? Message { get; set; }

    public int? WatchId { get; set; }
    public string? BrandName { get; set; }
    public string? CollectionName { get; set; }
}

public class RegisterInterestResponseDto
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
}
