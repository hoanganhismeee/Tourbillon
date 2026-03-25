// Orchestrates the RAG chat concierge pipeline.
// Detects query type (PRODUCT/BRAND/GENERAL), fetches DB context, calls ai-service /chat,
// and returns the LLM response with extracted watch cards.
using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace backend.Services;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public class ChatMessageRequest
{
    public string SessionId { get; set; } = "";
    public string Message { get; set; } = "";
}

public class ChatWatchCard
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Image { get; set; }
    public string? ImageUrl { get; set; }
    public decimal CurrentPrice { get; set; }
    public int BrandId { get; set; }
}

public class ChatApiResponse
{
    public string Message { get; set; } = "";
    public List<ChatWatchCard> WatchCards { get; set; } = [];
    public bool RateLimited { get; set; }
    public int? DailyUsed { get; set; }
    public int? DailyLimit { get; set; }
}

// ── Service ───────────────────────────────────────────────────────────────────

public class ChatService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly ConcurrentDictionary<string, ChatSession> _sessions;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;
    private readonly ILogger<ChatService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    // Brand name aliases shared with WatchFinderService — short names users commonly type
    private static readonly Dictionary<string, string> _brandAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["JLC"] = "Jaeger-LeCoultre",   ["AP"]  = "Audemars Piguet",
        ["VC"]  = "Vacheron Constantin", ["PP"]  = "Patek Philippe",
        ["ALS"] = "A. Lange & Söhne",   ["GS"]  = "Grand Seiko",
        ["GO"]  = "Glashütte Original", ["FC"]  = "Frederique Constant",
        ["Vacheron"]  = "Vacheron Constantin",  ["Patek"]      = "Patek Philippe",
        ["Audemars"]  = "Audemars Piguet",      ["Lange"]      = "A. Lange & Söhne",
        ["Glashutte"] = "Glashütte Original",   ["Glashütte"]  = "Glashütte Original",
        ["Frederique"]= "Frederique Constant",  ["FP Journe"]  = "F.P.Journe",
        ["FPJourne"]  = "F.P.Journe",           ["Journe"]     = "F.P.Journe",
    };

    private enum QueryType { Product, Brand, General }

    public ChatService(
        IHttpClientFactory httpClientFactory,
        TourbillonContext context,
        ConcurrentDictionary<string, ChatSession> sessions,
        IMemoryCache cache,
        IConfiguration config,
        ILogger<ChatService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _sessions = sessions;
        _cache = cache;
        _config = config;
        _logger = logger;
    }

    public async Task<ChatApiResponse> HandleMessageAsync(
        string sessionId, string message, string? userId, string? ipAddress)
    {
        // ── Rate limiting ─────────────────────────────────────────────────────────
        var disableLimit = _config.GetValue<bool>("ChatSettings:DisableLimitInDev");
        var dailyLimit   = _config.GetValue<int>("ChatSettings:DailyLimit", 5);

        if (!disableLimit)
        {
            var rlKey = $"chat_rl_{userId ?? ipAddress ?? "anon"}";
            _cache.TryGetValue(rlKey, out int used);
            if (used >= dailyLimit)
                return new ChatApiResponse
                {
                    RateLimited = true,
                    DailyUsed   = used,
                    DailyLimit  = dailyLimit,
                    Message     = "You have reached your daily message limit. Please try again tomorrow."
                };
        }

        // ── Session management ────────────────────────────────────────────────────
        _sessions.TryGetValue(sessionId, out var session);
        if (session == null)
        {
            session = new ChatSession { SessionId = sessionId, LastActivity = DateTime.UtcNow };
            _sessions[sessionId] = session;
        }
        else
        {
            session.LastActivity = DateTime.UtcNow;
        }

        // Last 10 turns capped to stay within ai-service token budget
        var history = session.History
            .TakeLast(10)
            .Select(m => new { role = m.Role, content = m.Content })
            .Cast<object>()
            .ToList();

        // ── Query type detection ──────────────────────────────────────────────────
        var httpClient = _httpClientFactory.CreateClient("ai-service");
        var (queryType, matchedBrandId, matchedCollectionId) = await DetectQueryTypeAsync(message);

        // ── Fetch context ─────────────────────────────────────────────────────────
        List<string> contextStrings;
        var enableWebSearch = false;

        switch (queryType)
        {
            case QueryType.Product:
                contextStrings = await FetchProductContextAsync(matchedCollectionId, message);
                break;
            case QueryType.Brand:
                contextStrings = await FetchBrandContextAsync(matchedBrandId!.Value);
                enableWebSearch = true;
                break;
            default:
                contextStrings = await FetchGeneralContextAsync(httpClient, message);
                break;
        }

        // ── Call ai-service /chat ─────────────────────────────────────────────────
        string aiMessage;
        try
        {
            var payload = new { query = message, context = contextStrings, history, enableWebSearch };
            var resp    = await httpClient.PostAsJsonAsync("/chat", payload);

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("ai-service /chat returned {Status}", resp.StatusCode);
                aiMessage = "I'm having trouble connecting to the concierge service right now. Please try again in a moment.";
            }
            else
            {
                var json  = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
                aiMessage = json.TryGetProperty("message", out var el) ? el.GetString() ?? "" : "";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Chat ai-service call failed: {Err}", ex.Message);
            aiMessage = "I'm having trouble connecting right now. Please try again in a moment.";
        }

        // ── Extract watch cards from response markdown links ──────────────────────
        var watchCards = await ExtractWatchCardsAsync(aiMessage);

        // ── Persist turn to session ───────────────────────────────────────────────
        session.History.Add(new ChatMessage { Role = "user",      Content = message  });
        session.History.Add(new ChatMessage { Role = "assistant", Content = aiMessage });

        // ── Increment rate limit counter ──────────────────────────────────────────
        int newUsed = 1;
        if (!disableLimit)
        {
            var rlKey = $"chat_rl_{userId ?? ipAddress ?? "anon"}";
            _cache.TryGetValue(rlKey, out int cur);
            newUsed = cur + 1;
            _cache.Set(rlKey, newUsed, new MemoryCacheEntryOptions
            {
                // Resets at midnight UTC
                AbsoluteExpiration = new DateTimeOffset(DateTime.UtcNow.Date.AddDays(1), TimeSpan.Zero)
            });
        }

        return new ChatApiResponse
        {
            Message    = aiMessage,
            WatchCards = watchCards,
            DailyUsed  = disableLimit ? null : newUsed,
            DailyLimit = disableLimit ? null : dailyLimit,
        };
    }

    // Remove session from in-memory store
    public void ClearSession(string sessionId) => _sessions.TryRemove(sessionId, out _);

    // ── Query type detection ──────────────────────────────────────────────────────

    private async Task<(QueryType Type, int? BrandId, int? CollectionId)> DetectQueryTypeAsync(string query)
    {
        var brands      = await _context.Brands.AsNoTracking().ToListAsync();
        var collections = await _context.Collections.AsNoTracking().ToListAsync();

        // Collection match wins (more specific) → PRODUCT
        var col = collections
            .OrderByDescending(c => c.Name.Length)
            .FirstOrDefault(c => query.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
        if (col != null)
            return (QueryType.Product, col.BrandId, col.Id);

        // Brand alias match → BRAND
        Brand? brand = null;
        foreach (var (alias, canonical) in _brandAliases)
        {
            if (Regex.IsMatch(query, @$"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
            {
                brand = brands.FirstOrDefault(b => b.Name.Equals(canonical, StringComparison.OrdinalIgnoreCase));
                if (brand != null) break;
            }
        }
        if (brand == null)
        {
            brand = brands
                .OrderByDescending(b => b.Name.Length)
                .FirstOrDefault(b => query.Contains(b.Name, StringComparison.OrdinalIgnoreCase));
        }
        if (brand != null)
            return (QueryType.Brand, brand.Id, null);

        return (QueryType.General, null, null);
    }

    // ── Context fetchers ──────────────────────────────────────────────────────────

    private async Task<List<string>> FetchProductContextAsync(int? collectionId, string query)
    {
        var watchQuery = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking();

        List<Watch> watches;
        if (collectionId.HasValue)
        {
            watches = await watchQuery
                .Where(w => w.CollectionId == collectionId)
                .Take(10)
                .ToListAsync();
        }
        else
        {
            // Fallback to name/description substring match
            var q = query.ToLower();
            watches = await watchQuery
                .Where(w => (w.Description != null && w.Description.ToLower().Contains(q))
                         || w.Name.ToLower().Contains(q))
                .Take(10)
                .ToListAsync();
        }

        var context = new List<string>();

        // Prepend collection description
        if (collectionId.HasValue)
        {
            var col = await _context.Collections.AsNoTracking().FirstOrDefaultAsync(c => c.Id == collectionId);
            if (col?.Description is { Length: > 0 } desc)
                context.Add($"Collection \"{col.Name}\" (ID: {col.Id}): {desc}");
        }

        foreach (var w in watches)
        {
            var brand = w.Brand?.Name ?? "";
            var coll  = w.Collection?.Name ?? "";
            var price = w.CurrentPrice == 0 ? "Price on Request" : $"${w.CurrentPrice:N0}";
            context.Add($"[Watch ID {w.Id}] {brand} {coll} | Ref: {w.Name} | {price}\nDescription: {w.Description}\nSpecs: {w.Specs}");
        }

        return context;
    }

    private async Task<List<string>> FetchBrandContextAsync(int brandId)
    {
        var brand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == brandId);
        if (brand == null) return [];

        var context = new List<string>
        {
            $"Brand \"{brand.Name}\" (ID: {brand.Id}):\n{brand.Description}\n{brand.Summary}"
        };

        var collections = await _context.Collections
            .Where(c => c.BrandId == brandId)
            .AsNoTracking()
            .ToListAsync();

        foreach (var col in collections)
        {
            if (!string.IsNullOrWhiteSpace(col.Description))
                context.Add($"Collection \"{col.Name}\" (ID: {col.Id}): {col.Description}");
        }

        return context;
    }

    private async Task<List<string>> FetchGeneralContextAsync(HttpClient httpClient, string query)
    {
        // Embed query → cosine search against rag_chat feature embeddings
        float[]? embedding = null;
        try
        {
            var embedResp = await httpClient.PostAsJsonAsync("/embed", new { texts = new[] { query } });
            if (embedResp.IsSuccessStatusCode)
            {
                var json = await embedResp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
                if (json.TryGetProperty("embeddings", out var embEl))
                {
                    var embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
                    embedding = embeddings?.Count > 0 ? embeddings[0] : null;
                }
            }
        }
        catch { /* embed unavailable — return empty context */ }

        if (embedding == null) return [];

        var queryVector = new Vector(embedding);

        var rows = await _context.WatchEmbeddings
            .Include(e => e.Watch).ThenInclude(w => w.Brand)
            .Include(e => e.Watch).ThenInclude(w => w.Collection)
            .Where(e => e.Feature == "rag_chat" && e.Embedding != null)
            .OrderBy(e => e.Embedding!.CosineDistance(queryVector))
            .Take(25)
            .ToListAsync();

        // Deduplicate per watch — keep best-scoring chunk
        var seen    = new HashSet<int>();
        var context = new List<string>();
        var seenCols = new HashSet<int>();

        foreach (var row in rows)
        {
            if (!seen.Add(row.WatchId)) continue;

            var w     = row.Watch;
            var brand = w.Brand?.Name ?? "";
            var coll  = w.Collection?.Name ?? "";
            var price = w.CurrentPrice == 0 ? "Price on Request" : $"${w.CurrentPrice:N0}";
            context.Add($"[Watch ID {w.Id}] {brand} {coll} | {w.Name} | {price}\n{row.ChunkText}");

            // Include collection description once per collection
            if (w.CollectionId.HasValue && seenCols.Add(w.CollectionId.Value))
            {
                var colDesc = w.Collection?.Description;
                if (!string.IsNullOrWhiteSpace(colDesc))
                    context.Add($"Collection \"{coll}\": {colDesc}");
            }

            if (context.Count >= 12) break;
        }

        return context;
    }

    // ── Extract watch cards from markdown links in AI response ────────────────────

    private async Task<List<ChatWatchCard>> ExtractWatchCardsAsync(string message)
    {
        var ids = Regex.Matches(message, @"/watches/(\d+)")
            .Select(m => int.Parse(m.Groups[1].Value))
            .Distinct()
            .Take(5)
            .ToList();

        if (ids.Count == 0) return [];

        var watches = await _context.Watches
            .Where(w => ids.Contains(w.Id))
            .AsNoTracking()
            .ToListAsync();

        return watches.Select(w => new ChatWatchCard
        {
            Id           = w.Id,
            Name         = w.Name,
            Description  = w.Description,
            Image        = w.Image,
            ImageUrl     = w.GetImageUrl("dcd9lcdoj"),
            CurrentPrice = w.CurrentPrice,
            BrandId      = w.BrandId,
        }).ToList();
    }
}
