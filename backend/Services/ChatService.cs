// Orchestrates the RAG chat concierge pipeline.
// Detects query type (PRODUCT/BRAND/GENERAL), fetches DB context, calls ai-service /chat,
// and returns the LLM response with extracted watch cards.
// Sessions are stored in Redis hashes with a 1-hour TTL.
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace backend.Services;

// ── DTOs ─────────────────────────────────────────────────────────────────────

// Used when serializing conversation history to ai-service — explicit type avoids
// System.Text.Json object-erasure when the payload is typed as List<object>.
// JsonPropertyName ensures lowercase keys match the Python side's expected format.
public class ChatHistoryEntry
{
    [JsonPropertyName("role")]    public string Role    { get; set; } = "";
    [JsonPropertyName("content")] public string Content { get; set; } = "";
}

public class ChatMessageRequest
{
    public string SessionId { get; set; } = "";
    public string Message { get; set; } = "";
    /// Summary of the user's recent browsing behavior and Watch DNA (formatted client-side).
    /// Injected into AI context to personalize responses without exposing raw event data.
    public string? BehaviorSummary { get; set; }
}

public class ChatWatchCard
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Description { get; set; }
    public string? Image { get; set; }
    public string? ImageUrl { get; set; }
    public decimal CurrentPrice { get; set; }
    public int BrandId { get; set; }
}

/// Concierge action returned alongside the text response — executed client-side.
public class ChatAction
{
    public string Type { get; set; } = "";   // "compare" | "search"
    public string Label { get; set; } = "";
    public List<string>? Slugs { get; set; } // watch slugs for "compare"
    public string? Query { get; set; }        // search query for "search"
}

public class ChatApiResponse
{
    public string Message { get; set; } = "";
    public List<ChatWatchCard> WatchCards { get; set; } = [];
    public List<ChatAction> Actions { get; set; } = [];
    public bool RateLimited { get; set; }
    public int? DailyUsed { get; set; }
    public int? DailyLimit { get; set; }
}

// ── Service ───────────────────────────────────────────────────────────────────

public class ChatService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly IRedisService _redis;
    private readonly IConfiguration _config;
    private readonly ILogger<ChatService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(1);

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
        IRedisService redis,
        IConfiguration config,
        ILogger<ChatService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _redis = redis;
        _config = config;
        _logger = logger;
    }

    // Loads history from Redis; returns empty list if session doesn't exist.
    private async Task<List<ChatMessage>> GetSessionHistoryAsync(string sessionId)
    {
        var json = await _redis.GetHashFieldAsync($"chat:session:{sessionId}", "history");
        if (json == null) return [];
        return JsonSerializer.Deserialize<List<ChatMessage>>(json, _jsonOptions) ?? [];
    }

    // Persists history to Redis, refreshing the 1-hour TTL.
    private async Task SaveSessionHistoryAsync(string sessionId, List<ChatMessage> history)
    {
        var json = JsonSerializer.Serialize(history, _jsonOptions);
        await _redis.SetHashFieldAsync($"chat:session:{sessionId}", "history", json, SessionTtl);
    }

    public async Task<ChatApiResponse> HandleMessageAsync(
        string sessionId, string message, string? userId, string? ipAddress, string? behaviorSummary = null)
    {
        // ── Rate limiting ─────────────────────────────────────────────────────────
        var disableLimit = _config.GetValue<bool>("ChatSettings:DisableLimitInDev");
        var dailyLimit   = _config.GetValue<int>("ChatSettings:DailyLimit", 5);

        if (!disableLimit)
        {
            var rlKey = $"chat_rl:{userId ?? ipAddress ?? "anon"}";
            var used = (int)(await _redis.GetCounterAsync(rlKey) ?? 0);
            if (used >= dailyLimit)
            {
                _logger.LogInformation(
                    "Chat rate limit hit userId={UserId} used={Used} limit={Limit}",
                    userId ?? "anonymous", used, dailyLimit);
                return new ChatApiResponse
                {
                    RateLimited = true,
                    DailyUsed   = used,
                    DailyLimit  = dailyLimit,
                    Message     = "You have reached your daily message limit. Please try again tomorrow."
                };
            }
        }

        // ── Session management (Redis) ────────────────────────────────────────────
        var sessionHistory = await GetSessionHistoryAsync(sessionId);

        // Last 10 turns — typed DTO avoids System.Text.Json object-erasure with anonymous types
        var history = sessionHistory
            .TakeLast(10)
            .Select(m => new ChatHistoryEntry { Role = m.Role, Content = m.Content })
            .ToList();

        // ── Query type detection + context fetch (wrapped to prevent 500s) ─────────
        var httpClient = _httpClientFactory.CreateClient("ai-service");
        List<string> contextStrings;
        var enableWebSearch = false;
        var queryType = QueryType.General;
        int? matchedBrandId, matchedCollectionId;

        try
        {
            (queryType, matchedBrandId, matchedCollectionId) = await DetectQueryTypeAsync(message);
            _logger.LogInformation(
                "Chat queryType={QueryType} brandId={BrandId} collectionId={CollectionId}",
                queryType, matchedBrandId, matchedCollectionId);

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
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Context fetch failed: {Err}", ex.Message);
            contextStrings = [];
            queryType = QueryType.General;
        }

        // Tell the AI when no catalogue data matched — prevents hallucination
        if (contextStrings.Count == 0 && queryType == QueryType.General)
            contextStrings.Add("No matching watches found in the Tourbillon catalogue for this query.");

        // Prepend user behavior summary so the AI can personalise responses when relevant
        if (!string.IsNullOrWhiteSpace(behaviorSummary))
            contextStrings.Insert(0, $"[User context] {behaviorSummary}");

        // ── Call ai-service /chat ─────────────────────────────────────────────────
        string aiMessage;
        List<ChatAction> actions = [];
        var chatSw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var payload = new { query = message, context = contextStrings, history, enableWebSearch };
            var resp    = await httpClient.PostAsJsonAsync("/chat", payload);
            chatSw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chat ai-service /chat returned {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, chatSw.ElapsedMilliseconds);
                aiMessage = "I'm having trouble connecting to the concierge service right now. Please try again in a moment.";
            }
            else
            {
                _logger.LogInformation("Chat ai-service /chat {ElapsedMs}ms", chatSw.ElapsedMilliseconds);
                var json  = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
                aiMessage = json.TryGetProperty("message", out var el) ? el.GetString() ?? "" : "";
                // Parse actions returned by ai-service (extracted from ACTIONS: line before text was returned)
                if (json.TryGetProperty("actions", out var actionsEl) && actionsEl.ValueKind == JsonValueKind.Array)
                {
                    try
                    {
                        actions = JsonSerializer.Deserialize<List<ChatAction>>(actionsEl.GetRawText(), _jsonOptions) ?? [];
                    }
                    catch { /* malformed actions — ignore, don't crash */ }
                }
            }
        }
        catch (Exception ex)
        {
            chatSw.Stop();
            _logger.LogWarning(ex, "Chat ai-service call threw after {ElapsedMs}ms", chatSw.ElapsedMilliseconds);
            aiMessage = "I'm having trouble connecting right now. Please try again in a moment.";
        }

        // ── Extract watch cards from response markdown links ──────────────────────
        var watchCards = await ExtractWatchCardsAsync(aiMessage);

        // ── Persist turn to session (Redis) ──────────────────────────────────────
        sessionHistory.Add(new ChatMessage { Role = "user",      Content = message  });
        sessionHistory.Add(new ChatMessage { Role = "assistant", Content = aiMessage });
        await SaveSessionHistoryAsync(sessionId, sessionHistory);

        // ── Increment rate limit counter (resets at midnight UTC) ────────────────
        int newUsed = 1;
        if (!disableLimit)
        {
            var rlKey = $"chat_rl:{userId ?? ipAddress ?? "anon"}";
            var ttlUntilMidnight = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
            newUsed = (int)await _redis.IncrementAsync(rlKey, ttlUntilMidnight);
        }

        return new ChatApiResponse
        {
            Message    = aiMessage,
            WatchCards = watchCards,
            Actions    = actions,
            DailyUsed  = disableLimit ? null : newUsed,
            DailyLimit = disableLimit ? null : dailyLimit,
        };
    }

    // Remove session from Redis
    public async Task ClearSessionAsync(string sessionId) =>
        await _redis.RemoveHashAsync($"chat:session:{sessionId}");

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

        // Prepend collection description with style label
        if (collectionId.HasValue)
        {
            var col = await _context.Collections.AsNoTracking().FirstOrDefaultAsync(c => c.Id == collectionId);
            if (col?.Description is { Length: > 0 } desc)
            {
                var style = !string.IsNullOrWhiteSpace(col.Style) ? $" [Style: {col.Style}]" : "";
                context.Add($"Collection \"{col.Name}\" (Slug: {col.Slug}){style}: {desc}");
            }
        }

        foreach (var w in watches)
        {
            var brand = w.Brand?.Name ?? "";
            var coll  = w.Collection?.Name ?? "";
            var price = w.CurrentPrice == 0 ? "Price on Request" : $"${w.CurrentPrice:N0}";
            context.Add($"[Watch Slug {w.Slug}] {brand} {coll} | Ref: {w.Name} | {price}\nDescription: {w.Description}\nSpecs: {w.Specs}");
        }

        // Include editorial insights (WhyItMatters, BestFor) for richer AI responses
        var watchIds = watches.Select(w => w.Id).ToList();
        var editorials = await _context.WatchEditorialLinks
            .Include(l => l.EditorialContent)
            .Where(l => watchIds.Contains(l.WatchId) && l.EditorialContent != null)
            .AsNoTracking()
            .ToListAsync();

        foreach (var link in editorials)
        {
            var ed = link.EditorialContent!;
            var editWatch = watches.FirstOrDefault(w => w.Id == link.WatchId);
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(ed.WhyItMatters)) parts.Add(ed.WhyItMatters);
            if (!string.IsNullOrWhiteSpace(ed.BestFor)) parts.Add($"Best for: {ed.BestFor}");
            if (parts.Count > 0)
                context.Add($"[Editorial for {editWatch?.Slug ?? link.WatchId.ToString()}] {string.Join(" ", parts)}");
        }

        return context;
    }

    private async Task<List<string>> FetchBrandContextAsync(int brandId)
    {
        var brand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == brandId);
        if (brand == null) return [];

        var context = new List<string>
        {
            $"Brand \"{brand.Name}\" (Slug: {brand.Slug}):\n{brand.Description}\n{brand.Summary}"
        };

        var collections = await _context.Collections
            .Where(c => c.BrandId == brandId)
            .AsNoTracking()
            .ToListAsync();

        foreach (var col in collections)
        {
            if (!string.IsNullOrWhiteSpace(col.Description))
            {
                var style = !string.IsNullOrWhiteSpace(col.Style) ? $" [Style: {col.Style}]" : "";
                context.Add($"Collection \"{col.Name}\" (Slug: {col.Slug}){style}: {col.Description}");
            }
        }

        // Sample editorial from this brand's watches for richer context
        var brandEditorials = await _context.WatchEditorialLinks
            .Include(l => l.EditorialContent)
            .Include(l => l.Watch)
            .Where(l => l.Watch.BrandId == brandId && l.EditorialContent != null)
            .Take(3)
            .AsNoTracking()
            .ToListAsync();

        foreach (var link in brandEditorials)
        {
            var ed = link.EditorialContent!;
            if (!string.IsNullOrWhiteSpace(ed.WhyItMatters))
                context.Add($"[Editorial — {link.Watch.Name}] {ed.WhyItMatters}");
        }

        return context;
    }

    private async Task<List<string>> FetchGeneralContextAsync(HttpClient httpClient, string query)
    {
        // Embed query → cosine search against watch_finder feature embeddings
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
            .Where(e => e.Feature == "watch_finder" && e.Embedding != null)
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
            context.Add($"[Watch Slug {w.Slug}] {brand} {coll} | {w.Name} | {price}\n{row.ChunkText}");

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
        // Match slug-based watch links: /watches/{slug} where slug is alphanumeric + hyphens
        var slugs = Regex.Matches(message, @"/watches/([\w-]+)")
            .Select(m => m.Groups[1].Value)
            .Distinct()
            .Take(5)
            .ToList();

        if (slugs.Count == 0) return [];

        var watches = await _context.Watches
            .Where(w => slugs.Contains(w.Slug))
            .AsNoTracking()
            .ToListAsync();

        return watches.Select(w => new ChatWatchCard
        {
            Id           = w.Id,
            Name         = w.Name,
            Slug         = w.Slug,
            Description  = w.Description,
            Image        = w.Image,
            ImageUrl     = w.GetImageUrl("dcd9lcdoj"),
            CurrentPrice = w.CurrentPrice,
            BrandId      = w.BrandId,
        }).ToList();
    }
}
