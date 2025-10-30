// Data transfer object for password reset submission using 6-digit code

namespace backend.DTOs;

public class ResetPasswordDto
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

