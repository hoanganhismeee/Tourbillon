// Unit tests for the new VerifyCurrentPassword and ResetPasswordAuthenticated methods.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class PasswordChangeServiceTests
{
    private static Mock<UserManager<User>> MockUserManager()
    {
        var store = new Mock<IUserStore<User>>();
        return new Mock<UserManager<User>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
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
    public async Task ResetPasswordAuthenticated_ValidPassword_ReturnsSuccess()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        um.Setup(u => u.GeneratePasswordResetTokenAsync(It.IsAny<User>())).ReturnsAsync("token");
        um.Setup(u => u.ResetPasswordAsync(It.IsAny<User>(), "token", "NewPass1"))
          .ReturnsAsync(IdentityResult.Success);
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);
        var user = new User { Id = 1 };

        var (success, _) = await svc.ResetPasswordAuthenticatedAsync(user, "NewPass1");

        Assert.True(success);
        rl.Verify(r => r.IsRateLimitedAsync(It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task ResetPasswordAuthenticated_IdentityFails_ReturnsError()
    {
        var um = MockUserManager();
        var rl = MockRateLimit();
        um.Setup(u => u.GeneratePasswordResetTokenAsync(It.IsAny<User>())).ReturnsAsync("token");
        um.Setup(u => u.ResetPasswordAsync(It.IsAny<User>(), "token", "weak"))
          .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Too short" }));
        var svc = new PasswordChangeService(um.Object, NullLogger<PasswordChangeService>.Instance, rl.Object);
        var user = new User { Id = 1 };

        var (success, message) = await svc.ResetPasswordAuthenticatedAsync(user, "weak");

        Assert.False(success);
        Assert.Contains("Too short", message);
    }
}
