// DTOs for contact advisor inquiry
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class CreateContactInquiryDto
{
    public int? WatchId { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Message { get; set; } = string.Empty;
}

public class ContactInquiryResponseDto
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
}
