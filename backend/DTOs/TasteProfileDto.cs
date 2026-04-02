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
}
