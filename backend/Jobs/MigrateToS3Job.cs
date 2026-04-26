using backend.Database;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Jobs;

/// One-time Hangfire job to copy all watch images from Cloudinary to S3.
/// Images are downloaded from the current Cloudinary CDN URL and uploaded to S3 at the same key path.
/// Watch.Image in the database is NOT modified — the same public ID works for both providers.
public class MigrateToS3Job
{
    private readonly TourbillonContext _context;
    private readonly S3StorageService _s3;
    private readonly ILogger<MigrateToS3Job> _logger;
    private readonly IConfiguration _configuration;

    public MigrateToS3Job(
        TourbillonContext context,
        S3StorageService s3,
        ILogger<MigrateToS3Job> logger,
        IConfiguration configuration)
    {
        _context       = context;
        _s3            = s3;
        _logger        = logger;
        _configuration = configuration;
    }

    public async Task RunAsync()
    {
        var watches = await _context.Watches
            .Where(w => w.Image != null && w.Image.StartsWith("watches/"))
            .ToListAsync();

        int success = 0;
        var errors  = new List<string>();

        var cloudName = _configuration["Cloudinary:CloudName"] ?? "dcd9lcdoj";

        foreach (var watch in watches)
        {
            try
            {
                var cloudinaryUrl = $"https://res.cloudinary.com/{cloudName}/image/upload/{watch.Image}";
                var result = await _s3.UploadImageFromUrlAsync(cloudinaryUrl, watch.Image!);
                if (!string.IsNullOrEmpty(result))
                    success++;
                else
                    errors.Add($"Watch {watch.Id}: S3 upload returned empty publicId");
            }
            catch (Exception ex)
            {
                errors.Add($"Watch {watch.Id}: {ex.Message}");
                _logger.LogError(ex, "Failed to migrate watch {Id} to S3", watch.Id);
            }
        }

        _logger.LogInformation(
            "S3 migration complete: {Success}/{Total} succeeded, {Errors} errors",
            success, watches.Count, errors.Count);
    }
}
