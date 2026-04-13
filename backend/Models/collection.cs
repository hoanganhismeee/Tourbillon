// Brand's specific watches collection
namespace backend.Models;
public class Collection
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Image { get; set; }
    /// Style taxonomy — e.g. ["sport"], ["dress"], ["diver"], or ["sport","diver"] for multi-style.
    /// Set via admin API or migration; a collection with no tags has an empty array.
    public string[] Styles { get; set; } = [];
    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!;
    public ICollection<Watch>? Watches { get; set; } = new List<Watch>();
}