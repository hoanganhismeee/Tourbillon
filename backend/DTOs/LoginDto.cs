// This file defines the data transfer object (DTO) for user login.
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class LoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
} 