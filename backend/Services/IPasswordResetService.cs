// Interface for password reset service using 6-digit verification codes
// Defines contract for three-step password reset flow: request, verify, reset

namespace backend.Services;

public interface IPasswordResetService
{
    Task<(bool Success, string Message)> RequestPasswordResetAsync(string email);
    Task<(bool Success, string Message)> VerifyCodeAsync(string email, string code);
    Task<(bool Success, string Message)> ResetPasswordAsync(string email, string code, string newPassword);
}

