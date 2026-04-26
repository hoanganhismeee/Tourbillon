namespace backend.Services;

/// Vendor-neutral interface for image storage operations.
/// Implementations: CloudinaryStorageService, S3StorageService.
/// Active implementation is selected by appsettings.json Storage:Provider ("Cloudinary" | "S3").
public interface IStorageService
{
    /// Uploads an image from a stream. Returns (publicId, version) for CDN cache-busting.
    Task<(string PublicId, long Version)> UploadImageAsync(Stream stream, string filename, string folder = "watches");

    /// Downloads an image from imageUrl and uploads it under the given publicId and folder.
    Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches");

    /// Removes a stored asset by its public ID. Returns true on success.
    Task<bool> DeleteImageAsync(string publicId);

    /// Returns all asset keys/public IDs whose path starts with prefix.
    Task<List<string>> ListAssetsByPrefixAsync(string prefix);

    /// Renames (moves) an asset without re-uploading. Returns true on success.
    Task<bool> RenameAssetAsync(string fromPublicId, string toPublicId);

    /// Builds the CDN URL for a stored public ID. Returns null for empty input. Passes through http/https URLs unchanged.
    string? GetPublicUrl(string? publicId, long? version = null);
}
