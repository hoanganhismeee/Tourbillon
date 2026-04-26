namespace backend.Services;

/// IStorageService implementation backed by Cloudinary.
/// Delegates all storage operations to ICloudinaryService and reproduces the
/// Watch.GetImageUrl CDN URL logic so callers do not depend on Watch directly.
public class CloudinaryStorageService : IStorageService
{
    private readonly ICloudinaryService _cloudinaryService;
    private readonly string _cloudName;

    // Matches the GlobalImageCacheVersion constant used in Watch.cs
    private const int _globalVersion = 2;

    public CloudinaryStorageService(ICloudinaryService cloudinaryService, IConfiguration configuration)
    {
        _cloudinaryService = cloudinaryService;
        _cloudName = configuration["Cloudinary:CloudName"] ?? "dcd9lcdoj";
    }

    /// Delegates to CloudinaryService; returns (publicId, version) for CDN cache-busting.
    public Task<(string PublicId, long Version)> UploadImageAsync(Stream stream, string filename, string folder = "watches")
        => _cloudinaryService.UploadImageAsync(stream, filename, folder);

    /// Downloads from imageUrl and uploads to Cloudinary under publicId/folder.
    public Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches")
        => _cloudinaryService.UploadImageFromUrlAsync(imageUrl, publicId, folder);

    /// Deletes a Cloudinary asset by its public_id.
    public Task<bool> DeleteImageAsync(string publicId)
        => _cloudinaryService.DeleteImageAsync(publicId);

    /// Lists all Cloudinary assets whose public_id starts with prefix.
    public Task<List<string>> ListAssetsByPrefixAsync(string prefix)
        => _cloudinaryService.ListAssetsByPrefixAsync(prefix);

    /// Renames a Cloudinary asset in-place without re-uploading.
    public Task<bool> RenameAssetAsync(string fromPublicId, string toPublicId)
        => _cloudinaryService.RenameAssetAsync(fromPublicId, toPublicId);

    /// Builds a Cloudinary CDN URL from a stored public ID.
    /// Reproduces the logic in Watch.GetImageUrl so callers can use IStorageService directly.
    public string? GetPublicUrl(string? publicId, long? version = null)
    {
        if (string.IsNullOrEmpty(publicId))
            return null;

        // External URLs are returned unchanged (already absolute)
        if (publicId.StartsWith("http"))
            return publicId;

        var baseUrl = $"https://res.cloudinary.com/{_cloudName}/image/upload/dpr_auto/q_auto/f_auto/w_800,h_800,c_fit";

        if (version.HasValue)
            return $"{baseUrl}/v{version}/{publicId}";

        return $"{baseUrl}/{publicId}?v={_globalVersion}";
    }
}
