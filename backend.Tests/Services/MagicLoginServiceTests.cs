// Unit tests for MagicLoginService — focuses on Redis key/value interaction.
// Uses Moq for UserManager (complex Identity type) and a fake in-memory IRedisService.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace backend.Tests.Services;

public class MagicLoginServiceTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Mock<UserManager<User>> MockUserManager()
    {
        var store = new Mock<IUserStore<User>>();
        return new Mock<UserManager<User>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
    }

    private static Mock<IEmailService> SilentEmailService()
    {
        var mock = new Mock<IEmailService>();
        mock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        return mock;
    }

    private static Mock<IRoleManagementService> MockRoleManagement() => new();

    /// Simple in-memory IRedisService stub — enough for string get/set/remove tests.
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

        public Task<bool> RemoveHashAsync(string key) => Task.FromResult(_store.Remove(key));

        public Task RefreshExpiryAsync(string key, TimeSpan expiry) => Task.CompletedTask;
    }

    // ── RequestAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task RequestAsync_StoresCode_InRedis()
    {
        var userMgr = MockUserManager();
        userMgr.Setup(u => u.FindByEmailAsync("test@example.com")).ReturnsAsync((User?)null);

        var redis   = new FakeRedis();
        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, redis, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        await service.RequestAsync("test@example.com");

        // Code should now be in Redis
        var code = await redis.GetStringAsync("magic:test@example.com");
        Assert.NotNull(code);
        Assert.Equal(6, code!.Length);
    }

    // ── VerifyAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task VerifyAsync_ReturnsNull_WhenCodeMissing()
    {
        var userMgr = MockUserManager();
        var redis   = new FakeRedis(); // empty — no code stored
        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, redis, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var result = await service.VerifyAsync("test@example.com", "ABCDEF");

        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAsync_ReturnsNull_WhenCodeMismatch()
    {
        var redis = new FakeRedis();
        await redis.SetStringAsync("magic:test@example.com", "ZZZZZZ");

        var userMgr = MockUserManager();
        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, redis, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var result = await service.VerifyAsync("test@example.com", "ABCDEF");

        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAsync_ReturnsUser_WhenCodeMatches_ExistingAccount()
    {
        var existingUser = new User { Id = 42, Email = "test@example.com" };
        var userMgr = MockUserManager();
        userMgr.Setup(u => u.FindByEmailAsync("test@example.com")).ReturnsAsync(existingUser);

        var redis = new FakeRedis();
        await redis.SetStringAsync("magic:test@example.com", "ABC123");

        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, redis, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var result = await service.VerifyAsync("test@example.com", "abc123"); // lowercase — service uppercases

        Assert.NotNull(result);
        Assert.Equal(42, result!.Id);
    }

    [Fact]
    public async Task VerifyAsync_ConsumesCode_SoSecondVerifyFails()
    {
        var existingUser = new User { Id = 1, Email = "test@example.com" };
        var userMgr = MockUserManager();
        userMgr.Setup(u => u.FindByEmailAsync("test@example.com")).ReturnsAsync(existingUser);

        var redis = new FakeRedis();
        await redis.SetStringAsync("magic:test@example.com", "XYZ999");

        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, redis, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var first  = await service.VerifyAsync("test@example.com", "XYZ999");
        var second = await service.VerifyAsync("test@example.com", "XYZ999");

        Assert.NotNull(first);
        Assert.Null(second); // code was consumed on first verify
    }
}
