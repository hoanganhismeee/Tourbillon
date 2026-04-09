using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface IDeterministicWatchSearchService
{
    Task<WatchFinderResult?> TryDirectSqlSearchAsync(string query, QueryIntent? intent, string searchPath);
    Task<WatchFinderResult?> TryDeterministicCatalogueFallbackAsync(string query, QueryIntent intent, string searchPath);
}

public class DeterministicWatchSearchService : IDeterministicWatchSearchService
{
    private readonly TourbillonContext _context;
    private readonly ILogger<DeterministicWatchSearchService> _logger;

    public DeterministicWatchSearchService(
        TourbillonContext context,
        ILogger<DeterministicWatchSearchService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<WatchFinderResult?> TryDirectSqlSearchAsync(string query, QueryIntent? intent, string searchPath)
    {
        var isReferenceQuery = WatchFinderService.IsLikelyReferenceQuery(query);
        var isReferenceFragment = WatchFinderService.IsLikelyReferenceFragment(query);
        var isReferenceLike = isReferenceQuery || isReferenceFragment;
        var hasEntityIntent = intent?.BrandId != null || intent?.BrandIds.Count > 0
            || WatchFinderService.HasStrictCollectionIntent(intent);
        var isDeterministicCatalogueQuery = WatchFinderService.ShouldUseDeterministicCataloguePath(query, intent);

        if (!isReferenceLike && !hasEntityIntent && !isDeterministicCatalogueQuery)
            return null;

        var strictQuery = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .AsQueryable();

        List<int> styleCollectionIds = [];

        if (intent?.BrandId != null)
            strictQuery = strictQuery.Where(w => w.BrandId == intent.BrandId);
        if (intent?.BrandIds.Count > 0)
            strictQuery = strictQuery.Where(w => intent.BrandIds.Contains(w.BrandId));
        if (WatchFinderService.HasStrictCollectionIntent(intent) && intent?.CollectionId != null)
            strictQuery = strictQuery.Where(w => w.CollectionId == intent.CollectionId);
        if (WatchFinderService.HasStrictCollectionIntent(intent) && intent?.CollectionIds.Count > 0)
            strictQuery = strictQuery.Where(w => w.CollectionId != null && intent.CollectionIds.Contains(w.CollectionId.Value));
        if (intent?.MaxPrice != null)
            strictQuery = strictQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= intent.MaxPrice);
        if (intent?.MinPrice != null)
            strictQuery = strictQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= intent.MinPrice);
        if (intent?.Style != null && WatchFinderService.ShouldApplyStyleSqlFilter(intent))
        {
            styleCollectionIds = await _context.Collections
                .Where(c => c.Style == intent.Style)
                .Select(c => c.Id)
                .ToListAsync();
            if (styleCollectionIds.Count > 0)
                strictQuery = strictQuery.Where(w => w.CollectionId != null && styleCollectionIds.Contains(w.CollectionId.Value));
        }

        var strictCandidates = isReferenceLike
            ? await strictQuery.ToListAsync()
            : await strictQuery.Take(isDeterministicCatalogueQuery ? 500 : 300).ToListAsync();

        var relaxedCandidates = new List<Watch>();
        if (strictCandidates.Count < WatchFinderService.TopMatchLimit && !WatchFinderService.HasStrictCollectionIntent(intent))
        {
            var relaxedQuery = _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .AsNoTracking()
                .AsQueryable();

            if (intent?.MaxPrice != null)
                relaxedQuery = relaxedQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= intent.MaxPrice);
            if (intent?.MinPrice != null)
                relaxedQuery = relaxedQuery.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= intent.MinPrice);

            if (!WatchFinderService.HasStrictCollectionIntent(intent) && intent?.BrandId != null)
                relaxedQuery = relaxedQuery.Where(w => w.BrandId == intent.BrandId);
            else if (!WatchFinderService.HasStrictCollectionIntent(intent) && intent?.BrandIds.Count > 0)
                relaxedQuery = relaxedQuery.Where(w => intent.BrandIds.Contains(w.BrandId));
            else if (styleCollectionIds.Count > 0)
                relaxedQuery = relaxedQuery.Where(w => w.CollectionId != null && styleCollectionIds.Contains(w.CollectionId.Value));

            relaxedCandidates = await relaxedQuery
                .OrderByDescending(w => w.Id)
                .Take(isReferenceLike ? 800 : isDeterministicCatalogueQuery ? 800 : 500)
                .ToListAsync();
        }

        var candidates = strictCandidates
            .Concat(relaxedCandidates)
            .GroupBy(w => w.Id)
            .Select(g => g.First())
            .ToList();
        if (candidates.Count == 0)
        {
            _logger.LogInformation(
                "WatchFinder direct SQL zero-candidate query={QueryPreview} searchPath={SearchPath} entityIntent={HasEntityIntent} deterministicCatalogue={DeterministicCatalogue}",
                query.Length > 60 ? query[..60] + "..." : query,
                searchPath,
                hasEntityIntent,
                isDeterministicCatalogueQuery);
            return (hasEntityIntent || isDeterministicCatalogueQuery) && !isReferenceLike ? EmptyResult(intent, searchPath) : null;
        }

        List<Watch> ranked;
        if (isReferenceLike)
        {
            ranked = candidates
                .Select(w => new { Watch = w, Score = WatchFinderService.DirectSqlScore(query, w, intent, true) })
                .Where(x => x.Score >= 900)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
                .Select(x => x.Watch)
                .ToList();

            if (ranked.Count == 0)
                return null;
        }
        else
        {
            ranked = candidates
                .Select(w => new
                {
                    Watch = w,
                    Score = WatchFinderService.DirectSqlScore(query, w, intent, false)
                        + WatchFinderService.DeterministicMatchScore(w, intent, styleCollectionIds)
                })
                .Where(x => !isDeterministicCatalogueQuery || WatchFinderService.MatchesDeterministicIntent(x.Watch, intent, styleCollectionIds))
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
                .Select(x => x.Watch)
                .ToList();
        }

        if (ranked.Count == 0)
        {
            if (isDeterministicCatalogueQuery && candidates.Count > 0)
            {
                var relaxedRanked = candidates
                    .Select(w => new
                    {
                        Watch = w,
                        Score = WatchFinderService.DirectSqlScore(query, w, intent, false)
                            + WatchFinderService.RelaxedDeterministicScore(w, intent, styleCollectionIds)
                    })
                    .OrderByDescending(x => x.Score)
                    .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
                    .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
                    .Select(x => x.Watch)
                    .ToList();

                if (relaxedRanked.Count > 0)
                {
                    _logger.LogInformation(
                        "WatchFinder direct SQL relaxed fallback query={QueryPreview} candidates={CandidateCount}",
                        query.Length > 60 ? query[..60] + "..." : query,
                        relaxedRanked.Count);
                    return BuildResult(relaxedRanked, intent, searchPath);
                }
            }

            _logger.LogInformation(
                "WatchFinder direct SQL zero-ranked query={QueryPreview} searchPath={SearchPath} candidates={CandidateCount} entityIntent={HasEntityIntent} deterministicCatalogue={DeterministicCatalogue}",
                query.Length > 60 ? query[..60] + "..." : query,
                searchPath,
                candidates.Count,
                hasEntityIntent,
                isDeterministicCatalogueQuery);
            return (hasEntityIntent || isDeterministicCatalogueQuery) && !isReferenceLike ? EmptyResult(intent, searchPath) : null;
        }

        _logger.LogInformation(
            "WatchFinder direct SQL path query={QueryPreview} candidates={CandidateCount}",
            query.Length > 60 ? query[..60] + "..." : query,
            ranked.Count);

        return BuildResult(ranked, intent, searchPath);
    }

    public async Task<WatchFinderResult?> TryDeterministicCatalogueFallbackAsync(string query, QueryIntent intent, string searchPath)
    {
        var q = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .AsQueryable();

        if (intent.BrandId != null)
            q = q.Where(w => w.BrandId == intent.BrandId);
        if (intent.BrandIds.Count > 0)
            q = q.Where(w => intent.BrandIds.Contains(w.BrandId));
        if (WatchFinderService.HasStrictCollectionIntent(intent) && intent.CollectionId != null)
            q = q.Where(w => w.CollectionId == intent.CollectionId);
        if (WatchFinderService.HasStrictCollectionIntent(intent) && intent.CollectionIds.Count > 0)
            q = q.Where(w => w.CollectionId != null && intent.CollectionIds.Contains(w.CollectionId.Value));
        if (intent.MaxPrice != null)
            q = q.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= intent.MaxPrice);
        if (intent.MinPrice != null)
            q = q.Where(w => w.CurrentPrice == 0 || w.CurrentPrice >= intent.MinPrice);

        var styleCollectionIds = new List<int>();
        if (intent.Style != null && WatchFinderService.ShouldApplyStyleSqlFilter(intent))
        {
            styleCollectionIds = await _context.Collections
                .Where(c => c.Style == intent.Style)
                .Select(c => c.Id)
                .ToListAsync();
            if (styleCollectionIds.Count > 0)
                q = q.Where(w => w.CollectionId != null && styleCollectionIds.Contains(w.CollectionId.Value));
        }

        var candidates = await q
            .OrderByDescending(w => w.Id)
            .Take(1000)
            .ToListAsync();

        if (candidates.Count == 0)
            return WatchFinderService.HasBrandIntent(intent) || WatchFinderService.HasCollectionIntent(intent)
                ? EmptyResult(intent, searchPath)
                : null;

        var ranked = candidates
            .Where(w => WatchFinderService.MatchesDeterministicIntent(w, intent, styleCollectionIds))
            .Select(w => new
            {
                Watch = w,
                Score = WatchFinderService.DirectSqlScore(query, w, intent, false)
                    + WatchFinderService.DeterministicMatchScore(w, intent, styleCollectionIds)
            })
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
            .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
            .Select(x => x.Watch)
            .ToList();

        if (ranked.Count == 0)
        {
            var relaxedRanked = candidates
                .Select(w => new
                {
                    Watch = w,
                    Score = WatchFinderService.DirectSqlScore(query, w, intent, false)
                        + WatchFinderService.RelaxedDeterministicScore(w, intent, styleCollectionIds)
                })
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? 1 : 0)
                .ThenBy(x => x.Watch.CurrentPrice == 0 ? decimal.MaxValue : x.Watch.CurrentPrice)
                .Select(x => x.Watch)
                .ToList();

            if (relaxedRanked.Count > 0)
            {
                _logger.LogInformation(
                    "WatchFinder deterministic fallback relaxed query={QueryPreview} candidates={CandidateCount}",
                    query.Length > 60 ? query[..60] + "..." : query,
                    relaxedRanked.Count);
                return BuildResult(relaxedRanked, intent, searchPath);
            }

            return WatchFinderService.HasBrandIntent(intent) || WatchFinderService.HasCollectionIntent(intent)
                ? EmptyResult(intent, searchPath)
                : null;
        }

        _logger.LogInformation(
            "WatchFinder deterministic fallback path query={QueryPreview} candidates={CandidateCount}",
            query.Length > 60 ? query[..60] + "..." : query,
            ranked.Count);

        return BuildResult(ranked, intent, searchPath);
    }

    private static WatchFinderResult BuildResult(List<Watch> ranked, QueryIntent? intent, string searchPath) => new()
    {
        Watches = ranked.Take(WatchFinderService.TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
        OtherCandidates = ranked.Skip(WatchFinderService.TopMatchLimit).Select(w => WatchDto.FromWatch(w)).ToList(),
        MatchDetails = [],
        ParsedIntent = null,
        QueryIntent = intent,
        SearchPath = searchPath
    };

    private static WatchFinderResult EmptyResult(QueryIntent? intent = null, string? searchPath = null) => new()
    {
        Watches = [],
        OtherCandidates = [],
        MatchDetails = [],
        ParsedIntent = null,
        QueryIntent = intent,
        SearchPath = searchPath
    };
}
