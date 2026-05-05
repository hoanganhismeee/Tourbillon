namespace backend.DTOs;

public record VerifyPasswordDto(string Password);
public record AuthenticatedResetPasswordDto(string NewPassword);
public record PasswordSetupConfirmDto(string Code, string NewPassword);
