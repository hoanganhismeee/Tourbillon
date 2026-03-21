// Unit tests for TasteController using a mocked ITasteProfileService and a fake ClaimsPrincipal.
// Tests cover auth guard, 50-word limit enforcement, and happy-path delegation.
using System.Security.Claims;
using backend.Controllers;
using backend.DTOs;
using backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace backend.Tests.Controllers;

public class TasteControllerTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    // Creates a controller wired to the given mock service and an authenticated user with userId.
    private static TasteController MakeController(Mock<ITasteProfileService> mock, int? userId = 1)
    {
        var controller = new TasteController(mock.Object);
        var claims = userId.HasValue
            ? new[] { new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()) }
            : Array.Empty<Claim>();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims))
            }
        };
        return controller;
    }

    private static TasteProfileDto SampleProfile() => new()
    {
        TasteText = "I like Vacheron dress watches",
        PreferredBrandIds = new() { 3 },
    };

    // ── GetProfile ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetProfile_Returns401_WhenNoUserClaim()
    {
        var mock       = new Mock<ITasteProfileService>();
        var controller = MakeController(mock, userId: null);

        var result = await controller.GetProfile();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetProfile_ReturnsProfile_WhenAuthenticated()
    {
        var profile = SampleProfile();
        var mock    = new Mock<ITasteProfileService>();
        mock.Setup(s => s.GetProfileAsync(1)).ReturnsAsync(profile);

        var controller = MakeController(mock, userId: 1);
        var result     = await controller.GetProfile() as OkObjectResult;

        Assert.NotNull(result);
        Assert.Equal(profile, result!.Value);
    }

    // ── SaveTaste ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveTaste_Returns401_WhenNoUserClaim()
    {
        var mock       = new Mock<ITasteProfileService>();
        var controller = MakeController(mock, userId: null);

        var result = await controller.SaveTaste(new SaveTasteDto { TasteText = "test" });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task SaveTaste_Returns400_WhenWordCountExceeds50()
    {
        var mock       = new Mock<ITasteProfileService>();
        var controller = MakeController(mock, userId: 1);
        // Build a 51-word string
        var longText = string.Join(" ", Enumerable.Repeat("word", 51));

        var result = await controller.SaveTaste(new SaveTasteDto { TasteText = longText });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SaveTaste_CallsParseAndSave_WhenAuthenticated()
    {
        var profile    = SampleProfile();
        var mock       = new Mock<ITasteProfileService>();
        mock.Setup(s => s.ParseAndSaveAsync(1, It.IsAny<string>())).ReturnsAsync(profile);

        var controller = MakeController(mock, userId: 1);
        var result     = await controller.SaveTaste(new SaveTasteDto { TasteText = "I like Vacheron dress watches" }) as OkObjectResult;

        Assert.NotNull(result);
        mock.Verify(s => s.ParseAndSaveAsync(1, It.IsAny<string>()), Times.Once);
    }
}
