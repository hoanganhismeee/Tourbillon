using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace backend.Services;

/// IStorageService implementation backed by AWS S3 + CloudFront CDN.
/// Credentials and bucket details are read from AWS:* configuration keys (user-secrets in dev).
/// Object keys follow the pattern "folder/publicId" — no file extensions stored.
public class S3StorageService : IStorageService, IDisposable
{
    private readonly IAmazonS3 _s3Client;
    private readonly ILogger<S3StorageService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _bucketName;
    private readonly string _cloudFrontDomain;

    // Cache-buster suffix appended when no explicit version is supplied
    private const int _globalVersion = 2;

    public S3StorageService(IConfiguration configuration, ILogger<S3StorageService> logger, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;

        var accessKeyId     = configuration["AWS:AccessKeyId"]      ?? throw new InvalidOperationException("AWS:AccessKeyId is not configured.");
        var secretAccessKey = configuration["AWS:SecretAccessKey"]  ?? throw new InvalidOperationException("AWS:SecretAccessKey is not configured.");
        var region          = configuration["AWS:Region"]           ?? "ap-southeast-2";
        _bucketName         = configuration["AWS:BucketName"]       ?? throw new InvalidOperationException("AWS:BucketName is not configured.");
        _cloudFrontDomain   = configuration["AWS:CloudFrontDomain"] ?? throw new InvalidOperationException("AWS:CloudFrontDomain is not configured.");

        var credentials = new BasicAWSCredentials(accessKeyId, secretAccessKey);
        var s3Config    = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(region)
        };

        _s3Client = new AmazonS3Client(credentials, s3Config);
    }

    /// Uploads a stream to S3. The extension is stripped; the key becomes "folder/basename".
    /// Returns (publicId, Unix epoch seconds) on success, ("", 0) on failure.
    public async Task<(string PublicId, long Version)> UploadImageAsync(Stream stream, string filename, string folder = "watches")
    {
        var publicId = Path.GetFileNameWithoutExtension(filename);
        var key      = string.IsNullOrEmpty(folder) ? publicId : $"{folder}/{publicId}";

        var contentType = GuessContentType(filename);

        try
        {
            var request = new PutObjectRequest
            {
                BucketName  = _bucketName,
                Key         = key,
                InputStream = stream,
                ContentType = contentType
            };

            await _s3Client.PutObjectAsync(request);
            _logger.LogInformation("Uploaded stream to S3: {Key}", key);
            return (key, DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading stream to S3 key {Key}", key);
            return (string.Empty, 0);
        }
    }

    /// Downloads imageUrl and uploads it to S3 under the resolved key.
    /// Returns the S3 key on success, empty string on failure.
    public async Task<string> UploadImageFromUrlAsync(string imageUrl, string publicId, string folder = "watches")
    {
        // If publicId already contains a "/" treat it as a full key; otherwise prefix with folder
        var key = publicId.Contains('/') ? publicId
                  : (string.IsNullOrEmpty(folder) ? publicId : $"{folder}/{publicId}");

        try
        {
            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

            var response = await httpClient.GetAsync(imageUrl);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to download image from {Url}: {Status}", imageUrl, response.StatusCode);
                return string.Empty;
            }

            await using var imageStream = await response.Content.ReadAsStreamAsync();
            var contentType = response.Content.Headers.ContentType?.MediaType ?? GuessContentType(imageUrl);

            var request = new PutObjectRequest
            {
                BucketName  = _bucketName,
                Key         = key,
                InputStream = imageStream,
                ContentType = contentType
            };

            await _s3Client.PutObjectAsync(request);
            _logger.LogInformation("Uploaded URL image to S3: {Key}", key);
            return key;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image from URL {Url} to S3 key {Key}", imageUrl, key);
            return string.Empty;
        }
    }

    /// Deletes an S3 object by its key (publicId). Returns true on success.
    public async Task<bool> DeleteImageAsync(string publicId)
    {
        try
        {
            await _s3Client.DeleteObjectAsync(new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key        = publicId
            });

            _logger.LogInformation("Deleted S3 object: {Key}", publicId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting S3 object {Key}", publicId);
            return false;
        }
    }

    /// Returns all S3 object keys under prefix, following pagination tokens automatically.
    public async Task<List<string>> ListAssetsByPrefixAsync(string prefix)
    {
        var keys    = new List<string>();
        string? continuationToken = null;

        do
        {
            var request = new ListObjectsV2Request
            {
                BucketName        = _bucketName,
                Prefix            = prefix,
                ContinuationToken = continuationToken
            };

            var response = await _s3Client.ListObjectsV2Async(request);
            keys.AddRange(response.S3Objects.Select(o => o.Key));
            continuationToken = response.IsTruncated == true ? response.NextContinuationToken : null;
        }
        while (continuationToken != null);

        _logger.LogInformation("Listed {Count} S3 objects under prefix '{Prefix}'", keys.Count, prefix);
        return keys;
    }

    /// Copies fromPublicId to toPublicId then deletes the original.
    /// Returns true if copy succeeded (even if delete fails); false only when copy itself fails.
    public async Task<bool> RenameAssetAsync(string fromPublicId, string toPublicId)
    {
        try
        {
            await _s3Client.CopyObjectAsync(new CopyObjectRequest
            {
                SourceBucket      = _bucketName,
                SourceKey         = fromPublicId,
                DestinationBucket = _bucketName,
                DestinationKey    = toPublicId
            });
            _logger.LogInformation("Copied S3 object {From} → {To}", fromPublicId, toPublicId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to copy S3 object {From} → {To}", fromPublicId, toPublicId);
            return false;
        }

        try
        {
            await _s3Client.DeleteObjectAsync(new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key        = fromPublicId
            });
        }
        catch (Exception ex)
        {
            // Copy succeeded — rename is logically complete. Log and return true; manual cleanup needed.
            _logger.LogError(ex, "Copied {From} to {To} but failed to delete source", fromPublicId, toPublicId);
        }

        return true;
    }

    /// Builds a CloudFront URL from a stored public ID.
    /// Returns null for empty input; passes through http/https URLs unchanged.
    public string? GetPublicUrl(string? publicId, long? version = null)
    {
        if (string.IsNullOrEmpty(publicId))
            return null;

        // Already an absolute URL — return as-is
        if (publicId.StartsWith("http"))
            return publicId;

        var url = $"https://{_cloudFrontDomain}/{publicId}";

        return version.HasValue
            ? $"{url}?v={version}"
            : $"{url}?v={_globalVersion}";
    }

    public void Dispose() => _s3Client.Dispose();

    // Maps common image extensions to MIME types for S3 Content-Type headers
    private static string GuessContentType(string filename)
    {
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png"            => "image/png",
            ".webp"           => "image/webp",
            _                 => "application/octet-stream"
        };
    }
}
