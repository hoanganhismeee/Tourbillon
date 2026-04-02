// Stores a registered user's explicit watch taste preferences, extracted from their plain-text description.
// JSON arrays (brand IDs, materials, dial colors) stored as text columns to avoid extra junction tables.
namespace backend.Models;

public class UserTasteProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    // Raw user input (≤50 words) — pre-filled in the Watch DNA form on next visit
    public string? TasteText { get; set; }

    // JSON-serialized int[] — brand IDs the user prefers (e.g. "[1,3,6]")
    public string PreferredBrandIds { get; set; } = "[]";

    // JSON-serialized string[] — case materials (e.g. ["stainless steel", "white gold"])
    public string PreferredMaterials { get; set; } = "[]";

    // JSON-serialized string[] — dial colors (e.g. ["blue", "black"])
    public string PreferredDialColors { get; set; } = "[]";

    public decimal? PriceMin { get; set; }
    public decimal? PriceMax { get; set; }

    // "small" (<37mm) | "medium" (37–41mm) | "large" (>41mm) | null = no preference
    public string? PreferredCaseSize { get; set; }

    // AI-generated plain-English summary of the user's inferred taste (from behavioral analysis)
    public string? Summary { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
