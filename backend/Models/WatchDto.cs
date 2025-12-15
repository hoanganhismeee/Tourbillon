namespace backend.Models;

/// Data Transfer Object for Watch API responses
/// Includes computed ImageUrl for complete Cloudinary URLs
public class WatchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; } // Raw image path from database
    public string? ImageUrl { get; set; } // Computed complete URL
    public decimal CurrentPrice { get; set; }
    public int BrandId { get; set; }
    public int? CollectionId { get; set; }
    public string? Specs { get; set; }

    /// Factory method to create DTO from Watch entity
    public static WatchDto FromWatch(Watch watch, string cloudName = "dcd9lcdoj")
    {
        return new WatchDto
        {
            Id = watch.Id,
            Name = watch.Name,
            Description = watch.Description,
            Image = watch.Image,
            ImageUrl = watch.GetImageUrl(cloudName),
            CurrentPrice = watch.CurrentPrice,
            BrandId = watch.BrandId,
            CollectionId = watch.CollectionId,
            Specs = watch.Specs
        };
    }
}
