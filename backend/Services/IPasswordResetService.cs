// Service interface for password reset operations using 6-digit codes

namespace backend.Services;

public interface IPasswordResetService
{
    Task<(bool Success, string Message)> RequestPasswordResetAsync(string email);
    Task<(bool Success, string Message)> VerifyCodeAsync(string email, string code);
    Task<(bool Success, string Message)> ResetPasswordAsync(string email, string code, string newPassword);
}

