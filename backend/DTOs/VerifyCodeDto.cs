// Data transfer object for verifying password reset code

namespace backend.DTOs;

public class VerifyCodeDto
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

