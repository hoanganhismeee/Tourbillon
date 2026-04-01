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

    // Bump this when images are replaced directly in Cloudinary (without going through the upload endpoint).
    // Used as a fallback when a watch has no per-watch ImageVersion — ensures CDN cache is busted globally.
    private const int GlobalImageCacheVersion = 2;

    /// Returns the complete image URL for Cloudinary images.
    /// Injects /v{ImageVersion}/ (per-watch) or ?v={GlobalImageCacheVersion} (global fallback)
    /// to bypass CDN cache after re-upload.
    public string? GetImageUrl(string? cloudName = "dcd9lcdoj")
    {
        if (string.IsNullOrEmpty(Image))
            return null;

        // External URLs returned as-is
        if (Image.StartsWith("http://") || Image.StartsWith("https://"))
            return Image;

        if (ImageVersion.HasValue)
        {
            // Per-watch version: injected into the URL path (Cloudinary canonical versioning)
            return $"https://res.cloudinary.com/{cloudName}/image/upload/dpr_auto/q_auto/f_auto/w_800,h_800,c_fit/v{ImageVersion}/{Image}";
        }

        // Global fallback: query param ensures CDN treats this as a new URL
        return $"https://res.cloudinary.com/{cloudName}/image/upload/dpr_auto/q_auto/f_auto/w_800,h_800,c_fit/{Image}?v={GlobalImageCacheVersion}";
    }
}