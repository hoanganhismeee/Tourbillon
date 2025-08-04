// This file defines the data transfer object (DTO) for account deletion.
using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class DeleteAccountDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;
} 