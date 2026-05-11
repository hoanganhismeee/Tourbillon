namespace backend.DTOs;

// Response DTO returned from GET /api/taste and POST /api/taste.
// Contains both the raw input text and the LLM-extracted structured preferences.
public class TasteProfileDto
{
    public string? TasteText { get; set; }
    public List<int> PreferredBrandIds { get; set; } = new();
    public List<string> PreferredMaterials { get; set; } = new();
    public List<string> PreferredDialColors { get; set; } = new();
    public decimal? PriceMin { get; set; }
    public decimal? PriceMax { get; set; }
    public string? PreferredCaseSize { get; set; }
    public string? Summary { get; set; }
    public List<int> BehaviorPreferredBrandIds { get; set; } = new();
    public List<string> BehaviorPreferredMaterials { get; set; } = new();
    public List<string> BehaviorPreferredDialColors { get; set; } = new();
    public decimal? BehaviorPriceMin { get; set; }
    public decimal? BehaviorPriceMax { get; set; }
    public string? BehaviorPreferredCaseSize { get; set; }
    public string? BehaviorSummary { get; set; }
    public DateTime? BehaviorAnalyzedAt { get; set; }
    public bool HasBehaviorAnalysis { get; set; }
    public bool HasEnoughBehaviorData { get; set; }
    /// "ranked" when LLM structured parse succeeded; "fallback" when AI was unavailable and existing preferences were preserved.
    public string ParseSource { get; set; } = "ranked";
}
