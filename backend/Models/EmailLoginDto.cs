// Handles email-based login requests for passwordless authentication
namespace backend.Models;

public class EmailLoginDto
{
    public string Email { get; set; } = string.Empty;
} 