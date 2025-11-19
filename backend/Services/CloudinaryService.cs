using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace backend.Services;

/// Interface for Cloudinary image upload operations
public interface ICloudinaryService
{
    /// Uploads an image from a URL to Cloudinary
    /// Params: imageUrl - Full URL of the image to download and upload
    /// publicId - Cloudinary public_id (filename without extension)
    /// folder - Cloudinary folder path (e.g., "watches")
    /// Returns: Public ID of the uploaded image on success, empty string on failure
    Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches");
}

/// Cloudinary image upload service
/// Handles uploading scraped watch images to Cloudinary CDN
public class CloudinaryService : ICloudinaryService
{
    private readonly Cloudinary _cloudinary;
    private readonly ILogger<CloudinaryService> _logger;

    public CloudinaryService(IConfiguration configuration, ILogger<CloudinaryService> logger)
    {
        _logger = logger;

        // Read Cloudinary credentials from appsettings.json
        var cloudName = configuration["Cloudinary:CloudName"];
        var apiKey = configuration["Cloudinary:ApiKey"];
        var apiSecret = configuration["Cloudinary:ApiSecret"];

        if (string.IsNullOrEmpty(cloudName) || string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(apiSecret))
        {
            _logger.LogError("Cloudinary configuration is missing in appsettings.json");
            throw new InvalidOperationException("Cloudinary configuration not found");
        }

        var account = new Account(cloudName, apiKey, apiSecret);
        _cloudinary = new Cloudinary(account);

        _logger.LogInformation("Cloudinary service initialized for cloud: {CloudName}", cloudName);
    }

    /// Uploads an image from a URL to Cloudinary
    /// Downloads the image content and uploads it with the specified public_id
    public async Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches")
    {
        if (string.IsNullOrEmpty(imageUrl) || string.IsNullOrEmpty(publicId))
        {
            _logger.LogWarning("Invalid parameters for Cloudinary upload: url={Url}, publicId={PublicId}", imageUrl, publicId);
            return string.Empty;
        }

        try
        {
            // Download image from URL first
            using (var httpClient = new HttpClient())
            {
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                httpClient.DefaultRequestHeaders.Add("Referer", "https://www.vacheron-constantin.com/");

                var response = await httpClient.GetAsync(imageUrl);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to download image from {Url}. Status: {Status}", imageUrl, response.StatusCode);
                    return string.Empty;
                }

                var imageContent = await response.Content.ReadAsStreamAsync();

                // Upload to Cloudinary
                var fullPublicId = string.IsNullOrEmpty(folder) ? publicId : $"{folder}/{publicId}";
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(publicId, imageContent),
                    PublicId = fullPublicId,
                    Overwrite = true // Overwrite if re-scraping
                };

                var uploadResult = await _cloudinary.UploadAsync(uploadParams);

                if (uploadResult.Error != null)
                {
                    _logger.LogError("Cloudinary upload failed: {Error}", uploadResult.Error.Message);
                    return string.Empty;
                }

                _logger.LogInformation("Successfully uploaded image to Cloudinary: {PublicId}", fullPublicId);
                return fullPublicId; // Return the full public_id (e.g., "watches/PatekPhilippe_5227G010")
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image to Cloudinary from {Url}", imageUrl);
            return string.Empty;
        }
    }
}
