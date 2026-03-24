// Unit tests for MagicLoginService — focuses on cache interaction.
// Uses Moq for UserManager (complex Identity type), real MemoryCache for cache state.
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
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

    private static IMemoryCache NewCache() =>
        new MemoryCache(new MemoryCacheOptions());

    private static Mock<IEmailService> SilentEmailService()
    {
        var mock = new Mock<IEmailService>();
        mock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        return mock;
    }

    private static Mock<IRoleManagementService> MockRoleManagement() => new();

    // ── RequestAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task RequestAsync_StoresCode_InCache()
    {
        var userMgr = MockUserManager();
        userMgr.Setup(u => u.FindByEmailAsync("test@example.com")).ReturnsAsync((User?)null);

        var cache   = NewCache();
        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, cache, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        await service.RequestAsync("test@example.com");

        // Code should now be in cache
        Assert.True(cache.TryGetValue("magic:test@example.com", out string? code));
        Assert.NotNull(code);
        Assert.Equal(6, code!.Length);
    }

    // ── VerifyAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task VerifyAsync_ReturnsNull_WhenCodeMissing()
    {
        var userMgr = MockUserManager();
        var cache   = NewCache(); // empty — no code stored
        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, cache, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var result = await service.VerifyAsync("test@example.com", "ABCDEF");

        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAsync_ReturnsNull_WhenCodeMismatch()
    {
        var userMgr = MockUserManager();
        var cache   = NewCache();
        cache.Set("magic:test@example.com", "ZZZZZZ");

        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, cache, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var result = await service.VerifyAsync("test@example.com", "ABCDEF");

        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAsync_ReturnsUser_WhenCodeMatches_ExistingAccount()
    {
        var existingUser = new User { Id = 42, Email = "test@example.com" };
        var userMgr = MockUserManager();
        userMgr.Setup(u => u.FindByEmailAsync("test@example.com")).ReturnsAsync(existingUser);

        var cache = NewCache();
        cache.Set("magic:test@example.com", "ABC123");

        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, cache, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

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

        var cache = NewCache();
        cache.Set("magic:test@example.com", "XYZ999");

        var service = new MagicLoginService(userMgr.Object, SilentEmailService().Object, cache, MockRoleManagement().Object, NullLogger<MagicLoginService>.Instance);

        var first  = await service.VerifyAsync("test@example.com", "XYZ999");
        var second = await service.VerifyAsync("test@example.com", "XYZ999");

        Assert.NotNull(first);
        Assert.Null(second); // code was consumed on first verify
    }
}
