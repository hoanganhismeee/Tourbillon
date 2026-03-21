using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

// Request DTO for POST /api/taste.
// The plain-text description is sent to the ai-service for LLM extraction.
public class SaveTasteDto
{
    [Required]
    public string TasteText { get; set; } = string.Empty;
}
