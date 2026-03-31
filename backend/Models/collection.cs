// Brand's specific watches collection
namespace backend.Models;
public class Collection
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Image { get; set; }
    /// Style taxonomy — "sport", "dress", "diver", or null for uncategorized.
    /// Set once per collection via migration data seed; editable via admin API.
    public string? Style { get; set; }
    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!;
    public ICollection<Watch>? Watches { get; set; } = new List<Watch>();
}