// Lexical, vector and fused retrieval as selectable modes of the watch finder endpoint.
// None of these runs the deterministic parser or the LLM, so each measures one retrieval design on
// its own; the fused mode is BM25F and cosine similarity combined by reciprocal rank fusion.
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed class HybridWatchRetrievalService
{
    // Depth of each list before fusion. Fusing only the heads would let one retriever's miss decide
    // the result; fifty from each leaves room for agreement to show further down.
    internal const int CandidateDepth = 50;

    private readonly ILexicalWatchSearch _lexical;
    private readonly WatchFinderService _finder;
    private readonly TourbillonContext _context;
    private readonly IStorageService _storage;

    public HybridWatchRetrievalService(
        ILexicalWatchSearch lexical,
        WatchFinderService finder,
        TourbillonContext context,
        IStorageService storage)
    {
        _lexical = lexical;
        _finder = finder;
        _context = context;
        _storage = storage;
    }

    public async Task<WatchFinderResult> SearchLexicalAsync(string query)
    {
        var hits = await _lexical.SearchAsync(query, CandidateDepth);
        return await BuildResultAsync(hits.Select(hit => hit.Id).ToList(), "bm25");
    }

    public async Task<WatchFinderResult> SearchHybridAsync(string query)
    {
        // The lexical index reads through its own scope, so it can run alongside the vector search
        // without two operations sharing this request's DbContext.
        var lexicalTask = _lexical.SearchAsync(query, CandidateDepth);
        var vector = await _finder.FindWatchesVectorOnlyAsync(query);
        var lexical = await lexicalTask;

        var lexicalIds = lexical.Select(hit => hit.Id).ToList();
        var vectorIds = vector.Watches.Concat(vector.OtherCandidates).Select(watch => watch.Id).ToList();
        var fused = ReciprocalRankFusion.Fuse([lexicalIds, vectorIds]);

        // The label names what actually contributed. When the embed call fails the vector list is
        // empty, and calling the result hybrid would hide that only one retriever ran.
        var path = vectorIds.Count == 0 ? "hybrid_rrf_lexical_only"
            : lexicalIds.Count == 0 ? "hybrid_rrf_vector_only"
            : "hybrid_rrf";
        return await BuildResultAsync(fused, path);
    }

    private async Task<WatchFinderResult> BuildResultAsync(IReadOnlyList<int> rankedIds, string searchPath)
    {
        var ids = rankedIds.Take(CandidateDepth).ToList();
        var watches = await _context.Watches
            .AsNoTracking()
            .Include(watch => watch.Brand)
            .Include(watch => watch.Collection)
            .Where(watch => ids.Contains(watch.Id))
            .ToListAsync();

        // IN has no order, so the ranking is restored from the list.
        var byId = watches.ToDictionary(watch => watch.Id);
        var ordered = ids.Where(byId.ContainsKey).Select(id => byId[id]).ToList();

        return new WatchFinderResult
        {
            Watches = ordered.Take(WatchFinderService.TopMatchLimit)
                .Select(watch => WatchDto.FromWatch(watch, _storage)).ToList(),
            OtherCandidates = ordered.Skip(WatchFinderService.TopMatchLimit)
                .Select(watch => WatchDto.FromWatch(watch, _storage)).ToList(),
            MatchDetails = [],
            ParsedIntent = null,
            SearchPath = searchPath,
        };
    }
}
