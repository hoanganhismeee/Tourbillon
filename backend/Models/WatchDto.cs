namespace backend.Models;

/// Data Transfer Object for Watch API responses
/// Includes computed ImageUrl for complete Cloudinary URLs
public class WatchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; } // Raw image path from database
    public string? ImageUrl { get; set; } // Computed complete URL with version for CDN cache busting
    public long? ImageVersion { get; set; }
    public decimal CurrentPrice { get; set; }
    public int BrandId { get; set; }
    public int? CollectionId { get; set; }
    public string? Specs { get; set; }

    // Null when not yet seeded; present on detail page response only
    public EditorialContentDto? EditorialContent { get; set; }

    /// Factory method to create DTO from Watch entity.
    /// Pass editorial when returning a single watch detail — omit for list endpoints.
    public static WatchDto FromWatch(Watch watch, string cloudName = "dcd9lcdoj", WatchEditorialContent? editorial = null)
    {
        return new WatchDto
        {
            Id = watch.Id,
            Name = watch.Name,
            Description = watch.Description,
            Image = watch.Image,
            ImageUrl = watch.GetImageUrl(cloudName),
            ImageVersion = watch.ImageVersion,
            CurrentPrice = watch.CurrentPrice,
            BrandId = watch.BrandId,
            CollectionId = watch.CollectionId,
            Specs = watch.Specs,
            EditorialContent = editorial == null ? null : new EditorialContentDto
            {
                WhyItMatters    = editorial.WhyItMatters,
                CollectorAppeal = editorial.CollectorAppeal,
                DesignLanguage  = editorial.DesignLanguage,
                BestFor         = editorial.BestFor,
            },
        };
    }
}

/// Editorial story sections returned alongside a watch detail response.
public class EditorialContentDto
{
    public string WhyItMatters { get; set; } = "";
    public string CollectorAppeal { get; set; } = "";
    public string DesignLanguage { get; set; } = "";
    public string BestFor { get; set; } = "";
}
