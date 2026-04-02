// DTO for checking whether an email address is already registered.
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CheckEmailDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}
