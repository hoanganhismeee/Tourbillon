using backend.Services;

namespace backend.Tests.Services;

internal sealed class TestStorageService : IStorageService
{
    public Task<(string PublicId, long Version)> UploadImageAsync(Stream stream, string filename, string folder = "watches")
        => Task.FromResult((string.IsNullOrEmpty(folder) ? filename : $"{folder}/{filename}", 1L));

    public Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches")
        => Task.FromResult(publicId.Contains('/') ? publicId : $"{folder}/{publicId}");

    public Task<bool> DeleteImageAsync(string publicId)
        => Task.FromResult(true);

    public Task<List<string>> ListAssetsByPrefixAsync(string prefix)
        => Task.FromResult(new List<string>());

    public Task<bool> RenameAssetAsync(string fromPublicId, string toPublicId)
        => Task.FromResult(true);

    public Task<(string PresignedUrl, string Key)> GeneratePresignedUploadUrlAsync(
        string fileName, string folder, string contentType, int expiryMinutes = 15)
        => Task.FromResult(($"https://s3.test/presigned/{folder}/{fileName}", $"{folder}/{fileName}"));

    public string? GetPublicUrl(string? publicId, long? version = null)
    {
        if (string.IsNullOrEmpty(publicId))
            return null;

        if (publicId.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return publicId;

        return $"https://cdn.test/{publicId}?v={version ?? 1}";
    }
}
