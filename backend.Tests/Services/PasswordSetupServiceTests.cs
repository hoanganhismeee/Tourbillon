// Unit tests for PasswordSetupService OTP generation and confirmation.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class PasswordSetupServiceTests
{
    private static Mock<UserManager<User>> MockUserManager()
    {
        var store = new Mock<IUserStore<User>>();
        return new Mock<UserManager<User>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static Mock<IEmailService> SilentEmail()
    {
        var mock = new Mock<IEmailService>();
        mock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        return mock;
    }

    private class FakeRedis : IRedisService
    {
        private readonly Dictionary<string, string> _store = new();

        public Task<long> IncrementAsync(string key, TimeSpan? ttlOnCreate = null)
        {
            _store.TryGetValue(key, out var v);
            var next = (long.TryParse(v, out var n) ? n : 0) + 1;
            _store[key] = next.ToString();
            return Task.FromResult(next);
        }

        public Task<long?> GetCounterAsync(string key)
        {
            if (_store.TryGetValue(key, out var v) && long.TryParse(v, out var n))
                return Task.FromResult<long?>(n);
            return Task.FromResult<long?>(null);
        }

        public Task<string?> GetStringAsync(string key)
        {
            _store.TryGetValue(key, out var val);
            return Task.FromResult(val);
        }

        public Task SetStringAsync(string key, string value, TimeSpan? expiry = null)
        {
            _store[key] = value;
            return Task.CompletedTask;
        }

        public Task<bool> RemoveAsync(string key) => Task.FromResult(_store.Remove(key));

        public Task SetHashFieldAsync(string key, string field, string value, TimeSpan? expiry = null)
        {
            _store[$"{key}:{field}"] = value;
            return Task.CompletedTask;
        }

        public Task<string?> GetHashFieldAsync(string key, string field)
        {
            _store.TryGetValue($"{key}:{field}", out var val);
            return Task.FromResult(val);
        }

        public Task<bool> RemoveHashAsync(string key)
        {
            var keysToRemove = _store.Keys.Where(k => k.StartsWith($"{key}:")).ToList();
            foreach (var k in keysToRemove)
                _store.Remove(k);
            return Task.FromResult(keysToRemove.Count > 0);
        }

        public Task RefreshExpiryAsync(string key, TimeSpan expiry)
        {
            // Simplified: just verify the key exists
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task RequestAsync_SendsEmailAndStoresCode()
    {
        var um = MockUserManager();
        var email = SilentEmail();
        var redis = new FakeRedis();
        var svc = new PasswordSetupService(um.Object, email.Object, redis, NullLogger<PasswordSetupService>.Instance);
        var user = new User { Id = 7, Email = "user@test.com" };

        await svc.RequestAsync(user);

        email.Verify(e => e.SendEmailAsync("user@test.com", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        Assert.NotNull(await redis.GetStringAsync("pwd-setup:7"));
    }

    [Fact]
    public async Task ConfirmAsync_CorrectCode_SetsPassword()
    {
        var um = MockUserManager();
        var redis = new FakeRedis();
        var svc = new PasswordSetupService(um.Object, SilentEmail().Object, redis, NullLogger<PasswordSetupService>.Instance);
        var user = new User { Id = 7, Email = "user@test.com" };

        await svc.RequestAsync(user);
        var storedCode = await redis.GetStringAsync("pwd-setup:7");
        Assert.NotNull(storedCode);

        um.Setup(u => u.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("tok");
        um.Setup(u => u.ResetPasswordAsync(user, "tok", "NewPass1")).ReturnsAsync(IdentityResult.Success);

        var (success, _) = await svc.ConfirmAsync(user, storedCode!, "NewPass1");

        Assert.True(success);
    }

    [Fact]
    public async Task ConfirmAsync_WrongCode_ReturnsFalse()
    {
        var um = MockUserManager();
        var redis = new FakeRedis();
        var svc = new PasswordSetupService(um.Object, SilentEmail().Object, redis, NullLogger<PasswordSetupService>.Instance);
        var user = new User { Id = 7 };

        await svc.RequestAsync(user);

        var (success, message) = await svc.ConfirmAsync(user, "ZZZZZZ", "NewPass1");

        Assert.False(success);
        Assert.Contains("Invalid", message);
    }

    [Fact]
    public async Task ConfirmAsync_NoCodeRequested_ReturnsFalse()
    {
        var um = MockUserManager();
        var svc = new PasswordSetupService(um.Object, SilentEmail().Object, new FakeRedis(), NullLogger<PasswordSetupService>.Instance);
        var user = new User { Id = 99 };

        var (success, message) = await svc.ConfirmAsync(user, "ABC123", "NewPass1");

        Assert.False(success);
        Assert.Contains("Invalid", message);
    }

    [Fact]
    public async Task ConfirmAsync_IdentityFailure_ReturnsErrors()
    {
        var um = MockUserManager();
        var redis = new FakeRedis();
        var svc = new PasswordSetupService(um.Object, SilentEmail().Object, redis, NullLogger<PasswordSetupService>.Instance);
        var user = new User { Id = 7, Email = "user@test.com" };

        await svc.RequestAsync(user);
        var storedCode = await redis.GetStringAsync("pwd-setup:7");

        um.Setup(u => u.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("tok");
        um.Setup(u => u.ResetPasswordAsync(user, "tok", It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Password too weak." }));

        var (success, message) = await svc.ConfirmAsync(user, storedCode!, "weak");

        Assert.False(success);
        Assert.Contains("Password too weak", message);
    }
}
