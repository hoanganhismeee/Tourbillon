namespace backend.DTOs;

public record VerifyPasswordDto(string Password);
public record ChangePasswordDto(string CurrentPassword, string NewPassword);
public record PasswordSetupConfirmDto(string Code, string NewPassword);
