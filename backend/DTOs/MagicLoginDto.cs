// DTOs for the email magic login (passwordless OTP) flow.
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class MagicLoginRequestDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class MagicLoginVerifyDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Code { get; set; } = string.Empty;
}
