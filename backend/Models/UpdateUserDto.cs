// This file defines the data transfer object (DTO) for updating user information.
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class UpdateUserDto
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }
    
    public DateTime? DateOfBirth { get; set; }
    
    public string? Address { get; set; }
    
    public string? City { get; set; }
    
    public string? State { get; set; }
    
    public string? Country { get; set; }
    
    public string? CurrentPassword { get; set; } // Required when changing password
    
    public string? NewPassword { get; set; }
} 