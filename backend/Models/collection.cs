// Brand's specific watches collection
namespace backend.Models;
public class Collection
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Image { get; set; }
    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!;
    public ICollection<Watch>? Watches { get; set; } = new List<Watch>();
}