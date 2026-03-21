// Unit tests for TasteProfileService.ScoreWatch — pure static function, no DB needed.
// Covers all scoring dimensions: brand (+3), material (+2), dial color (+2),
// case size (+1), price range (+1). Max possible score = 9.
using backend.DTOs;
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class TasteProfileServiceTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static WatchDto MakeWatch(
        int brandId = 1,
        decimal price = 5000,
        string specs = "{}") => new()
    {
        Id = 1,
        Name = "Test Watch",
        BrandId = brandId,
        CurrentPrice = price,
        Specs = specs,
    };

    private static TasteProfileDto EmptyProfile() => new();

    private static string Specs(string? caseMaterial = null, string? diameter = null, string? dialColor = null)
    {
        var parts = new List<string>();
        if (caseMaterial != null || diameter != null)
        {
            var caseParts = new List<string>();
            if (caseMaterial != null) caseParts.Add($@"""material"":""{caseMaterial}""");
            if (diameter   != null) caseParts.Add($@"""diameter"":""{diameter}""");
            parts.Add($@"""case"":{{{string.Join(",", caseParts)}}}");
        }
        if (dialColor != null)
            parts.Add($@"""dial"":{{""color"":""{dialColor}""}}");
        return $"{{{string.Join(",", parts)}}}";
    }

    // ── Brand ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Returns3_WhenBrandMatches()
    {
        var watch   = MakeWatch(brandId: 5);
        var profile = EmptyProfile();
        profile.PreferredBrandIds.Add(5);

        Assert.Equal(3, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenBrandDoesNotMatch()
    {
        var watch   = MakeWatch(brandId: 5);
        var profile = EmptyProfile();
        profile.PreferredBrandIds.Add(99);

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    // ── Material ──────────────────────────────────────────────────────────────

    [Fact]
    public void Returns2_WhenCaseMaterialMatches_CaseInsensitive()
    {
        var watch   = MakeWatch(specs: Specs(caseMaterial: "Stainless Steel"));
        var profile = EmptyProfile();
        profile.PreferredMaterials.Add("stainless steel");

        Assert.Equal(2, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenCaseMaterialDoesNotMatch()
    {
        var watch   = MakeWatch(specs: Specs(caseMaterial: "Rose Gold"));
        var profile = EmptyProfile();
        profile.PreferredMaterials.Add("stainless steel");

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    // ── Dial color ────────────────────────────────────────────────────────────

    [Fact]
    public void Returns2_WhenDialColorMatches_CaseInsensitive()
    {
        var watch   = MakeWatch(specs: Specs(dialColor: "Blue Sunburst"));
        var profile = EmptyProfile();
        profile.PreferredDialColors.Add("blue");

        Assert.Equal(2, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenDialColorDoesNotMatch()
    {
        var watch   = MakeWatch(specs: Specs(dialColor: "Black"));
        var profile = EmptyProfile();
        profile.PreferredDialColors.Add("blue");

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    // ── Price ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Returns1_WhenPriceInRange()
    {
        var watch   = MakeWatch(price: 8000);
        var profile = EmptyProfile();
        profile.PriceMin = 5000;
        profile.PriceMax = 10000;

        Assert.Equal(1, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenPriceOutOfRange()
    {
        var watch   = MakeWatch(price: 15000);
        var profile = EmptyProfile();
        profile.PriceMin = 5000;
        profile.PriceMax = 10000;

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenCurrentPriceIsZero_PoR()
    {
        // Price on Request watches (price=0) must never be penalised by price scoring
        var watch   = MakeWatch(price: 0);
        var profile = EmptyProfile();
        profile.PriceMin = 5000;
        profile.PriceMax = 10000;

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    // ── Case size ─────────────────────────────────────────────────────────────

    [Fact]
    public void Returns1_WhenCaseSizeSmall_Under37mm()
    {
        var watch   = MakeWatch(specs: Specs(diameter: "35 mm"));
        var profile = EmptyProfile();
        profile.PreferredCaseSize = "small";

        Assert.Equal(1, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns1_WhenCaseSizeMedium_37to41mm()
    {
        var watch   = MakeWatch(specs: Specs(diameter: "39 mm"));
        var profile = EmptyProfile();
        profile.PreferredCaseSize = "medium";

        Assert.Equal(1, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns1_WhenCaseSizeLarge_Over41mm()
    {
        var watch   = MakeWatch(specs: Specs(diameter: "44 mm"));
        var profile = EmptyProfile();
        profile.PreferredCaseSize = "large";

        Assert.Equal(1, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns0_WhenCaseSizeMismatch()
    {
        var watch   = MakeWatch(specs: Specs(diameter: "44 mm"));
        var profile = EmptyProfile();
        profile.PreferredCaseSize = "small";

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    [Fact]
    public void Returns0_WhenNoPreferencesSet()
    {
        var watch   = MakeWatch();
        var profile = EmptyProfile();

        Assert.Equal(0, TasteProfileService.ScoreWatch(watch, profile));
    }

    [Fact]
    public void Returns9_WhenAllFieldsMatch()
    {
        // 3 (brand) + 2 (material) + 2 (dial color) + 1 (case size) + 1 (price) = 9
        var watch = MakeWatch(
            brandId: 3,
            price: 7500,
            specs: Specs(caseMaterial: "stainless steel", diameter: "39 mm", dialColor: "blue"));
        var profile = EmptyProfile();
        profile.PreferredBrandIds.Add(3);
        profile.PreferredMaterials.Add("stainless steel");
        profile.PreferredDialColors.Add("blue");
        profile.PreferredCaseSize = "medium";
        profile.PriceMin = 5000;
        profile.PriceMax = 10000;

        Assert.Equal(9, TasteProfileService.ScoreWatch(watch, profile));
    }
}
