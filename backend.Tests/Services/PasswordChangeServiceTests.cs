using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class PasswordChangeServiceTests
{
    private static Mock<UserManager<User>> MockUserManager(IList<IPasswordValidator<User>>? validators = null)
    {
        var store = new Mock<IUserStore<User>>();
        return new Mock<UserManager<User>>(
            store.Object,
            null!,
            null!,
            null!,
            validators ?? new List<IPasswordValidator<User>>(),
            null!,
            null!,
            null!,
            null!);
    }

    private static Mock<IPasswordChangeRateLimitService> MockRateLimit(bool isLimited = false)
    {
        var mock = new Mock<IPasswordChangeRateLimitService>();
        mock.Setup(r => r.IsRateLimitedAsync(It.IsAny<string>())).ReturnsAsync(isLimited);
        mock.Setup(r => r.RecordAttemptAsync(It.IsAny<string>())).Returns(Task.CompletedTask);
        return mock;
    }

    [Fact]
    public async Task VerifyCurrentPassword_CorrectPassword_ReturnsSuccess()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        um.Setup(u => u.CheckPasswordAsync(It.IsAny<User>(), "correct")).ReturnsAsync(true);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);
        var user = new User { Id = 1 };

        var (success, _) = await svc.VerifyCurrentPasswordAsync(user, "correct");

        Assert.True(success);
    }

    [Fact]
    public async Task VerifyCurrentPassword_WrongPassword_ReturnsFalse()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        um.Setup(u => u.CheckPasswordAsync(It.IsAny<User>(), "wrong")).ReturnsAsync(false);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);
        var user = new User { Id = 1 };

        var (success, _) = await svc.VerifyCurrentPasswordAsync(user, "wrong");

        Assert.False(success);
    }

    [Fact]
    public async Task VerifyCurrentPassword_RateLimited_ReturnsFalse()
    {
        var um = MockUserManager();
        var rl = MockRateLimit(isLimited: true);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);
        var user = new User { Id = 1 };

        var (success, message) = await svc.VerifyCurrentPasswordAsync(user, "any");

        Assert.False(success);
        Assert.Contains("Too many", message);
        rl.Verify(r => r.RecordAttemptAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ChangePassword_CorrectCurrentPassword_ReturnsSuccess()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        var user = new User { Id = 1 };
        um.Setup(u => u.CheckPasswordAsync(user, "OldPass1")).ReturnsAsync(true);
        um.Setup(u => u.ChangePasswordAsync(user, "OldPass1", "NewPass1")).ReturnsAsync(IdentityResult.Success);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);

        var (success, message) = await svc.ChangePasswordAsync(user, "OldPass1", "NewPass1");

        Assert.True(success);
        Assert.Equal("Password changed successfully", message);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_ReturnsError()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        var user = new User { Id = 1 };
        um.Setup(u => u.CheckPasswordAsync(user, "wrong")).ReturnsAsync(false);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);

        var (success, message) = await svc.ChangePasswordAsync(user, "wrong", "NewPass1");

        Assert.False(success);
        Assert.Equal("Current password is incorrect", message);
        um.Verify(u => u.ChangePasswordAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ChangePassword_NewPasswordSameAsCurrent_ReturnsError()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        var user = new User { Id = 1 };
        um.Setup(u => u.CheckPasswordAsync(user, "SamePass1")).ReturnsAsync(true);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);

        var (success, message) = await svc.ChangePasswordAsync(user, "SamePass1", "SamePass1");

        Assert.False(success);
        Assert.Equal("Choose a password different from your current password", message);
        um.Verify(u => u.ChangePasswordAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ChangePassword_WeakNewPassword_ReturnsValidationError()
    {
        var validator = new Mock<IPasswordValidator<User>>();
        validator
            .Setup(v => v.ValidateAsync(It.IsAny<UserManager<User>>(), It.IsAny<User>(), "weak"))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Too short" }));

        var um = MockUserManager(new List<IPasswordValidator<User>> { validator.Object });
        var rl = MockRateLimit();
        var user = new User { Id = 1 };
        um.Setup(u => u.CheckPasswordAsync(user, "OldPass1")).ReturnsAsync(true);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);

        var (success, message) = await svc.ChangePasswordAsync(user, "OldPass1", "weak");

        Assert.False(success);
        Assert.Contains("Too short", message);
        um.Verify(u => u.ChangePasswordAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }
}
