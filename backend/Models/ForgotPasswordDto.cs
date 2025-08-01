// Handles forgot password requests with support for both email and phone number
namespace backend.Models;

public class ForgotPasswordDto
{
    public string EmailOrPhone { get; set; } = string.Empty;
} 