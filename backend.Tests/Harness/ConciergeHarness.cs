// In-process concierge harness for reviewing prompt and reply quality.
// Runs the real ChatService against a seeded in-memory catalogue and a live ai-service,
// so C# and prompt changes can be exercised with `dotnet test` alone — no backend
// container rebuild, no browser, and no waiting for a model reload.
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using backend.Services;
using backend.Tests.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace backend.Tests.Harness;

// One concierge turn, flattened for printing. RoutingPath / SearchPath / Intent are
// recovered from ChatService's structured log output rather than the API response,
// which does not expose them.
public sealed record ConciergeTurn(
    int Index,
    string Prompt,
    string Message,
    string RoutingPath,
    string SearchPath,
    string Intent,
    double Confidence,
    IReadOnlyList<ChatWatchCard> Cards,
    IReadOnlyList<ChatAction> Actions,
    long ElapsedMs)
{
    public string Format()
    {
        var sb = new StringBuilder();
        sb.AppendLine(new string('-', 78));
        sb.AppendLine($"[{Index}] > {Prompt}");
        sb.AppendLine($"      intent={Intent} ({Confidence:F2})  path={RoutingPath}  finder={SearchPath}  {ElapsedMs}ms");
        sb.AppendLine();
        foreach (var line in Message.Split('\n'))
            sb.AppendLine($"  {line.TrimEnd()}");

        if (Cards.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine($"  Cards ({Cards.Count}):");
            foreach (var card in Cards)
            {
                var price = card.CurrentPrice == 0 ? "Price on Request" : $"AUD {card.CurrentPrice:N0}";
                sb.AppendLine($"    - {Truncate($"{card.BrandName} {card.CollectionName} {card.Name}".Trim(), 46),-46} {price,-18} {card.Slug}");
            }
        }

        if (Actions.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine($"  Actions ({Actions.Count}):");
            foreach (var action in Actions)
            {
                var detail = action.Type switch
                {
                    "compare" => $"slugs=[{string.Join(", ", action.Slugs ?? [])}]",
                    "search" => $"query=\"{action.Query}\"",
                    "navigate" => $"href={action.Href}",
                    "set_cursor" => $"cursor={action.Cursor}",
                    _ => "",
                };
                sb.AppendLine($"    {action.Type,-10} \"{action.Label}\" {detail}");
            }
        }

        return sb.ToString();
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..(max - 1)] + "…";
}

public sealed class ConciergeHarness : IDisposable
{
    // Host-mapped ai-service port from docker-compose. Override when running it elsewhere.
    public static string AiServiceUrl =>
        Environment.GetEnvironmentVariable("AI_SERVICE_URL") ?? "http://localhost:5000";

    private readonly TourbillonContext _context;
    private readonly ChatService _service;
    private readonly HarnessLogger _logger = new();
    private readonly HttpClient _httpClient;
    private string _sessionId = NewSessionId();
    private int _turnIndex;

    // Reply caching is bypassed by default: an identical prompt must re-run the full
    // pipeline, otherwise a prompt edit appears to change nothing.
    public bool BypassResponseCache { get; set; } = true;

    public ConciergeHarness(IWatchFinderService? watchFinder = null, IActionPlanner? planner = null)
    {
        _context = TestContextFactory.Create();
        ConciergeCatalogue.Seed(_context);

        _httpClient = new HttpClient { BaseAddress = new Uri(AiServiceUrl), Timeout = TimeSpan.FromSeconds(120) };
        var httpFactory = new SingleClientFactory(_httpClient);

        _service = new ChatService(
            httpFactory,
            _context,
            new FakeRedis(),
            TestContextFactory.ChatConfig(disableLimit: true),
            watchFinder ?? new CatalogueWatchFinder(_context),
            _logger,
            new ChatIntentClassifier(httpFactory),
            planner ?? new ActionPlannerService(httpFactory, NullLogger<ActionPlannerService>.Instance),
            new TestStorageService(),
            new MemoryCache(new MemoryCacheOptions()));
    }

    // Sends one message on the current session. Session history carries across calls,
    // so consecutive sends behave like a real multi-turn conversation.
    public async Task<ConciergeTurn> SendAsync(string prompt)
    {
        _logger.Entries.Clear();
        var sw = Stopwatch.StartNew();
        var response = await _service.HandleMessageAsync(
            _sessionId, prompt, userId: null, ipAddress: "harness",
            bypassResponseCache: BypassResponseCache);
        sw.Stop();

        return new ConciergeTurn(
            ++_turnIndex,
            prompt,
            response.Message,
            _logger.Value("RoutingPath") ?? "unknown",
            _logger.Value("SearchPath") ?? "-",
            _logger.Value("Intent") ?? "-",
            double.TryParse(_logger.Value("Confidence"), out var confidence) ? confidence : 0,
            response.WatchCards,
            response.Actions,
            sw.ElapsedMilliseconds);
    }

    public async Task<IReadOnlyList<ConciergeTurn>> ConverseAsync(params string[] prompts)
    {
        var turns = new List<ConciergeTurn>();
        foreach (var prompt in prompts)
            turns.Add(await SendAsync(prompt));
        return turns;
    }

    // Starts a fresh session — use between unrelated prompts so earlier turns do not
    // leak context into the next one.
    public void ResetSession()
    {
        _sessionId = NewSessionId();
        _turnIndex = 0;
    }

    private static string NewSessionId() => $"harness-{Guid.NewGuid():N}";

    public void Dispose()
    {
        _httpClient.Dispose();
        _context.Dispose();
    }

    private sealed class SingleClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;
        public SingleClientFactory(HttpClient client) => _client = client;
        public HttpClient CreateClient(string name) => _client;
    }

    // Captures ChatService's structured log state so the harness can report the routing
    // path and classifier verdict, which ChatApiResponse does not carry.
    private sealed class HarnessLogger : ILogger<ChatService>
    {
        public List<Dictionary<string, string?>> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (state is not IEnumerable<KeyValuePair<string, object?>> pairs)
                return;

            var entry = new Dictionary<string, string?>();
            foreach (var pair in pairs)
                entry[pair.Key] = pair.Value?.ToString();
            Entries.Add(entry);
        }

        // Last value wins — a turn logs the classifier verdict before the routing summary.
        public string? Value(string key)
        {
            for (var i = Entries.Count - 1; i >= 0; i--)
                if (Entries[i].TryGetValue(key, out var value) && !string.IsNullOrEmpty(value))
                    return value;
            return null;
        }
    }
}

// Stand-in for WatchFinderService: filters the seeded catalogue on brand, collection,
// style, and price cap. Enough to ground discovery replies without pgvector or embeddings.
// Swap in the real service via the ConciergeHarness constructor when retrieval itself,
// rather than wording, is what needs reviewing.
internal sealed class CatalogueWatchFinder : IWatchFinderService
{
    private readonly TourbillonContext _context;
    private readonly IStorageService _storage = new TestStorageService();

    public CatalogueWatchFinder(TourbillonContext context) => _context = context;

    public Task<WatchFinderResult> FindWatchesAsync(string query) =>
        FindWatchesAsync(query, Array.Empty<int>());

    public Task<WatchFinderResult> FindWatchesAsync(string query, IReadOnlyList<int> excludedBrandIds)
    {
        var watches = _context.Watches.ToList();
        var brands = _context.Brands.ToList();
        var collections = _context.Collections.ToList();
        var normalized = QueryNormalizer.NormalizeText(query);

        var matchedBrandIds = brands
            .Where(b => normalized.Contains(QueryNormalizer.NormalizeText(b.Name), StringComparison.Ordinal)
                || QueryNormalizer.BrandAliases.Any(a =>
                    Regex.IsMatch(query, $@"\b{Regex.Escape(a.Key)}\b", RegexOptions.IgnoreCase)
                    && QueryNormalizer.CompactText(a.Value) == QueryNormalizer.CompactText(b.Name)))
            .Select(b => b.Id)
            .ToHashSet();

        var matchedCollectionIds = collections
            .Where(c => normalized.Contains(QueryNormalizer.NormalizeText(c.Name), StringComparison.Ordinal))
            .Select(c => c.Id)
            .ToHashSet();

        var styleCollectionIds = collections
            .Where(c => c.Styles.Any(s => normalized.Contains(QueryNormalizer.NormalizeText(s), StringComparison.Ordinal)))
            .Select(c => c.Id)
            .ToHashSet();

        var filtered = watches.Where(w => !excludedBrandIds.Contains(w.BrandId));
        if (matchedBrandIds.Count > 0)
            filtered = filtered.Where(w => matchedBrandIds.Contains(w.BrandId));
        if (matchedCollectionIds.Count > 0)
            filtered = filtered.Where(w => w.CollectionId != null && matchedCollectionIds.Contains(w.CollectionId.Value));
        else if (styleCollectionIds.Count > 0)
            filtered = filtered.Where(w => w.CollectionId != null && styleCollectionIds.Contains(w.CollectionId.Value));

        // Price 0 is "Price on Request" and must survive a price cap rather than be filtered out.
        var priceCap = ParsePriceCap(query);
        if (priceCap != null)
            filtered = filtered.Where(w => w.CurrentPrice == 0 || w.CurrentPrice <= priceCap.Value);

        var results = filtered
            .OrderBy(w => w.BrandId).ThenBy(w => w.CurrentPrice)
            .Take(10)
            .Select(w => WatchDto.FromWatch(w, _storage))
            .ToList();

        return Task.FromResult(new WatchFinderResult
        {
            Watches = results,
            SearchPath = results.Count == 0 ? "vector_empty" : "harness_catalogue",
        });
    }

    private static decimal? ParsePriceCap(string query)
    {
        var match = Regex.Match(query,
            @"\b(?:under|below|less than|up to|max)\s*\$?\s*(\d[\d,.]*)\s*(k|m)?\b",
            RegexOptions.IgnoreCase);
        if (!match.Success || !decimal.TryParse(match.Groups[1].Value.Replace(",", ""), out var amount))
            return null;

        return match.Groups[2].Value.ToLowerInvariant() switch
        {
            "k" => amount * 1_000,
            "m" => amount * 1_000_000,
            _ => amount,
        };
    }
}
