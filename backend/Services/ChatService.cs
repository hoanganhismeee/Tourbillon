// Chat concierge orchestration for Tourbillon.
// Resolves exact watches, compare requests, and discovery redirects before using the LLM,
// then sends only compact Tourbillon-specific context to ai-service when explanation helps.
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface IWatchFinderService
{
    Task<WatchFinderResult> FindWatchesAsync(string query);
}

// Used when serializing conversation history to ai-service.
public class ChatHistoryEntry
{
    [JsonPropertyName("role")] public string Role { get; set; } = "";
    [JsonPropertyName("content")] public string Content { get; set; } = "";
}

public class ChatMessageRequest
{
    public string SessionId { get; set; } = "";
    public string Message { get; set; } = "";

    // Summary of the user's recent browsing behavior and Watch DNA.
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

// Concierge action returned alongside the text response and executed client-side.
public class ChatAction
{
    public string Type { get; set; } = "";   // "compare" | "search" | "set_cursor"
    public string Label { get; set; } = "";
    public List<string>? Slugs { get; set; } // watch slugs for "compare"
    public string? Query { get; set; }       // search query for "search"
    public string? Cursor { get; set; }      // cursor id for "set_cursor"
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

public class ChatService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly IRedisService _redis;
    private readonly IConfiguration _config;
    private readonly IWatchFinderService _watchFinderService;
    private readonly ILogger<ChatService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(1);
    private const string CloudName = "dcd9lcdoj";
    private const int DiscoveryCardLimit = 5;

    // Brand name aliases shared with WatchFinderService.
    private static readonly Dictionary<string, string> _brandAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["JLC"] = "Jaeger-LeCoultre",
        ["AP"] = "Audemars Piguet",
        ["VC"] = "Vacheron Constantin",
        ["PP"] = "Patek Philippe",
        ["ALS"] = "A. Lange & Sohne",
        ["GS"] = "Grand Seiko",
        ["GO"] = "Glashutte Original",
        ["FC"] = "Frederique Constant",
        ["Vacheron"] = "Vacheron Constantin",
        ["Patek"] = "Patek Philippe",
        ["Audemars"] = "Audemars Piguet",
        ["Lange"] = "A. Lange & Sohne",
        ["Glashutte"] = "Glashutte Original",
        ["Frederique"] = "Frederique Constant",
        ["FP Journe"] = "F.P.Journe",
        ["FPJourne"] = "F.P.Journe",
        ["Journe"] = "F.P.Journe",
    };

    private static readonly Dictionary<string, string> _cursorAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["default"] = "default",
        ["system"] = "default",
        ["tourbillon"] = "tourbillon",
        ["crosshair"] = "crosshair",
        ["lumed"] = "lumed",
        ["lume"] = "lumed",
        ["hand"] = "hand",
        ["watch hand"] = "hand",
        ["bezel"] = "bezel",
        ["compass"] = "compass",
        ["sapphire"] = "sapphire",
        ["rotor"] = "rotor",
    };

    private sealed class ChatResolution
    {
        public bool UseAi { get; set; }
        public string Message { get; set; } = "";
        public string Query { get; set; } = "";
        public List<string> Context { get; set; } = [];
        public List<ChatWatchCard> WatchCards { get; set; } = [];
        public List<ChatAction> Actions { get; set; } = [];
        public ChatSessionState? SessionState { get; set; }
    }

    private sealed class EntityMentions
    {
        public List<Brand> Brands { get; set; } = [];
        public List<Collection> Collections { get; set; } = [];
        public bool HasAny => Brands.Count > 0 || Collections.Count > 0;
    }

    private sealed class ChatCompareScope
    {
        public List<int> CollectionIds { get; set; } = [];
        public List<string> CompareSlugs { get; set; } = [];
    }

    private sealed class ChatSessionState
    {
        public List<int> BrandIds { get; set; } = [];
        public List<int> CollectionIds { get; set; } = [];
        public List<string> WatchSlugs { get; set; } = [];
        public string FollowUpMode { get; set; } = "";
        public string? CanonicalQuery { get; set; }
    }

    public ChatService(
        IHttpClientFactory httpClientFactory,
        TourbillonContext context,
        IRedisService redis,
        IConfiguration config,
        IWatchFinderService watchFinderService,
        ILogger<ChatService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _redis = redis;
        _config = config;
        _watchFinderService = watchFinderService;
        _logger = logger;
    }

    private async Task<List<ChatMessage>> GetSessionHistoryAsync(string sessionId)
    {
        var json = await _redis.GetHashFieldAsync($"chat:session:{sessionId}", "history");
        if (json == null) return [];
        return JsonSerializer.Deserialize<List<ChatMessage>>(json, _jsonOptions) ?? [];
    }

    private async Task SaveSessionHistoryAsync(string sessionId, List<ChatMessage> history)
    {
        var json = JsonSerializer.Serialize(history, _jsonOptions);
        await _redis.SetHashFieldAsync($"chat:session:{sessionId}", "history", json, SessionTtl);
    }

    private async Task<List<ChatWatchCard>> GetLastWatchCardsAsync(string sessionId)
    {
        var json = await _redis.GetHashFieldAsync($"chat:session:{sessionId}", "cards");
        if (json == null) return [];
        return JsonSerializer.Deserialize<List<ChatWatchCard>>(json, _jsonOptions) ?? [];
    }

    private async Task SaveLastWatchCardsAsync(string sessionId, List<ChatWatchCard> cards)
    {
        var json = JsonSerializer.Serialize(cards.Take(DiscoveryCardLimit).ToList(), _jsonOptions);
        await _redis.SetHashFieldAsync($"chat:session:{sessionId}", "cards", json, SessionTtl);
    }

    private async Task<ChatCompareScope?> GetCompareScopeAsync(string sessionId)
    {
        var json = await _redis.GetHashFieldAsync($"chat:session:{sessionId}", "compare_scope");
        if (json == null) return null;
        return JsonSerializer.Deserialize<ChatCompareScope>(json, _jsonOptions);
    }

    private async Task SaveCompareScopeAsync(string sessionId, ChatCompareScope? scope)
    {
        if (scope == null || (scope.CollectionIds.Count == 0 && scope.CompareSlugs.Count == 0))
            return;

        var json = JsonSerializer.Serialize(scope, _jsonOptions);
        await _redis.SetHashFieldAsync($"chat:session:{sessionId}", "compare_scope", json, SessionTtl);
    }

    private async Task<ChatSessionState?> GetSessionStateAsync(string sessionId)
    {
        var json = await _redis.GetHashFieldAsync($"chat:session:{sessionId}", "state");
        if (json == null) return null;
        return JsonSerializer.Deserialize<ChatSessionState>(json, _jsonOptions);
    }

    private async Task SaveSessionStateAsync(string sessionId, ChatSessionState? state)
    {
        if (state == null) return;

        var normalized = new ChatSessionState
        {
            BrandIds = state.BrandIds.Distinct().Take(8).ToList(),
            CollectionIds = state.CollectionIds.Distinct().Take(8).ToList(),
            WatchSlugs = state.WatchSlugs
                .Where(slug => !string.IsNullOrWhiteSpace(slug))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(DiscoveryCardLimit)
                .ToList(),
            FollowUpMode = state.FollowUpMode,
            CanonicalQuery = string.IsNullOrWhiteSpace(state.CanonicalQuery) ? null : state.CanonicalQuery.Trim(),
        };

        var json = JsonSerializer.Serialize(normalized, _jsonOptions);
        await _redis.SetHashFieldAsync($"chat:session:{sessionId}", "state", json, SessionTtl);
    }

    public async Task<ChatApiResponse> HandleMessageAsync(
        string sessionId, string message, string? userId, string? ipAddress, string? behaviorSummary = null)
    {
        var disableLimit = _config.GetValue<bool>("ChatSettings:DisableLimitInDev");
        var dailyLimit = _config.GetValue<int>("ChatSettings:DailyLimit", 5);

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
                    DailyUsed = used,
                    DailyLimit = dailyLimit,
                    Message = "You have reached your daily message limit. Please try again tomorrow."
                };
            }
        }

        var sessionHistory = await GetSessionHistoryAsync(sessionId);
        var lastWatchCards = await GetLastWatchCardsAsync(sessionId);
        var compareScope = await GetCompareScopeAsync(sessionId);
        var sessionState = await GetSessionStateAsync(sessionId);
        var history = sessionHistory
            .TakeLast(10)
            .Select(m => new ChatHistoryEntry { Role = m.Role, Content = m.Content })
            .ToList();

        ChatResolution resolution;
        try
        {
            resolution = await ResolveMessageAsync(message.Trim(), lastWatchCards, compareScope, sessionState);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat routing failed for message preview={Preview}",
                message.Length > 80 ? message[..80] + "..." : message);
            resolution = new ChatResolution
            {
                Message = "I am having trouble processing that request right now. Please try again in a moment."
            };
        }

        string aiMessage = resolution.Message;
        var actions = resolution.Actions;
        var watchCards = resolution.WatchCards;

        if (resolution.UseAi)
        {
            if (!string.IsNullOrWhiteSpace(behaviorSummary))
                resolution.Context.Insert(0, $"[User context] {behaviorSummary}");

            if (resolution.Context.Count == 0)
                resolution.Context.Add("Stay within Tourbillon's catalogue and watch expertise. No relevant catalogue records were resolved.");

            var aiResult = await CallAiServiceAsync(history, resolution.Query, resolution.Context);
            aiMessage = aiResult.Message;
            actions = MergeActions(aiResult.Actions, resolution.Actions);
            if (watchCards.Count == 0)
                watchCards = await ExtractWatchCardsAsync(aiMessage, actions);
        }

        sessionHistory.Add(new ChatMessage { Role = "user", Content = message });
        sessionHistory.Add(new ChatMessage { Role = "assistant", Content = aiMessage });
        await SaveSessionHistoryAsync(sessionId, sessionHistory);
        await SaveLastWatchCardsAsync(sessionId, watchCards);
        await SaveCompareScopeAsync(sessionId, await BuildCompareScopeAsync(actions));
        await SaveSessionStateAsync(sessionId, resolution.SessionState ?? BuildFallbackSessionState(watchCards));

        var newUsed = 1;
        if (!disableLimit)
        {
            var rlKey = $"chat_rl:{userId ?? ipAddress ?? "anon"}";
            var ttlUntilMidnight = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
            newUsed = (int)await _redis.IncrementAsync(rlKey, ttlUntilMidnight);
        }

        return new ChatApiResponse
        {
            Message = aiMessage,
            WatchCards = watchCards,
            Actions = actions,
            DailyUsed = disableLimit ? null : newUsed,
            DailyLimit = disableLimit ? null : dailyLimit,
        };
    }

    public async Task ClearSessionAsync(string sessionId) =>
        await _redis.RemoveHashAsync($"chat:session:{sessionId}");

    private async Task<ChatResolution> ResolveMessageAsync(
        string message,
        List<ChatWatchCard> lastWatchCards,
        ChatCompareScope? compareScope,
        ChatSessionState? sessionState)
    {
        if (IsAbusiveQuery(message))
            return new ChatResolution
            {
                Message = "I am here to help with Tourbillon watches and horology only. If you want, ask about a watch, brand, comparison, or product search."
            };

        var cursorResolution = TryResolveCursorCommand(message);
        if (cursorResolution != null)
            return cursorResolution;

        var mentions = await ResolveEntityMentionsAsync(message);
        var referencedWatches = await TryResolveReferencedWatchesAsync(message, lastWatchCards);

        if (IsExplicitCompareQuery(message))
        {
            var compareWatches = await TryResolveCompareWatchesAsync(message, lastWatchCards, mentions, compareScope);
            if (compareWatches.Count >= 2)
                return BuildCompareResolution(message, compareWatches);
        }

        if (referencedWatches.Count > 0)
            return BuildReferencedWatchResolution(message, referencedWatches);

        var contextualFollowUp = await TryResolveContextualFollowUpAsync(message, lastWatchCards, sessionState);
        if (contextualFollowUp != null)
            return contextualFollowUp;

        var directEntityResolution = await TryResolveDirectEntityResolutionAsync(message, mentions, sessionState);
        if (directEntityResolution != null)
            return directEntityResolution;

        var hasWatchScope = mentions.HasAny
            || referencedWatches.Count > 0
            || WatchFinderService.HasWatchDomainSignal(message)
            || (sessionState?.WatchSlugs.Count > 0 && LooksLikeContextualFollowUp(message));

        if (!hasWatchScope)
            return new ChatResolution
            {
                Message = "I specialise in Tourbillon watches and horology. Ask about a watch, brand, comparison, or something you want to find in the catalogue."
            };

        if (LooksLikeEntityInfoRequest(message, mentions))
            return await BuildEntityInfoResolutionAsync(message, mentions);

        var searchResult = await _watchFinderService.FindWatchesAsync(message);
        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
        {
            return new ChatResolution
            {
                Message = "I specialise in Tourbillon watches and horology. Ask about a watch, brand, comparison, or something you want to find in the catalogue."
            };
        }

        var exactWatch = await TryResolveExactWatchAsync(message, searchResult);
        if (exactWatch != null)
            return BuildExactWatchResolution(exactWatch, message);

        if (searchResult.Watches.Count > 0)
            return await BuildDiscoveryResolutionAsync(message, searchResult);

        if (mentions.HasAny)
            return await BuildEntityInfoResolutionAsync(message, mentions, noDirectMatch: true);

        return new ChatResolution
        {
            Message = "I could not find a close Tourbillon catalogue match for that request. Try asking with a brand, collection, reference, size, material, or price range."
        };
    }

    private async Task<(string Message, List<ChatAction> Actions)> CallAiServiceAsync(
        List<ChatHistoryEntry> history, string query, List<string> context)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient("ai-service");
            var chatSw = System.Diagnostics.Stopwatch.StartNew();
            var safeContext = new List<string>
            {
                "Catalogue safety: use the supplied Tourbillon catalogue context as the source of truth. Do not recommend, compare, or link to anything outside this context. Never expose database IDs, addresses, table names, API routes, or internal implementation details."
            };
            safeContext.AddRange(context);

            var payload = new { query, context = safeContext, history };
            var resp = await httpClient.PostAsJsonAsync("/chat", payload);
            chatSw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chat ai-service /chat returned {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, chatSw.ElapsedMilliseconds);
                return ("I am having trouble connecting to the concierge service right now. Please try again in a moment.", []);
            }

            _logger.LogInformation("Chat ai-service /chat {ElapsedMs}ms", chatSw.ElapsedMilliseconds);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            var message = json.TryGetProperty("message", out var messageEl) ? messageEl.GetString() ?? "" : "";
            var actions = new List<ChatAction>();

            if (json.TryGetProperty("actions", out var actionsEl) && actionsEl.ValueKind == JsonValueKind.Array)
            {
                try
                {
                    actions = JsonSerializer.Deserialize<List<ChatAction>>(actionsEl.GetRawText(), _jsonOptions) ?? [];
                }
                catch
                {
                    actions = [];
                }
            }

            return (string.IsNullOrWhiteSpace(message)
                ? "I could not produce a useful answer from the catalogue context."
                : message, actions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat ai-service call threw before producing a response");
            return ("I am having trouble connecting right now. Please try again in a moment.", []);
        }
    }

    private async Task<EntityMentions> ResolveEntityMentionsAsync(string query)
    {
        var brands = await _context.Brands.AsNoTracking().ToListAsync();
        var collections = await _context.Collections.AsNoTracking().ToListAsync();
        var mentions = new EntityMentions();
        var matchedBrandIds = new HashSet<int>();
        var normalizedQuery = NormalizeEntityText(query);

        foreach (var (alias, canonical) in _brandAliases)
        {
            if (!Regex.IsMatch(query, $@"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
                continue;

            var brand = brands.FirstOrDefault(b =>
                string.Equals(NormalizeEntityText(b.Name), NormalizeEntityText(canonical), StringComparison.OrdinalIgnoreCase));
            if (brand != null && matchedBrandIds.Add(brand.Id))
                mentions.Brands.Add(brand);
        }

        foreach (var brand in brands.OrderByDescending(b => b.Name.Length))
        {
            var normalizedName = NormalizeEntityText(brand.Name);
            if (!query.Contains(brand.Name, StringComparison.OrdinalIgnoreCase) && !normalizedQuery.Contains(normalizedName))
                continue;

            if (matchedBrandIds.Add(brand.Id))
                mentions.Brands.Add(brand);
        }

        var collectionPool = mentions.Brands.Count > 0
            ? collections.Where(c => mentions.Brands.Any(b => b.Id == c.BrandId)).ToList()
            : collections;

        var matchedCollectionIds = new HashSet<int>();
        foreach (var collection in collectionPool.OrderByDescending(c => c.Name.Length))
        {
            var normalizedName = NormalizeEntityText(collection.Name);
            if (!query.Contains(collection.Name, StringComparison.OrdinalIgnoreCase) && !normalizedQuery.Contains(normalizedName))
                continue;

            if (matchedCollectionIds.Add(collection.Id))
                mentions.Collections.Add(collection);
        }

        return mentions;
    }

    private ChatResolution? TryResolveCursorCommand(string query)
    {
        if (!Regex.IsMatch(query, @"\b(?:cursor|pointer)\b", RegexOptions.IgnoreCase))
            return null;

        if (!Regex.IsMatch(query, @"\b(?:change|set|switch|use|make)\b", RegexOptions.IgnoreCase)
            && !Regex.IsMatch(query, @"\bcursor\s+to\b", RegexOptions.IgnoreCase))
            return null;

        var normalized = NormalizeEntityText(query);
        var resolvedCursor = _cursorAliases
            .OrderByDescending(alias => alias.Key.Length)
            .FirstOrDefault(alias => normalized.Contains(NormalizeEntityText(alias.Key), StringComparison.OrdinalIgnoreCase));

        if (string.IsNullOrWhiteSpace(resolvedCursor.Value))
            return null;

        var cursorLabel = string.Equals(resolvedCursor.Value, "default", StringComparison.OrdinalIgnoreCase)
            ? "Default"
            : char.ToUpperInvariant(resolvedCursor.Value[0]) + resolvedCursor.Value[1..];

        return new ChatResolution
        {
            Message = $"Tourbillon switched the cursor to {cursorLabel}.",
            Actions =
            [
                new ChatAction
                {
                    Type = "set_cursor",
                    Cursor = resolvedCursor.Value,
                    Label = $"Switch cursor to {cursorLabel}"
                }
            ],
            SessionState = new ChatSessionState
            {
                FollowUpMode = "cursor",
                CanonicalQuery = resolvedCursor.Value
            }
        };
    }

    private async Task<ChatResolution?> TryResolveContextualFollowUpAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState? sessionState)
    {
        if (IsAffirmativeFollowUp(query))
        {
            if (lastWatchCards.Count > 0)
                return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: true);

            var storedMentions = await ResolveMentionsFromSessionStateAsync(sessionState);
            if (storedMentions.HasAny)
                return await BuildEntityInfoResolutionAsync(sessionState?.CanonicalQuery ?? query, storedMentions);
        }

        if (!LooksLikeContextualFollowUp(query) || lastWatchCards.Count == 0)
            return null;

        return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: false);
    }

    private async Task<ChatResolution?> TryResolveDirectEntityResolutionAsync(
        string query,
        EntityMentions mentions,
        ChatSessionState? sessionState)
    {
        var directEntityQuery = ExtractDirectEntityQuery(query, mentions, sessionState);
        if (string.IsNullOrWhiteSpace(directEntityQuery))
            return null;

        var result = await _watchFinderService.FindWatchesAsync(directEntityQuery);
        if (string.Equals(result.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase) || result.Watches.Count == 0)
            return null;

        var exactWatch = await TryResolveExactWatchAsync(directEntityQuery, result);
        if (exactWatch != null)
            return BuildExactWatchResolution(exactWatch, directEntityQuery);

        return await BuildDiscoveryResolutionAsync(directEntityQuery, result, includeSearchAction: false);
    }

    private async Task<ChatResolution> BuildCardContinuationResolutionAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        bool affirmative)
    {
        var slugsInOrder = lastWatchCards
            .Select(card => card.Slug)
            .Where(slug => !string.IsNullOrWhiteSpace(slug))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => slugsInOrder.Contains(w.Slug))
            .ToListAsync();

        var ordered = slugsInOrder
            .Select(slug => watches.FirstOrDefault(w => string.Equals(w.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(w => w != null)
            .Cast<Watch>()
            .ToList();

        if (ordered.Count == 0)
        {
            return new ChatResolution
            {
                Message = "I need one more specific watch, brand, or collection detail to continue from the previous results."
            };
        }

        var context = new List<string>
        {
            affirmative
                ? "The user just affirmed the previous suggestion. Continue from these exact surfaced Tourbillon cards, identify the strongest next step clearly, and do not broaden into unrelated catalogue results."
                : "The user is referring back to the immediately previous Tourbillon card row. Stay anchored to these exact watches, answer directly, and do not broaden into unrelated catalogue results."
        };

        foreach (var watch in ordered)
            context.Add(BuildWatchContext(watch));

        foreach (var collection in ordered
            .Where(w => w.Collection != null)
            .Select(w => w.Collection!)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .Take(2))
        {
            context.Add(BuildCollectionContext(collection));
        }

        foreach (var brand in ordered
            .Where(w => w.Brand != null)
            .Select(w => w.Brand)
            .GroupBy(b => b.Id)
            .Select(g => g.First())
            .Take(2))
        {
            context.Add(BuildBrandContext(brand));
        }

        return new ChatResolution
        {
            UseAi = true,
            Query = affirmative ? "Tell me more about these exact watches and guide me to the strongest next step." : query,
            Context = context,
            WatchCards = ordered.Select(ToChatWatchCard).ToList(),
            SessionState = BuildSessionStateFromWatches(ordered, "watch_cards", ordered.Count == 1 ? ordered[0].Name : null),
        };
    }

    private async Task<EntityMentions> ResolveMentionsFromSessionStateAsync(ChatSessionState? sessionState)
    {
        if (sessionState == null)
            return new EntityMentions();

        var mentions = new EntityMentions();

        if (sessionState.BrandIds.Count > 0)
        {
            mentions.Brands = await _context.Brands
                .AsNoTracking()
                .Where(brand => sessionState.BrandIds.Contains(brand.Id))
                .ToListAsync();
        }

        if (sessionState.CollectionIds.Count > 0)
        {
            mentions.Collections = await _context.Collections
                .AsNoTracking()
                .Where(collection => sessionState.CollectionIds.Contains(collection.Id))
                .ToListAsync();
        }

        return mentions;
    }

    private static string? ExtractDirectEntityQuery(string query, EntityMentions mentions, ChatSessionState? sessionState)
    {
        var trimmed = query.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return null;

        if (WatchFinderService.IsLikelyReferenceQuery(trimmed) || WatchFinderService.IsLikelyReferenceFragment(trimmed))
            return trimmed;

        if (Regex.IsMatch(trimmed, @"^\d{2,12}$"))
            return trimmed;

        var patterns = new[]
        {
            @"^\s*introduce\s+me(?:\s+to)?\s+(?:the\s+)?(.+?)\s*$",
            @"^\s*(?:the\s+)?watch\s+named\s+(.+?)\s*$",
            @"^\s*(?:the\s+)?model\s+named\s+(.+?)\s*$",
            @"^\s*tell\s+me\s+about\s+the\s+watch\s+named\s+(.+?)\s*$",
            @"^\s*show\s+me\s+the\s+watch\s+named\s+(.+?)\s*$",
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(trimmed, pattern, RegexOptions.IgnoreCase);
            if (!match.Success)
                continue;

            var candidate = Regex.Replace(match.Groups[1].Value, @"\b(?:please|pls)\b", " ", RegexOptions.IgnoreCase).Trim(' ', '.', '?', '!');
            if (candidate.Length == 0)
                continue;

            if (WatchFinderService.IsLikelyReferenceQuery(candidate)
                || WatchFinderService.IsLikelyReferenceFragment(candidate)
                || Regex.IsMatch(candidate, @"\d"))
                return candidate;
        }

        if (CountWords(trimmed) <= 4 && Regex.IsMatch(trimmed, @"\d"))
            return trimmed;

        if (mentions.Collections.Count == 1
            && CountWords(trimmed) <= 5
            && !LooksLikeDiscoveryRequest(trimmed)
            && !IsExplicitCompareQuery(trimmed))
        {
            var collection = mentions.Collections[0];
            var brandName = mentions.Brands.FirstOrDefault(brand => brand.Id == collection.BrandId)?.Name;
            return string.IsNullOrWhiteSpace(brandName)
                ? collection.Name
                : $"{brandName} {collection.Name}";
        }

        if (!string.IsNullOrWhiteSpace(sessionState?.CanonicalQuery)
            && Regex.IsMatch(trimmed, @"^\s*(?:that|those|these)\b", RegexOptions.IgnoreCase))
            return sessionState.CanonicalQuery;

        return null;
    }

    private static ChatSessionState BuildSessionStateFromWatches(
        List<Watch> watches,
        string followUpMode,
        string? canonicalQuery = null)
    {
        return new ChatSessionState
        {
            BrandIds = watches.Select(w => w.BrandId).Distinct().ToList(),
            CollectionIds = watches.Where(w => w.CollectionId != null).Select(w => w.CollectionId!.Value).Distinct().ToList(),
            WatchSlugs = watches.Select(w => w.Slug).ToList(),
            FollowUpMode = followUpMode,
            CanonicalQuery = canonicalQuery,
        };
    }

    private static ChatSessionState BuildFallbackSessionState(List<ChatWatchCard> cards)
    {
        return new ChatSessionState
        {
            BrandIds = cards.Select(card => card.BrandId).Distinct().ToList(),
            WatchSlugs = cards.Select(card => card.Slug).Where(slug => !string.IsNullOrWhiteSpace(slug)).ToList(),
            FollowUpMode = cards.Count > 0 ? "watch_cards" : "",
        };
    }

    private async Task<ChatCompareScope?> BuildCompareScopeAsync(List<ChatAction> actions)
    {
        var compareAction = actions.FirstOrDefault(a =>
            string.Equals(a.Type, "compare", StringComparison.OrdinalIgnoreCase)
            && a.Slugs?.Count >= 2);
        if (compareAction?.Slugs == null)
            return null;

        var compareSlugs = compareAction.Slugs
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .ToList();
        if (compareSlugs.Count < 2)
            return null;

        var scopedWatches = await _context.Watches
            .AsNoTracking()
            .Where(w => compareSlugs.Contains(w.Slug))
            .ToListAsync();
        var collectionIds = compareSlugs
            .Select(slug => scopedWatches.FirstOrDefault(w => string.Equals(w.Slug, slug, StringComparison.OrdinalIgnoreCase))?.CollectionId)
            .Where(id => id != null)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        return new ChatCompareScope
        {
            CollectionIds = collectionIds,
            CompareSlugs = compareSlugs,
        };
    }

    private async Task<List<Watch>> TryResolveCompareWatchesAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        EntityMentions mentions,
        ChatCompareScope? compareScope)
    {
        var ordinalCompare = await TryResolveOrdinalCompareWatchesAsync(query, lastWatchCards);
        if (ordinalCompare.Count >= 2)
            return ordinalCompare;

        var parts = ExtractCompareParts(query);
        if (ShouldPreferCollectionCompare(parts, mentions, compareScope, query))
        {
            var collectionFirstCompare = await TryResolveCollectionCompareWatchesAsync(query, mentions, compareScope);
            if (collectionFirstCompare.Count >= 2)
                return collectionFirstCompare;
        }

        if (parts.Count >= 2)
        {
            var resolved = new List<Watch>();
            foreach (var part in parts.Take(4))
            {
                var result = await _watchFinderService.FindWatchesAsync(part);
                var watch = await TryResolveExactWatchAsync(part, result);
                if (watch == null)
                {
                    resolved.Clear();
                    break;
                }

                if (resolved.All(w => w.Id != watch.Id))
                    resolved.Add(watch);
            }

            if (resolved.Count >= 2)
                return resolved;
        }

        return await TryResolveCollectionCompareWatchesAsync(query, mentions, compareScope);
    }

    private async Task<List<Watch>> TryResolveReferencedWatchesAsync(string query, List<ChatWatchCard> lastWatchCards)
    {
        if (lastWatchCards.Count == 0)
            return [];

        var indexes = ExtractReferencedCardIndexes(query, lastWatchCards.Count);
        if (indexes.Count == 0)
            return [];

        var slugsInOrder = indexes
            .Select(index => lastWatchCards[index].Slug)
            .Where(slug => !string.IsNullOrWhiteSpace(slug))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (slugsInOrder.Count == 0)
            return [];

        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => slugsInOrder.Contains(w.Slug))
            .ToListAsync();

        return slugsInOrder
            .Select(slug => watches.FirstOrDefault(w => string.Equals(w.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(w => w != null)
            .Cast<Watch>()
            .ToList();
    }

    private async Task<List<Watch>> TryResolveOrdinalCompareWatchesAsync(string query, List<ChatWatchCard> lastWatchCards)
    {
        var referenced = await TryResolveReferencedWatchesAsync(query, lastWatchCards);
        return referenced.Count >= 2 ? referenced : [];
    }

    private async Task<List<Watch>> TryResolveCollectionCompareWatchesAsync(
        string query,
        EntityMentions mentions,
        ChatCompareScope? compareScope)
    {
        var collections = await ResolveCollectionCompareTargetsAsync(query, mentions, compareScope);
        if (collections.Count < 2)
            return [];

        var requestedPerCollection = ParseCollectionCompareCount(query);
        var useRandomSelection = WantsRandomCompareSelection(query);
        var selected = new List<Watch>();

        foreach (var collection in collections)
        {
            var picks = useRandomSelection
                ? await SelectRandomCollectionWatchesAsync(collection.Id, requestedPerCollection)
                : await SelectRepresentativeCollectionWatchesAsync(collection.Id, requestedPerCollection);

            foreach (var watch in picks)
            {
                if (selected.All(existing => existing.Id != watch.Id))
                    selected.Add(watch);

                if (selected.Count >= 4)
                    return selected;
            }
        }

        return selected.Count >= 2 ? selected : [];
    }

    private async Task<List<Collection>> ResolveCollectionCompareTargetsAsync(
        string query,
        EntityMentions mentions,
        ChatCompareScope? compareScope)
    {
        if (mentions.Collections.Count >= 2)
        {
            var orderedIds = mentions.Collections
                .OrderBy(c => CollectionQueryPosition(query, c.Name))
                .Select(c => c.Id)
                .Distinct()
                .Take(4)
                .ToList();

            var collections = await _context.Collections
                .Include(c => c.Brand)
                .AsNoTracking()
                .Where(c => orderedIds.Contains(c.Id))
                .ToListAsync();

            return orderedIds
                .Select(id => collections.FirstOrDefault(c => c.Id == id))
                .Where(c => c != null)
                .Cast<Collection>()
                .ToList();
        }

        if (compareScope?.CollectionIds.Count >= 2 && UsesStoredCollectionScope(query))
        {
            var collections = await _context.Collections
                .Include(c => c.Brand)
                .AsNoTracking()
                .Where(c => compareScope.CollectionIds.Contains(c.Id))
                .ToListAsync();

            return compareScope.CollectionIds
                .Select(id => collections.FirstOrDefault(c => c.Id == id))
                .Where(c => c != null)
                .Cast<Collection>()
                .ToList();
        }

        return [];
    }

    private async Task<List<Watch>> SelectRepresentativeCollectionWatchesAsync(int collectionId, int requestedCount)
    {
        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => w.CollectionId == collectionId)
            .ToListAsync();

        return watches
            .OrderByDescending(w => !string.IsNullOrWhiteSpace(w.Image))
            .ThenByDescending(w => GetProductionPriority(w))
            .ThenByDescending(w => w.CurrentPrice > 0)
            .ThenByDescending(w => w.ImageVersion ?? 0)
            .ThenByDescending(w => w.Id)
            .Take(requestedCount)
            .ToList();
    }

    private async Task<List<Watch>> SelectRandomCollectionWatchesAsync(int collectionId, int requestedCount)
    {
        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => w.CollectionId == collectionId)
            .ToListAsync();

        return watches
            .OrderBy(_ => Random.Shared.Next())
            .ThenByDescending(w => w.Id)
            .Take(requestedCount)
            .ToList();
    }

    private async Task<Watch?> TryResolveExactWatchAsync(string query, WatchFinderResult result)
    {
        if (result.Watches.Count == 0)
            return null;

        var totalMatches = result.Watches.Count + result.OtherCandidates.Count;
        var hasSingleUniqueCandidate = totalMatches == 1;
        var isDirectExactPath = result.SearchPath?.StartsWith("direct_sql", StringComparison.OrdinalIgnoreCase) == true
            && result.Watches.Count == 1
            && result.OtherCandidates.Count == 0;

        if (!hasSingleUniqueCandidate && !isDirectExactPath)
            return null;

        var watchId = result.Watches[0].Id;
        return await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == watchId);
    }

    private async Task<ChatResolution> BuildEntityInfoResolutionAsync(
        string query, EntityMentions mentions, bool noDirectMatch = false)
    {
        var context = new List<string>();
        var cards = new List<ChatWatchCard>();

        if (mentions.Brands.Count > 0)
        {
            context.Add(
                "Brand guidance request: lead with the linked brand name, give a concise maison overview from Tourbillon context, mention one or two interesting watch-relevant points, point the user toward linked collections or models, and close with a warm sales-style follow-up question such as whether they want to explore collections or a specific model.");
        }

        if (mentions.Collections.Count > 0)
        {
            context.Add(
                "Collection guidance request: lead with the linked collection name, explain the collection's identity and where it sits within the brand, mention one or two interesting watch-relevant points from the supplied context, point the user toward linked models in that collection, and close with a warm sales-style follow-up question such as whether they want to explore a specific reference or compare options.");
        }

        foreach (var collection in mentions.Collections.Take(2))
        {
            var fullCollection = await _context.Collections
                .Include(c => c.Brand)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == collection.Id);

            if (fullCollection == null) continue;

            context.Add(BuildCollectionContext(fullCollection));

            var sampleWatches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .Where(w => w.CollectionId == fullCollection.Id)
                .OrderByDescending(w => w.Id)
                .Take(3)
                .AsNoTracking()
                .ToListAsync();

            foreach (var watch in sampleWatches)
                context.Add(BuildWatchContext(watch));

            cards.AddRange(sampleWatches.Select(ToChatWatchCard));
        }

        foreach (var brand in mentions.Brands.Take(2))
        {
            var fullBrand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == brand.Id);
            if (fullBrand == null) continue;

            context.Add(BuildBrandContext(fullBrand));

            var brandCollections = await _context.Collections
                .Where(c => c.BrandId == fullBrand.Id)
                .OrderBy(c => c.Name)
                .Take(3)
                .AsNoTracking()
                .ToListAsync();

            foreach (var collection in brandCollections)
                context.Add(BuildCollectionContext(collection));

            var sampleWatches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .Where(w => w.BrandId == fullBrand.Id)
                .OrderByDescending(w => w.Id)
                .Take(2)
                .AsNoTracking()
                .ToListAsync();

            foreach (var watch in sampleWatches)
                context.Add(BuildWatchContext(watch));

            cards.AddRange(sampleWatches.Select(ToChatWatchCard));
        }

        if (noDirectMatch)
            context.Insert(0, "No exact Tourbillon product match was resolved for the request. Answer using the matched brand and collection context only.");

        return new ChatResolution
        {
            UseAi = true,
            Query = query,
            Context = context,
            WatchCards = cards
                .GroupBy(c => c.Id)
                .Select(g => g.First())
                .Take(4)
                .ToList(),
            SessionState = new ChatSessionState
            {
                BrandIds = mentions.Brands.Select(brand => brand.Id).Distinct().ToList(),
                CollectionIds = mentions.Collections.Select(collection => collection.Id).Distinct().ToList(),
                WatchSlugs = cards.Select(card => card.Slug).Where(slug => !string.IsNullOrWhiteSpace(slug)).Distinct(StringComparer.OrdinalIgnoreCase).Take(DiscoveryCardLimit).ToList(),
                FollowUpMode = cards.Count > 0 ? "watch_cards" : "entity_info",
                CanonicalQuery = mentions.Collections.FirstOrDefault()?.Name ?? mentions.Brands.FirstOrDefault()?.Name ?? query,
            }
        };
    }

    private async Task<ChatResolution> BuildDiscoveryResolutionAsync(string query, WatchFinderResult result, bool includeSearchAction = true)
    {
        var topIds = result.Watches.Take(DiscoveryCardLimit).Select(w => w.Id).Distinct().ToList();
        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .Where(w => topIds.Contains(w.Id))
            .AsNoTracking()
            .ToListAsync();

        var ordered = topIds
            .Select(id => watches.FirstOrDefault(w => w.Id == id))
            .Where(w => w != null)
            .Cast<Watch>()
            .ToList();

        var context = new List<string>
        {
            includeSearchAction
                ? $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Search guidance request: answer like a sales concierge, highlight the strongest matches, tell the user the Smart Search chip can broaden discovery, emit one Smart Search action with a concise catalogue-style query built from the resolved matches rather than the user's raw wording, and end with a short follow-up question about size, material, budget, occasion, or a specific model."
                : $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Answer like a sales concierge, stay anchored to these exact catalogue matches, do not emit a Smart Search action, and end with a short follow-up question about size, material, budget, occasion, or a specific model.",
            includeSearchAction
                ? "Smart Search action guidance: rewrite discovery queries into compact catalogue terms. Prefer canonical brand and collection names from the supplied context. Good example: 'Jaeger-LeCoultre Reverso'. Bad example: 'yo, suggest me some reversos'."
                : "Action guidance: no Smart Search action is needed for this reply."
        };

        foreach (var watch in ordered)
            context.Add(BuildWatchContext(watch));

        foreach (var collection in ordered
            .Where(w => w.Collection != null)
            .Select(w => w.Collection!)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .Take(2))
        {
            context.Add(BuildCollectionContext(collection));
        }

        var actions = !includeSearchAction || IsExplicitCompareQuery(query)
            ? new List<ChatAction>()
            : new List<ChatAction>
            {
                new()
                {
                    Type = "search",
                    Query = BuildSmartSearchQuery(query, ordered),
                    Label = "Open Smart Search"
                }
            };

        return new ChatResolution
        {
            UseAi = true,
            Query = query,
            Context = context,
            WatchCards = ordered.Select(ToChatWatchCard).Take(DiscoveryCardLimit).ToList(),
            Actions = actions,
            SessionState = BuildSessionStateFromWatches(
                ordered,
                "watch_cards",
                BuildCanonicalEntityQuery(ordered, query))
        };
    }

    private ChatResolution BuildExactWatchResolution(Watch watch, string? canonicalQuery = null)
    {
        var brandLink = watch.Brand != null && !string.IsNullOrWhiteSpace(watch.Brand.Slug)
            ? $"[{watch.Brand.Name}](/brands/{watch.Brand.Slug})"
            : "its brand";
        var collectionLink = watch.Collection != null && !string.IsNullOrWhiteSpace(watch.Collection.Slug)
            ? $"[{watch.Collection.Name}](/collections/{watch.Collection.Slug})"
            : null;
        var watchLink = $"[{BuildWatchTitle(watch)}](/watches/{watch.Slug})";
        var place = collectionLink != null
            ? $"It sits in {collectionLink} from {brandLink}"
            : $"It comes from {brandLink}";

        return new ChatResolution
        {
            Message = $"{watchLink} is the closest exact match in Tourbillon's catalogue. {place} and is listed at {FormatPrice(watch.CurrentPrice)}. If you want, Tourbillon can also compare it with another watch or help you explore adjacent models."
                .Replace("  ", " "),
            WatchCards = [ToChatWatchCard(watch)],
            SessionState = BuildSessionStateFromWatches([watch], "watch_cards", canonicalQuery ?? watch.Name)
        };
    }

    private ChatResolution BuildCompareResolution(string query, List<Watch> watches)
    {
        var watchCards = watches.Select(ToChatWatchCard).ToList();
        var links = watches.Select(w => $"[{BuildWatchTitle(w)}](/watches/{w.Slug})");
        var context = new List<string>
        {
            "Tourbillon resolved a concrete comparison set. Compare guidance request: explain the main split in practical buying terms, stay concise, end with a complete sentence, and assume the compare view will open immediately with these exact watches preloaded."
        };

        foreach (var watch in watches)
            context.Add(BuildWatchContext(watch));

        return new ChatResolution
        {
            UseAi = true,
            Message = $"Tourbillon resolved this comparison set: {string.Join(", ", links)}. The compare view will open with these watches preloaded.",
            Query = query,
            Context = context,
            WatchCards = watchCards,
            Actions =
            [
                new ChatAction
                {
                    Type = "compare",
                    Label = "Compare these watches",
                    Slugs = watchCards.Select(w => w.Slug).ToList()
                }
            ],
            SessionState = BuildSessionStateFromWatches(watches, "compare", BuildCanonicalEntityQuery(watches, query))
        };
    }

    private ChatResolution BuildReferencedWatchResolution(string query, List<Watch> watches)
    {
        var watchCards = watches.Select(ToChatWatchCard).ToList();
        var context = new List<string>
        {
            "Tourbillon card follow-up request: the user is referring to watches from the immediately previous card row. Answer only about these resolved watches, identify each one clearly, and answer the exact question directly."
        };

        foreach (var watch in watches)
            context.Add(BuildWatchContext(watch));

        return new ChatResolution
        {
            UseAi = true,
            Message = BuildReferencedWatchFallbackMessage(watches),
            Query = query,
            Context = context,
            WatchCards = watchCards,
            SessionState = BuildSessionStateFromWatches(watches, "watch_cards", BuildCanonicalEntityQuery(watches, query)),
        };
    }

    private async Task<List<ChatWatchCard>> ExtractWatchCardsAsync(string message, List<ChatAction>? actions = null)
    {
        var slugs = Regex.Matches(message, @"/watches/([\w-]+)")
            .Select(m => m.Groups[1].Value)
            .ToList();

        if (actions != null)
        {
            slugs.AddRange(actions
                .Where(a => string.Equals(a.Type, "compare", StringComparison.OrdinalIgnoreCase) && a.Slugs != null)
                .SelectMany(a => a.Slugs!));
        }

        var distinctSlugs = slugs
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();

        if (distinctSlugs.Count == 0) return [];

        var watches = await _context.Watches
            .Where(w => distinctSlugs.Contains(w.Slug))
            .AsNoTracking()
            .ToListAsync();

        return watches.Select(ToChatWatchCard).ToList();
    }

    private static List<ChatAction> MergeActions(List<ChatAction> preferred, List<ChatAction> secondary)
    {
        var merged = new List<ChatAction>();

        foreach (var action in preferred.Concat(secondary))
        {
            if (string.IsNullOrWhiteSpace(action.Type))
                continue;

            if (string.Equals(action.Type, "compare", StringComparison.OrdinalIgnoreCase) && action.Slugs?.Count > 0)
            {
                var slugs = action.Slugs
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (slugs.Count == 0) continue;
                if (merged.Any(a => string.Equals(a.Type, "compare", StringComparison.OrdinalIgnoreCase)
                    && a.Slugs != null
                    && a.Slugs.SequenceEqual(slugs, StringComparer.OrdinalIgnoreCase)))
                    continue;

                merged.Add(new ChatAction
                {
                    Type = "compare",
                    Label = string.IsNullOrWhiteSpace(action.Label) ? "Compare these watches" : action.Label,
                    Slugs = slugs
                });
                continue;
            }

            if (string.Equals(action.Type, "search", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(action.Query))
            {
                if (merged.Any(a => string.Equals(a.Type, "search", StringComparison.OrdinalIgnoreCase)))
                    continue;

                merged.Add(new ChatAction
                {
                    Type = "search",
                    Label = string.IsNullOrWhiteSpace(action.Label) ? "Open Smart Search" : action.Label,
                    Query = action.Query
                });
                continue;
            }

            if (string.Equals(action.Type, "set_cursor", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(action.Cursor))
            {
                if (merged.Any(a => string.Equals(a.Type, "set_cursor", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(a.Cursor, action.Cursor, StringComparison.OrdinalIgnoreCase)))
                    continue;

                merged.Add(new ChatAction
                {
                    Type = "set_cursor",
                    Label = string.IsNullOrWhiteSpace(action.Label) ? "Update cursor" : action.Label,
                    Cursor = action.Cursor
                });
            }
        }

        return merged;
    }

    private static List<string> ExtractCompareParts(string query)
    {
        var working = query.Trim();
        working = Regex.Replace(working, @"\b(?:compare|difference between|the difference between|which should i buy|should i buy|between)\b", " ", RegexOptions.IgnoreCase);
        working = Regex.Replace(working, @"\b(?:versus|vs\.?|against)\b", "|", RegexOptions.IgnoreCase);
        working = Regex.Replace(working, @"\bor\b", "|", RegexOptions.IgnoreCase);

        if (working.Contains('|'))
        {
            return working
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(CleanCompareSegment)
                .Where(part => part.Length >= 3)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(4)
                .ToList();
        }

        if (IsExplicitCompareQuery(query))
        {
            return working
                .Split(" and ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(CleanCompareSegment)
                .Where(part => part.Length >= 3)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(4)
                .ToList();
        }

        return [];
    }

    private static string CleanCompareSegment(string value)
    {
        var cleaned = Regex.Replace(value, @"\b(?:the|a|an|for|me|please)\b", " ", RegexOptions.IgnoreCase);
        return Regex.Replace(cleaned, @"\s+", " ").Trim(' ', ',', '.', '?', '!');
    }

    private static List<int> ExtractReferencedCardIndexes(string query, int totalCards)
    {
        if (totalCards < 2)
            return [];

        var matches = new List<(int Position, int Index)>();
        var patterns = new (string Pattern, Func<Match, int?> Resolve)[]
        {
            (@"\bfirst\b", _ => 0),
            (@"\bsecond\b", _ => 1),
            (@"\bthird\b", _ => 2),
            (@"\bfourth\b", _ => 3),
            (@"\blast\b", _ => totalCards - 1),
            (@"\b(\d+)(?:st|nd|rd|th)\b", match => int.TryParse(match.Groups[1].Value, out var ordinal) ? ordinal - 1 : null),
            (@"\bnumber\s+(\d+)\b", match => int.TryParse(match.Groups[1].Value, out var ordinal) ? ordinal - 1 : null),
        };

        foreach (var (pattern, resolve) in patterns)
        {
            foreach (Match match in Regex.Matches(query, pattern, RegexOptions.IgnoreCase))
            {
                var index = resolve(match);
                if (index is null || index < 0 || index >= totalCards)
                    continue;

                matches.Add((match.Index, index.Value));
            }
        }

        return matches
            .OrderBy(m => m.Position)
            .Select(m => m.Index)
            .Distinct()
            .ToList();
    }

    private static bool IsAffirmativeFollowUp(string query) =>
        Regex.IsMatch(query.Trim(), @"^(?:yes|yeah|yep|sure|ok|okay|please do|go ahead|sounds good|do it)[!.]*$", RegexOptions.IgnoreCase);

    private static bool LooksLikeContextualFollowUp(string query) =>
        IsAffirmativeFollowUp(query)
        || Regex.IsMatch(query, @"\b(?:that one|those|these|them|this one)\b", RegexOptions.IgnoreCase);

    private static bool LooksLikeEntityInfoRequest(string query, EntityMentions mentions)
    {
        if (!mentions.HasAny) return false;
        if (LooksLikeDiscoveryRequest(query) || IsExplicitCompareQuery(query)) return false;

        if (Regex.IsMatch(query, @"\b(?:history|heritage|about|tell me|what is|what makes|why|who makes|background|lineage|should i wear)\b", RegexOptions.IgnoreCase))
            return true;

        return CountWords(query) <= 3;
    }

    private static bool LooksLikeDiscoveryRequest(string query) =>
        Regex.IsMatch(query,
            @"\b(?:find|show|search|looking for|look for|recommend|suggest|need|want|shopping|browse|under\s+\$?\d|between\s+\$?\d)\b",
            RegexOptions.IgnoreCase);

    private static bool IsExplicitCompareQuery(string query) =>
        Regex.IsMatch(query,
            @"\b(?:compare|versus|vs\.?|against|difference between|which should i buy|should i buy| or )\b",
            RegexOptions.IgnoreCase);

    private static bool IsAbusiveQuery(string query) =>
        Regex.IsMatch(query,
            @"\b(?:fuck|shit|bitch|slut|cunt|retard|idiot|moron|stupid|nigger|faggot|kill yourself|rape)\b",
            RegexOptions.IgnoreCase);

    private static int CountWords(string query) =>
        Regex.Matches(query, @"\b[\w'-]+\b").Count;

    private static string NormalizeEntityText(string value)
    {
        var compact = Regex.Replace(value.ToLowerInvariant(), @"[^\p{L}\p{Nd}]+", " ");
        return Regex.Replace(compact, @"\s+", " ").Trim();
    }

    private static string BuildBrandContext(Brand brand)
    {
        var summary = string.IsNullOrWhiteSpace(brand.Summary) ? "" : $" Summary: {brand.Summary}";
        return $"Brand \"{brand.Name}\" (Slug: {brand.Slug}): {brand.Description}{summary}";
    }

    private static string BuildCollectionContext(Collection collection)
    {
        var style = string.IsNullOrWhiteSpace(collection.Style) ? "" : $" [Style: {collection.Style}]";
        return $"Collection \"{collection.Name}\" (Slug: {collection.Slug}){style}: {collection.Description}";
    }

    private static string BuildWatchContext(Watch watch)
    {
        var brandName = watch.Brand?.Name ?? "";
        var collectionName = watch.Collection?.Name ?? "";
        return $"Watch \"{BuildWatchTitle(watch)}\" (Slug: {watch.Slug}): Brand {brandName}; Collection {collectionName}; Price {FormatPrice(watch.CurrentPrice)}; Description {watch.Description}; Specs {watch.Specs}";
    }

    private static string BuildWatchTitle(Watch watch)
    {
        var prefix = !string.IsNullOrWhiteSpace(watch.Description)
            ? watch.Description!.Trim()
            : string.Join(" ", new[] { watch.Brand?.Name, watch.Collection?.Name }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return string.IsNullOrWhiteSpace(prefix) ? watch.Name : $"{prefix} {watch.Name}".Trim();
    }

    private static string BuildCanonicalEntityQuery(List<Watch> watches, string fallbackQuery)
    {
        if (watches.Count == 0)
            return fallbackQuery;

        var brandNames = watches
            .Where(watch => !string.IsNullOrWhiteSpace(watch.Brand?.Name))
            .Select(watch => watch.Brand!.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToList();

        var collectionNames = watches
            .Where(watch => !string.IsNullOrWhiteSpace(watch.Collection?.Name))
            .Select(watch => watch.Collection!.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToList();

        var parts = new List<string>();
        parts.AddRange(brandNames);
        parts.AddRange(collectionNames.Where(collection => !parts.Contains(collection, StringComparer.OrdinalIgnoreCase)));

        return parts.Count > 0 ? string.Join(" ", parts) : fallbackQuery;
    }

    private static string BuildSmartSearchQuery(string originalQuery, List<Watch> ordered)
    {
        var cleaned = originalQuery.Trim();

        if (string.IsNullOrWhiteSpace(cleaned))
            cleaned = originalQuery.Trim();

        var preamblePatterns = new[]
        {
            @"^\s*(?:yo|hey|hi|hello)\b[\s,!.]*",
            @"^\s*(?:please|pls)\b[\s,!.]*",
            @"^\s*(?:can you|could you|would you)\s+",
            @"^\s*(?:should i wear|would i wear|should i buy|would i buy)\s+",
            @"^\s*(?:introduce me(?:\s+to)?|tell me about|show me)\s+(?:the\s+watch\s+named\s+|the\s+)?",
            @"^\s*(?:recommend|suggest|find|show|give|bring)\s+(?:me\s+)?",
            @"^\s*(?:help me find|help me discover)\s+",
            @"^\s*(?:i want|i need|i(?:'m| am)\s+looking for|looking for)\s+",
            @"^\s*(?:some|any)\s+"
        };

        foreach (var pattern in preamblePatterns)
        {
            string next;
            do
            {
                next = Regex.Replace(cleaned, pattern, "", RegexOptions.IgnoreCase).Trim();
                if (next == cleaned)
                    break;
                cleaned = next;
            }
            while (!string.IsNullOrWhiteSpace(cleaned));
        }

        cleaned = Regex.Replace(cleaned, @"^(?:the|a|an)\s+", "", RegexOptions.IgnoreCase).Trim();
        cleaned = Regex.Replace(cleaned, @"\b(?:please|pls|some|any)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\b(?:should i wear|would i wear|should i buy|would i buy|change the cursor to|set the cursor to|switch the cursor to)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim(' ', ',', '.', '?', '!');

        if (ordered.Count == 0)
            return cleaned;

        var distinctBrands = ordered
            .Where(w => !string.IsNullOrWhiteSpace(w.Brand?.Name))
            .Select(w => w.Brand!.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var distinctCollections = ordered
            .Where(w => !string.IsNullOrWhiteSpace(w.Collection?.Name))
            .Select(w => w.Collection!.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var descriptor = cleaned;

        foreach (var brand in distinctBrands)
            descriptor = RemoveSearchTerm(descriptor, brand);

        foreach (var collection in distinctCollections)
            descriptor = RemoveSearchTerm(descriptor, collection, allowPlural: true);

        descriptor = Regex.Replace(
            descriptor,
            @"\b(?:recommend|suggest|find|show|give|bring|help|discover|looking|look|want|need|please|pls|me|some|any|options?|pieces?|models?|should|wear|buy|cursor|change|switch|set)\b",
            " ",
            RegexOptions.IgnoreCase);
        descriptor = Regex.Replace(descriptor, @"\s+", " ").Trim(' ', ',', '.', '?', '!');

        var terms = new List<string>();
        if (distinctBrands.Count == 1)
            terms.Add(distinctBrands[0]);
        if (distinctCollections.Count == 1)
            terms.Add(distinctCollections[0]);
        if (!string.IsNullOrWhiteSpace(descriptor))
            terms.Add(descriptor);

        var fallback = string.Join(" ", terms.Where(t => !string.IsNullOrWhiteSpace(t)));
        if (!string.IsNullOrWhiteSpace(fallback))
            return Regex.Replace(fallback, @"\s+", " ").Trim();

        return Regex.Replace(cleaned, @"\s+", " ").Trim();
    }

    private static string RemoveSearchTerm(string input, string term, bool allowPlural = false)
    {
        if (string.IsNullOrWhiteSpace(input) || string.IsNullOrWhiteSpace(term))
            return input;

        var suffix = allowPlural && !term.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? "s?" : "";
        var pattern = $@"\b{Regex.Escape(term)}{suffix}\b";
        return Regex.Replace(input, pattern, " ", RegexOptions.IgnoreCase);
    }

    private static string BuildReferencedWatchFallbackMessage(List<Watch> watches)
    {
        if (watches.Count == 1)
        {
            var watch = watches[0];
            return $"That card is [{BuildWatchTitle(watch)}](/watches/{watch.Slug}).";
        }

        var labels = watches
            .Select((watch, index) => $"{OrdinalLabel(index + 1)}: [{BuildWatchTitle(watch)}](/watches/{watch.Slug})")
            .ToList();
        return string.Join(" ", labels);
    }

    private static string OrdinalLabel(int index) => index switch
    {
        1 => "First",
        2 => "Second",
        3 => "Third",
        4 => "Fourth",
        _ => $"Item {index}"
    };

    private static int CollectionQueryPosition(string query, string collectionName)
    {
        var index = query.IndexOf(collectionName, StringComparison.OrdinalIgnoreCase);
        return index >= 0 ? index : int.MaxValue;
    }

    private static bool UsesStoredCollectionScope(string query) =>
        Regex.IsMatch(query, @"\b(?:each|those|these|both)\s+collections?\b", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\bfrom\s+each\b", RegexOptions.IgnoreCase);

    private static bool ShouldPreferCollectionCompare(
        List<string> parts,
        EntityMentions mentions,
        ChatCompareScope? compareScope,
        string query)
    {
        if (UsesStoredCollectionScope(query) && compareScope?.CollectionIds.Count >= 2)
            return true;

        if (mentions.Collections.Count < 2)
            return false;

        if (parts.Count == 0)
            return true;

        return parts.All(part =>
            !WatchFinderService.IsLikelyReferenceQuery(part)
            && !WatchFinderService.IsLikelyReferenceFragment(part)
            && !Regex.IsMatch(part, @"\d"));
    }

    private static bool WantsRandomCompareSelection(string query) =>
        Regex.IsMatch(query, @"\brandom\b", RegexOptions.IgnoreCase);

    private static int ParseCollectionCompareCount(string query)
    {
        var numberMatch = Regex.Match(query, @"\b([1-4])\s+(?:randoms?|watches?|models?|references?)\b", RegexOptions.IgnoreCase);
        if (numberMatch.Success && int.TryParse(numberMatch.Groups[1].Value, out var numericCount))
            return Math.Clamp(numericCount, 1, 2);

        var wordMatch = Regex.Match(query, @"\b(one|two)\s+(?:randoms?|watches?|models?|references?)\b", RegexOptions.IgnoreCase);
        if (!wordMatch.Success)
            return 1;

        return string.Equals(wordMatch.Groups[1].Value, "two", StringComparison.OrdinalIgnoreCase) ? 2 : 1;
    }

    private static int GetProductionPriority(Watch watch)
    {
        var status = ExtractProductionStatus(watch.Specs);
        if (string.Equals(status, "current", StringComparison.OrdinalIgnoreCase)) return 3;
        if (string.Equals(status, "limited edition", StringComparison.OrdinalIgnoreCase)) return 2;
        if (string.Equals(status, "discontinued", StringComparison.OrdinalIgnoreCase)) return 0;
        return 1;
    }

    private static string? ExtractProductionStatus(string? specs)
    {
        if (string.IsNullOrWhiteSpace(specs))
            return null;

        var match = Regex.Match(specs, "\"productionStatus\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }

    private static string FormatPrice(decimal price) =>
        price == 0 ? "Price on Request" : $"${price:N0}";

    private static ChatWatchCard ToChatWatchCard(Watch watch) => new()
    {
        Id = watch.Id,
        Name = watch.Name,
        Slug = watch.Slug,
        Description = watch.Description,
        Image = watch.Image,
        ImageUrl = watch.GetImageUrl(CloudName),
        CurrentPrice = watch.CurrentPrice,
        BrandId = watch.BrandId,
    };
}
