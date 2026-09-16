// Owns the in-memory BM25F index over the live catalogue and rebuilds it on a fixed lifetime.
// Registered as a singleton so the index is built once per lifetime rather than per request; it
// reads the database through a fresh scope because the DbContext itself is scoped.
using System.Diagnostics;
using backend.Database;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface ILexicalWatchSearch
{
    Task<IReadOnlyList<Bm25Hit>> SearchAsync(string query, int limit, CancellationToken cancellationToken = default);
}

public sealed class LexicalWatchSearchService : ILexicalWatchSearch
{
    // The catalogue changes when an admin scrapes or edits, not per request. A short lifetime keeps
    // edits visible within minutes without an invalidation hook in every write path.
    internal static readonly TimeSpan IndexLifetime = TimeSpan.FromMinutes(10);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LexicalWatchSearchService> _logger;
    private readonly TimeProvider _clock;
    private readonly SemaphoreSlim _buildGate = new(1, 1);
    private Bm25WatchIndex? _index;
    private DateTimeOffset _builtAt;

    public LexicalWatchSearchService(
        IServiceScopeFactory scopeFactory,
        ILogger<LexicalWatchSearchService> logger,
        TimeProvider? clock = null)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _clock = clock ?? TimeProvider.System;
    }

    public async Task<IReadOnlyList<Bm25Hit>> SearchAsync(
        string query, int limit, CancellationToken cancellationToken = default)
    {
        var index = await GetIndexAsync(cancellationToken);
        return index.Search(query, limit);
    }

    private bool IsFresh(Bm25WatchIndex? index) =>
        index != null && _clock.GetUtcNow() - _builtAt < IndexLifetime;

    private async Task<Bm25WatchIndex> GetIndexAsync(CancellationToken cancellationToken)
    {
        var current = _index;
        if (IsFresh(current))
            return current!;

        // One rebuild at a time; requests that arrive during it wait and then reuse the result.
        await _buildGate.WaitAsync(cancellationToken);
        try
        {
            if (IsFresh(_index))
                return _index!;

            var timer = Stopwatch.StartNew();
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<TourbillonContext>();
            var watches = await context.Watches
                .AsNoTracking()
                .Include(watch => watch.Brand)
                .Include(watch => watch.Collection)
                .ToListAsync(cancellationToken);

            var index = new Bm25WatchIndex(watches.Select(Bm25WatchDocuments.FromWatch));
            _index = index;
            _builtAt = _clock.GetUtcNow();
            _logger.LogInformation("BM25 index built documents={Count} elapsedMs={ElapsedMs}",
                index.DocumentCount, timer.ElapsedMilliseconds);
            return index;
        }
        finally
        {
            _buildGate.Release();
        }
    }
}
