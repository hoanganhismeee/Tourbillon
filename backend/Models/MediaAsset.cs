// Tracks standalone media assets (images and videos) in the admin media library.
namespace backend.Models;

public class MediaAsset
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;          // S3 object key: "media/images/..." or "media/videos/..."
    public string FileName { get; set; } = string.Empty;
    public string MediaType { get; set; } = string.Empty;    // "image" | "video"
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public string? CloudinaryPublicId { get; set; }          // set for images staged on Cloudinary
    public string? CloudinaryUrl { get; set; }               // set for images; direct Cloudinary link
}
