using backend.Database;
using Microsoft.EntityFrameworkCore;

namespace backend.Jobs;

/// Daily retention sweep for the UserBrowsingEvents table.
/// Behavior events are append-only and have no natural archival point; without a
/// retention policy the table grows unbounded across an active user base.
/// Watch DNA only weighs the most recent ~30 days of activity anyway, so a 90-day
/// horizon is a safe cutoff with headroom for slower-cadence collectors.
public class BrowsingEventRetentionJob
{
    private readonly TourbillonContext _context;
    private readonly ILogger<BrowsingEventRetentionJob> _logger;

    public const int RetentionDays = 90;

    public BrowsingEventRetentionJob(
        TourbillonContext context,
        ILogger<BrowsingEventRetentionJob> logger)
    {
        _context = context;
        _logger  = logger;
    }

    public async Task<int> RunAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var deleted = await _context.Database.ExecuteSqlRawAsync(
            "DELETE FROM \"UserBrowsingEvents\" WHERE \"Timestamp\" < {0}",
            cutoff);

        _logger.LogInformation(
            "BrowsingEventRetentionJob deleted {Count} events older than {Cutoff:O}",
            deleted, cutoff);
        return deleted;
    }
}
