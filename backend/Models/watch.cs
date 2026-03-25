// Products
namespace backend.Models;
public class Watch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;  //string.empty because it will alway be filled
    public string? Description { get; set; }
    public string? Image { get; set; }
    public decimal CurrentPrice { get; set; }

    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!; //null! because it will alway be filled

    public int? CollectionId { get; set; }

    public string? Specs { get; set; }
    public Collection? Collection { get; set; } //null! because it will alway be filled

    // Navigation properties

    public ICollection<PriceTrend>? PriceHistory { get; set; } = new List<PriceTrend>();
    public WatchEditorialLink? EditorialLink { get; set; }

    /// Returns the complete image URL for Cloudinary images
    /// If Image is already a full URL (starts with http), returns it as-is
    /// If Image is a Cloudinary public ID, builds the complete Cloudinary URL
    public string? GetImageUrl(string? cloudName = "dcd9lcdoj")
    {
        if (string.IsNullOrEmpty(Image))
            return null;

        // External URLs returned as-is — these will be replaced with Cloudinary public IDs
        if (Image.StartsWith("http://") || Image.StartsWith("https://"))
            return Image;

        // If it looks like a Cloudinary public ID (contains / or matches watch pattern), build full URL
        if (Image.Contains("/") || Image.StartsWith("watches/"))
        {
            return $"https://res.cloudinary.com/{cloudName}/image/upload/dpr_auto/q_auto/f_auto/w_800,h_800,c_fit/{Image}";
        }

        // Otherwise assume it's a filename that needs the watches/ prefix and full URL
        return $"https://res.cloudinary.com/{cloudName}/image/upload/dpr_auto/q_auto/f_auto/w_800,h_800,c_fit/{Image}";
    }
}