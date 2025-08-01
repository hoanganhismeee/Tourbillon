// Defines email service operations for authentication and password reset
namespace backend.Services;

public interface IEmailService
{
    Task<bool> SendLoginLinkAsync(string email, string token, string callbackUrl);
    Task<bool> SendPasswordResetLinkAsync(string email, string token, string callbackUrl);
} 