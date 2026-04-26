// Products
namespace backend.Models;
public class Watch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;  //string.empty because it will alway be filled
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; }
    public decimal CurrentPrice { get; set; }

    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!; //null! because it will alway be filled

    public int? CollectionId { get; set; }

    public string? Specs { get; set; }
    // Cloudinary version number — injected into image URLs to bust CDN + browser cache after re-upload
    public long? ImageVersion { get; set; }
    public Collection? Collection { get; set; } //null! because it will alway be filled

    // Navigation properties

    public ICollection<PriceTrend>? PriceHistory { get; set; } = new List<PriceTrend>();
    public WatchEditorialLink? EditorialLink { get; set; }

}