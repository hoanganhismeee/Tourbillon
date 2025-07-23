// This file defines the data transfer object (DTO) for user registration.
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class RegisterDto
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;


    public string? PhoneNumber { get; set; }
} 