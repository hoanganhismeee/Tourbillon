using backend.Services;
namespace backend.Models;

/// Data Transfer Object for Watch API responses
/// Includes computed ImageUrl from the active storage provider
public class WatchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; } // Raw image path from database
    public string? ImageUrl { get; set; } // Computed complete URL with version for CDN cache busting
    public long? ImageVersion { get; set; }
    public decimal CurrentPrice { get; set; }
    public int BrandId { get; set; }
    public string? BrandSlug { get; set; }
    public int? CollectionId { get; set; }
    public string? CollectionSlug { get; set; }
    public string? Specs { get; set; }

    // Null when not yet seeded; present on detail page response only
    public EditorialContentDto? EditorialContent { get; set; }

    /// Factory method to create DTO from Watch entity.
    /// Pass editorial when returning a single watch detail — omit for list endpoints.
    public static WatchDto FromWatch(Watch watch, IStorageService storage, WatchEditorialContent? editorial = null)
    {
        return new WatchDto
        {
            Id = watch.Id,
            Name = watch.Name,
            Slug = watch.Slug,
            Description = watch.Description,
            Image = watch.Image,
            ImageUrl = storage.GetPublicUrl(watch.Image, watch.ImageVersion),
            ImageVersion = watch.ImageVersion,
            CurrentPrice = watch.CurrentPrice,
            BrandId = watch.BrandId,
            BrandSlug = watch.Brand?.Slug,
            CollectionId = watch.CollectionId,
            CollectionSlug = watch.Collection?.Slug,
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
