// Chat concierge orchestration for Tourbillon.
// Resolves exact watches, compare requests, and discovery redirects before using the LLM,
// then sends only compact Tourbillon-specific context to ai-service when explanation helps.
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Globalization;
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

    // Browser locale hint from the frontend. Used only when message-level
    // language detection is ambiguous.
    public string? PreferredLanguage { get; set; }
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
    public string? BrandName { get; set; }
    public string? BrandSlug { get; set; }
    public string? CollectionName { get; set; }
    public string? CollectionSlug { get; set; }
}

// Concierge action returned alongside the text response and executed client-side.
public class ChatAction
{
    public string Type { get; set; } = "";   // "compare" | "search" | "set_cursor" | "navigate"
    public string Label { get; set; } = "";
    public List<string>? Slugs { get; set; } // watch slugs for "compare"
    public string? Query { get; set; }       // search query for "search"
    public string? Cursor { get; set; }      // cursor id for "set_cursor"
    public string? Href { get; set; }        // route path for "navigate"
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
    private const string UnsupportedQueryMessage = "I specialise in Tourbillon watches and horology. I don't quite get that request yet. Please rephrase it with a watch, brand, collection, comparison, size, material, or price range.";
    private const string NoCloseMatchMessage = "I don't quite get the request from the current Tourbillon catalogue context. Please rephrase it with a watch, brand, collection, reference, size, material, or price range.";
    private const string ProcessingFallbackMessage = "I don't quite get that request right now. Please rephrase it, or try again in a moment with a watch, brand, collection, comparison, size, material, or price range.";
    private const string DailyQuotaMessage = "You have reached your daily concierge quota of 5 messages. Please come back tomorrow.";
    private const string GreetingMessage = "Hello. Tourbillon can help compare watches, explain brands or collections, and narrow a brief into real catalogue options. Try something like \"compare the Aquanaut and the Overseas\", \"tell me about Vacheron Constantin\", or \"JLC Reverso under 50k\".";

    // Single-word collection names that are too generic to be reliable entity matches.
    // e.g. Greubel Forsey has a collection literally named "Collection" which would match any query
    // containing the word "collection".
    private static readonly HashSet<string> _genericCollectionWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "collection", "collections", "watch", "watches", "model", "models",
        "series", "line", "range", "edition", "classic", "sport", "heritage"
    };

    // Curated query bank for "Try asking" chips shown after hard refusals.
    // Covers brand exploration, comparisons, discovery by style/budget/occasion.
    private static readonly string[] _suggestedQueryBank =
    [
        "Compare the Aquanaut and the Overseas",
        "Tell me about Patek Philippe",
        "Sporty watches under $20,000",
        "JLC Reverso — what makes it special?",
        "Tell me about Vacheron Constantin",
        "Grand Seiko for everyday wear",
        "Slim dress watch under $15,000",
        "Audemars Piguet Royal Oak",
        "Best diving watches",
        "Watches for a woman",
        "Tell me about F.P.Journe",
        "Frederique Constant under $5,000",
        "Classic dress watch for formal occasions",
        "A. Lange & Sohne Saxonia",
    ];

    // Words that indicate the watch Description field contains editorial prose, not a model subtitle.
    // CardShortLabel falls back to Name when Description starts with one of these.
    private static readonly HashSet<string> _editorialLeadWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "a", "an", "with", "in", "this", "it", "its", "featuring",
        "designed", "built", "from", "born", "crafted", "combining", "inspired"
    };

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
        public bool SuppressCompareSuggestion { get; set; }
        public string? ResponseLanguage { get; set; }
        public bool AllowWebEnrichment { get; set; }
        public string? WebQuery { get; set; }
        public bool AllowAiActions { get; set; } = true;
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
        string sessionId,
        string message,
        string? userId,
        string? ipAddress,
        string? behaviorSummary = null,
        string? preferredLanguage = null)
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
                    Message = DailyQuotaMessage.Replace("5", dailyLimit.ToString())
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
                Message = ProcessingFallbackMessage
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

            var responseLanguage = resolution.ResponseLanguage ?? ResolveResponseLanguage(message, preferredLanguage);
            var aiResult = await CallAiServiceAsync(
                history,
                resolution.Query,
                resolution.Context,
                responseLanguage,
                resolution.AllowWebEnrichment,
                resolution.WebQuery,
                resolution.AllowAiActions);
            aiMessage = aiResult.Message;
            actions = MergeActions(
                resolution.Actions,
                resolution.AllowAiActions ? aiResult.Actions : []);
            if (watchCards.Count == 0)
                watchCards = await ExtractWatchCardsAsync(aiMessage, actions);
        }

        // Append 1–2 contextual follow-up suggestion chips grounded in the resolved watch cards.
        // Skipped for greetings, refusals, and cursor commands where no cards are present.
        var suggestions = BuildSuggestionActions(watchCards, actions, resolution.SuppressCompareSuggestion);
        if (suggestions.Count > 0)
            actions = [..actions, ..suggestions];

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

        if (IsGreetingQuery(message))
            return new ChatResolution
            {
                Message = GreetingMessage
            };

        var cursorResolution = TryResolveCursorCommand(message);
        if (cursorResolution != null)
            return cursorResolution;

        var mentions = await ResolveEntityMentionsAsync(message);
        var canonicalMessage = CanonicalizeQueryForRouting(message, mentions);
        var referencedWatches = await TryResolveReferencedWatchesAsync(message, lastWatchCards);

        if (IsExplicitCompareQuery(canonicalMessage))
        {
            var compareWatches = await TryResolveCompareWatchesAsync(canonicalMessage, lastWatchCards, mentions, compareScope);
            if (compareWatches.Count >= 2)
                return BuildCompareResolution(canonicalMessage, compareWatches);
        }

        if (referencedWatches.Count > 0)
            return BuildReferencedWatchResolution(canonicalMessage, referencedWatches);

        var contextualFollowUp = await TryResolveContextualFollowUpAsync(message, lastWatchCards, sessionState);
        if (contextualFollowUp != null)
            return contextualFollowUp;

        var hasWatchScope = mentions.HasAny
            || referencedWatches.Count > 0
            || WatchFinderService.HasWatchDomainSignal(canonicalMessage)
            || (sessionState?.WatchSlugs.Count > 0 && LooksLikeContextualFollowUp(message));

        if (!hasWatchScope)
        {
            if (message.Any(c => c > 127))
            {
                return new ChatResolution
                {
                    UseAi = true,
                    Query = message,
                    Context =
                    [
                        "The user appears to be writing in a non-English language. If the question relates to Tourbillon's watches, brands, or collections, answer helpfully in their language. If it is outside Tourbillon's scope, politely decline in their language."
                    ]
                };
            }

            // Shopping/occasion phrasing — route to AI with a catalogue search for context.
            // e.g. "gift for my girlfriend", "something for a black-tie dinner".
            if (LooksLikeWatchShoppingIntent(canonicalMessage))
                return await BuildShoppingGuidanceResolutionAsync(canonicalMessage);

            // Clearly off-topic — refuse and attach 3 example queries so the user
            // knows what the concierge can actually help with.
            return new ChatResolution
            {
                Message = UnsupportedQueryMessage,
                Actions = GetStaticSuggestions()
            };
        }

        if (LooksLikeBrandHistoryRequest(canonicalMessage, mentions))
            return await BuildEntityInfoResolutionAsync(
                canonicalMessage,
                mentions,
                allowWebEnrichment: true,
                allowAiActions: false);

        if (LooksLikeEntityInfoRequest(canonicalMessage, mentions))
            return await BuildEntityInfoResolutionAsync(canonicalMessage, mentions);

        var directEntityResolution = await TryResolveDirectEntityResolutionAsync(canonicalMessage, mentions, sessionState);
        if (directEntityResolution != null)
            return directEntityResolution;

        var searchResult = await _watchFinderService.FindWatchesAsync(canonicalMessage) ?? new WatchFinderResult();
        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
        {
            return new ChatResolution
            {
                Message = UnsupportedQueryMessage
            };
        }

        var exactWatch = await TryResolveExactWatchAsync(canonicalMessage, searchResult);
        if (exactWatch != null)
            return BuildExactWatchResolution(exactWatch, canonicalMessage);

        if (searchResult.Watches.Count > 0)
            return await BuildDiscoveryResolutionAsync(canonicalMessage, searchResult, mentions: mentions);

        if (mentions.HasAny)
            return await BuildEntityInfoResolutionAsync(canonicalMessage, mentions, noDirectMatch: true);

        // No catalogue match but query is watch-scoped — let AI handle it as a helpful concierge
        // response (e.g. "recommend me watch models", "what should I look for first?").
        return new ChatResolution
        {
            UseAi = true,
            Query = canonicalMessage,
            Context =
            [
                "No specific Tourbillon catalogue records were resolved for this query. Respond as a helpful boutique concierge: if the user is asking for general watch discovery or guidance, invite them to narrow the brief by style, brand, or price range. Stay concise and within Tourbillon's scope."
            ]
        };
    }

    private async Task<(string Message, List<ChatAction> Actions)> CallAiServiceAsync(
        List<ChatHistoryEntry> history,
        string query,
        List<string> context,
        string? responseLanguage = null,
        bool allowWebEnrichment = false,
        string? webQuery = null,
        bool allowAiActions = true)
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

            var payload = new
            {
                query,
                context = safeContext,
                history,
                responseLanguage,
                allowWebEnrichment,
                webQuery,
                allowActions = allowAiActions,
            };
            var resp = await httpClient.PostAsJsonAsync("/chat", payload);
            chatSw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chat ai-service /chat returned {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, chatSw.ElapsedMilliseconds);
                return (ProcessingFallbackMessage, []);
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
                ? NoCloseMatchMessage
                : message, actions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat ai-service call threw before producing a response");
            return (ProcessingFallbackMessage, []);
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

            // Skip single-word generic collection names (e.g. "Collection", "Series") — they match
            // too loosely against everyday English and pollute entity resolution.
            if (collection.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length == 1
                && _genericCollectionWords.Contains(collection.Name.Trim()))
                continue;

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
                return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: true, sessionState?.FollowUpMode);

            var storedMentions = await ResolveMentionsFromSessionStateAsync(sessionState);
            if (storedMentions.HasAny)
                return await BuildEntityInfoResolutionAsync(sessionState?.CanonicalQuery ?? query, storedMentions);
        }

        if (!LooksLikeContextualFollowUp(query) || lastWatchCards.Count == 0)
            return null;

        return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: false, sessionState?.FollowUpMode);
    }

    private async Task<ChatResolution?> TryResolveDirectEntityResolutionAsync(
        string query,
        EntityMentions mentions,
        ChatSessionState? sessionState)
    {
        var directEntityQuery = ExtractDirectEntityQuery(query, mentions, sessionState);
        if (string.IsNullOrWhiteSpace(directEntityQuery))
            return null;

        var result = await _watchFinderService.FindWatchesAsync(directEntityQuery) ?? new WatchFinderResult();
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
        bool affirmative,
        string? followUpMode)
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

        var isCompareFollowUp = string.Equals(followUpMode, "compare", StringComparison.OrdinalIgnoreCase) && ordered.Count >= 2;
        var context = new List<string>
        {
            isCompareFollowUp
                ? affirmative
                    ? "The user just affirmed the previous comparison prompt. Continue comparing these exact Tourbillon watches, stay practical, and focus on the clearest buying split rather than isolated watch descriptions."
                    : "The user is following up on an existing comparison. Stay anchored to these exact Tourbillon watches, answer in compare terms, and do not broaden into unrelated catalogue results."
                : affirmative
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
            Query = isCompareFollowUp
                ? affirmative
                    ? "Continue comparing these exact watches and explain the clearest practical split."
                    : query
                : affirmative
                    ? "Tell me more about these exact watches and guide me to the strongest next step."
                    : query,
            Context = context,
            WatchCards = ordered.Select(ToChatWatchCard).ToList(),
            Actions = isCompareFollowUp
                ? [new ChatAction
                    {
                        Type = "compare",
                        Label = "Compare these watches",
                        Slugs = ordered.Select(w => w.Slug).ToList()
                    }]
                : [],
            SessionState = BuildSessionStateFromWatches(
                ordered,
                isCompareFollowUp ? "compare" : "watch_cards",
                ordered.Count == 1 ? ordered[0].Name : BuildCanonicalEntityQuery(ordered, query)),
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

        var strippedLead = Regex.Replace(
            trimmed,
            @"^\s*(?:introduce\s+me(?:\s+to)?(?:\s+the)?|tell\s+me\s+about(?:\s+the)?(?:\s+watch\s+named)?|show\s+me(?:\s+the)?(?:\s+watch\s+named)?|the\s+watch\s+named|the\s+model\s+named|model\s+named)\s+",
            "",
            RegexOptions.IgnoreCase).Trim(' ', '.', '?', '!');

        if (!string.Equals(strippedLead, trimmed, StringComparison.OrdinalIgnoreCase)
            && (WatchFinderService.IsLikelyReferenceQuery(strippedLead)
                || WatchFinderService.IsLikelyReferenceFragment(strippedLead)
                || IsLikelyDirectNamedWatchLookup(strippedLead)))
        {
            return strippedLead;
        }

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

    private static bool IsLikelyDirectNamedWatchLookup(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return false;

        if (!Regex.IsMatch(query, @"\d"))
            return false;

        if (LooksLikeDiscoveryRequest(query))
            return false;

        if (Regex.IsMatch(
                query,
                @"\b(?:under|below|over|above|between|budget|price|compare|versus|vs\.?|against|recommend|suggest|find|looking for|look for|need|want|shopping|browse)\b",
                RegexOptions.IgnoreCase))
        {
            return false;
        }

        return true;
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
        string query,
        EntityMentions mentions,
        bool noDirectMatch = false,
        bool allowWebEnrichment = false,
        bool allowAiActions = true)
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
                "Collection guidance request: lead with the linked collection name, explain the collection's identity and where it sits within the brand, mention one or two interesting watch-relevant points from the supplied context, point the user toward linked models in that collection, and close with a warm sales-style follow-up question such as whether they want to explore a specific reference or discover adjacent models.");
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

        if (allowWebEnrichment)
        {
            context.Insert(0,
                "Brand history request: answer the maison or horology-background question directly. Use Tourbillon catalogue context first, then use any supplied secondary web notes only for factual background such as founding year, heritage, or historical positioning.");
            context.Insert(1,
                "Action guidance: do not emit compare or Smart Search actions for this reply. Keep any next step focused on the linked brand or collection pages.");
        }

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
            SuppressCompareSuggestion = true,
            SessionState = new ChatSessionState
            {
                BrandIds = mentions.Brands.Select(brand => brand.Id).Distinct().ToList(),
                CollectionIds = mentions.Collections.Select(collection => collection.Id).Distinct().ToList(),
                WatchSlugs = cards.Select(card => card.Slug).Where(slug => !string.IsNullOrWhiteSpace(slug)).Distinct(StringComparer.OrdinalIgnoreCase).Take(DiscoveryCardLimit).ToList(),
                FollowUpMode = cards.Count > 0 ? "watch_cards" : "entity_info",
                CanonicalQuery = mentions.Collections.FirstOrDefault()?.Name ?? mentions.Brands.FirstOrDefault()?.Name ?? query,
            },
            AllowWebEnrichment = allowWebEnrichment,
            WebQuery = allowWebEnrichment ? mentions.Brands.FirstOrDefault()?.Name : null,
            AllowAiActions = allowAiActions,
        };
    }

    // Resolves shopping/occasion queries that lack watch keywords but have clear purchase intent.
    // Runs a general catalogue search to populate context and watch cards so the AI can make
    // specific recommendations rather than giving purely generic advice.
    private async Task<ChatResolution> BuildShoppingGuidanceResolutionAsync(string message)
    {
        // Broaden the query with "watch" so the WatchFinder can retrieve relevant catalogue entries.
        var searchQuery = $"watch {message.Trim()}";
        var searchResult = await _watchFinderService.FindWatchesAsync(searchQuery) ?? new WatchFinderResult();

        var context = new List<string>
        {
            "Shopping guidance request: the user is looking for a watch for a specific person, occasion, or style. Help them discover relevant watches from Tourbillon's catalogue. If the context includes specific watches, highlight the best fits. Invite them to narrow by brand, budget, or style if helpful. Stay within Tourbillon's scope."
        };

        if (searchResult.Watches.Count > 0)
            return await BuildDiscoveryResolutionAsync(message, searchResult, includeSearchAction: true);

        // Fallback when WatchFinder returns nothing — respond with context-only guidance
        return new ChatResolution
        {
            UseAi = true,
            Query = message,
            Context = context,
        };
    }

    private async Task<ChatResolution> BuildDiscoveryResolutionAsync(
        string query,
        WatchFinderResult result,
        bool includeSearchAction = true,
        EntityMentions? mentions = null)
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

        var requestedBrandNames = mentions?.Brands
            .Select(brand => brand.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];
        if (requestedBrandNames.Count > 0)
        {
            var resolvedBrandNames = ordered
                .Where(watch => !string.IsNullOrWhiteSpace(watch.Brand?.Name))
                .Select(watch => watch.Brand!.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var missingBrandNames = requestedBrandNames
                .Where(name => resolvedBrandNames.All(resolved => !string.Equals(resolved, name, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            if (missingBrandNames.Count > 0)
            {
                context.Add(
                    $"Requested brand coverage: the user asked about {string.Join(", ", requestedBrandNames)}. The supplied catalogue matches only cover {string.Join(", ", resolvedBrandNames)}. Do not invent products or collections for the missing requested brands; say plainly when Tourbillon does not have a strong supplied match for them in this result set.");
            }
        }

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
                    Query = BuildSmartSearchQuery(query, ordered, mentions),
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
        var collections = watches
            .Where(w => w.Collection != null)
            .Select(w => w.Collection!)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .ToList();
        var brands = watches
            .Where(w => w.Brand != null)
            .Select(w => w.Brand!)
            .GroupBy(b => b.Id)
            .Select(g => g.First())
            .ToList();
        var isCollectionLevelCompare = IsCollectionLevelCompare(query, collections);
        var context = new List<string>
        {
            isCollectionLevelCompare
                ? "Tourbillon resolved a collection-level comparison. Compare guidance request: explain the identity and use-case split between the collections first, use the resolved watches only as representative examples, mention one practical buying distinction, stay concise, and end with a complete sentence. Assume the compare view will open immediately with these representative watches preloaded."
                : "Tourbillon resolved a concrete comparison set. Compare guidance request: explain the main split in practical buying terms, stay concise, end with a complete sentence, and assume the compare view will open immediately with these exact watches preloaded."
        };

        if (isCollectionLevelCompare)
        {
            foreach (var collection in collections)
                context.Add(BuildCollectionContext(collection));

            foreach (var brand in brands.Take(2))
                context.Add(BuildBrandContext(brand));
        }

        foreach (var watch in watches)
            context.Add(BuildWatchContext(watch));

        if (isCollectionLevelCompare)
        {
            return new ChatResolution
            {
                Message = BuildCollectionCompareMessage(collections, brands, watches),
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

    private static bool IsCollectionLevelCompare(string query, List<Collection> collections)
    {
        if (collections.Count < 2)
            return false;

        if (UsesStoredCollectionScope(query) || Regex.IsMatch(query, @"\bcollections?\b", RegexOptions.IgnoreCase))
            return true;

        var mentionedCollections = collections.Count(collection =>
            query.Contains(collection.Name, StringComparison.OrdinalIgnoreCase));

        return mentionedCollections >= 2;
    }

    private static string BuildCollectionCompareMessage(
        List<Collection> collections,
        List<Brand> brands,
        List<Watch> watches)
    {
        if (collections.Count < 2 || watches.Count < 2)
            return "Tourbillon has the representative watches loaded into compare.";

        var leftCollection = collections[0];
        var rightCollection = collections[1];
        var leftBrand = brands.FirstOrDefault(brand => brand.Id == leftCollection.BrandId);
        var rightBrand = brands.FirstOrDefault(brand => brand.Id == rightCollection.BrandId);
        var leftWatch = watches.FirstOrDefault(watch => watch.CollectionId == leftCollection.Id) ?? watches[0];
        var rightWatch = watches.FirstOrDefault(watch => watch.CollectionId == rightCollection.Id) ?? watches[1];

        var leftCollectionLink = $"[{leftCollection.Name}](/collections/{leftCollection.Slug})";
        var rightCollectionLink = $"[{rightCollection.Name}](/collections/{rightCollection.Slug})";
        var leftBrandLink = leftBrand != null && !string.IsNullOrWhiteSpace(leftBrand.Slug)
            ? $"[{leftBrand.Name}](/brands/{leftBrand.Slug})"
            : (leftBrand?.Name ?? "its brand");
        var rightBrandLink = rightBrand != null && !string.IsNullOrWhiteSpace(rightBrand.Slug)
            ? $"[{rightBrand.Name}](/brands/{rightBrand.Slug})"
            : (rightBrand?.Name ?? "its brand");
        var leftWatchLink = $"[{BuildWatchTitle(leftWatch)}](/watches/{leftWatch.Slug})";
        var rightWatchLink = $"[{BuildWatchTitle(rightWatch)}](/watches/{rightWatch.Slug})";

        return $"{leftCollectionLink} from {leftBrandLink} reads as {DescribeCollectionCharacter(leftCollection, leftWatch)}, while {rightCollectionLink} from {rightBrandLink} feels {DescribeCollectionCharacter(rightCollection, rightWatch)}. Tourbillon loaded representative references {leftWatchLink} and {rightWatchLink} into compare so you can inspect the details side by side. If you want, ask about daily wear, travel, bracelet versus strap, or which one skews dressier.";
    }

    private static string DescribeCollectionCharacter(Collection collection, Watch representativeWatch)
    {
        var descriptor = $"{collection.Style} {collection.Description} {representativeWatch.Description} {representativeWatch.Specs}".ToLowerInvariant();

        if (descriptor.Contains("casual") || descriptor.Contains("youthful") || descriptor.Contains("rubber")
            || descriptor.Contains("active") || descriptor.Contains("modern"))
            return "the more casual and modern option";

        if (descriptor.Contains("bracelet") || descriptor.Contains("integrated") || descriptor.Contains("versatile")
            || descriptor.Contains("travel") || descriptor.Contains("sport"))
            return "the more polished and versatile sport-luxury option";

        if (descriptor.Contains("dress") || descriptor.Contains("refined") || descriptor.Contains("classic")
            || descriptor.Contains("heritage") || descriptor.Contains("elegant"))
            return "the more refined and classical option";

        return "the collection with the more distinct luxury-sports character";
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

        // "both" / "either" = first two cards; "all of them/those/these" = every card up to limit
        if (Regex.IsMatch(query, @"\bboth\b|\beither\b", RegexOptions.IgnoreCase))
            return [0, 1];
        if (Regex.IsMatch(query, @"\ball\b(?:\s+(?:of\s+)?(?:them|those|these))?", RegexOptions.IgnoreCase))
            return Enumerable.Range(0, Math.Min(totalCards, 4)).ToList();

        var firstBatch = Regex.Match(query, @"\bfirst\s+(?<count>[2-4]|two|three|four)\b", RegexOptions.IgnoreCase);
        if (firstBatch.Success)
        {
            var count = ParseCompactOrdinalCount(firstBatch.Groups["count"].Value);
            if (count >= 2)
                return Enumerable.Range(0, Math.Min(count, totalCards)).ToList();
        }

        var matches = new List<(int Position, int Index)>();
        var patterns = new (string Pattern, Func<Match, int?> Resolve)[]
        {
            (@"\bfirst\b", _ => 0),
            (@"\bsecond\b", _ => 1),
            (@"\bthird\b", _ => 2),
            (@"\bfourth\b", _ => 3),
            (@"\bfifth\b", _ => 4),
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

    private static bool IsAffirmativeFollowUp(string query)
    {
        var q = query.Trim();
        // Bare affirmatives: "yes", "yeah!", "sure.", etc.
        if (Regex.IsMatch(q, @"^(?:yes|yeah|yep|sure|ok|okay|please do|go ahead|sounds good|do it)[!.]*$", RegexOptions.IgnoreCase))
            return true;
        // "yes/yeah/sure please [optional trailing words]" — e.g. "yes please show me the details"
        var words = q.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return words.Length <= 8
            && Regex.IsMatch(q, @"^(?:yes|yeah|yep|sure|ok|okay)\s+please\b", RegexOptions.IgnoreCase);
    }

    private static bool IsGreetingQuery(string query) =>
        Regex.IsMatch(query.Trim(), @"^(?:hi|hello|hey|yo|hiya|sup|what'?s up|good morning|good afternoon|good evening)[!.]*$", RegexOptions.IgnoreCase);

    private static bool LooksLikeContextualFollowUp(string query) =>
        IsAffirmativeFollowUp(query)
        || Regex.IsMatch(query, @"\b(?:that one|those|these|them|this one|first one|second one|third one|fourth one|first two|first 2)\b", RegexOptions.IgnoreCase);

    private static bool LooksLikeEntityInfoRequest(string query, EntityMentions mentions)
    {
        if (!mentions.HasAny) return false;
        if (LooksLikeDiscoveryRequest(query) || IsExplicitCompareQuery(query)) return false;

        if (Regex.IsMatch(query, @"\b(?:history|heritage|about|tell me|what is|what makes|why|who makes|background|lineage|should i wear)\b", RegexOptions.IgnoreCase))
            return true;

        return CountWords(query) <= 3;
    }

    private static bool LooksLikeBrandHistoryRequest(string query, EntityMentions mentions)
    {
        if (mentions.Brands.Count == 0)
            return false;

        if (!Regex.IsMatch(query, @"\b(?:history|heritage|background|founded|founder|origin|origins|legacy|maison|browse the web|web|internet)\b", RegexOptions.IgnoreCase))
            return false;

        return !IsExplicitCompareQuery(query);
    }

    private static bool LooksLikeDiscoveryRequest(string query) =>
        Regex.IsMatch(query,
            @"\b(?:find|show|search|looking for|look for|recommend|suggest|need|want|shopping|browse|under\s+\$?\d|between\s+\$?\d)\b",
            RegexOptions.IgnoreCase);

    // Catches shopping/occasion phrasing that lacks watch keywords but signals watch discovery
    // intent in a boutique context — e.g. "gift for my girlfriend", "something for a dinner".
    // Uses separate patterns to keep each group readable.
    private static bool LooksLikeWatchShoppingIntent(string query)
    {
        // Recipient: "for him", "for my dad", "for a woman"
        if (Regex.IsMatch(query, @"\bfor\s+(?:him|her|a\s+man|a\s+woman|my\s+(?:dad|mom|wife|husband|girlfriend|boyfriend|father|mother|partner|friend))\b", RegexOptions.IgnoreCase))
            return true;

        // Occasion: "for a dinner", "for a formal wedding", "for a black-tie event" (optional adjective)
        if (Regex.IsMatch(query, @"\bfor\s+(?:an?\s+)?(?:\w+\s+)?(?:dinner|wedding|event|gala|occasion|birthday|anniversary|trip|travel|holiday|ceremony|reception|formal)\b", RegexOptions.IgnoreCase))
            return true;

        // Gift framing
        if (Regex.IsMatch(query, @"\b(?:gift|present)\s+for\b", RegexOptions.IgnoreCase))
            return true;

        // Style adjective without a watch keyword: "something elegant", "something sporty"
        if (Regex.IsMatch(query, @"\bsomething\s+(?:elegant|sporty|casual|formal|classic|modern|slim|thin|bold|minimalist|dressy|luxurious|understated|refined)\b", RegexOptions.IgnoreCase))
            return true;

        // Explicit use-case phrases
        return Regex.IsMatch(query, @"\b(?:daily\s+driver|everyday\s+wear|dress\s+watch|sport\s+watch|weekend\s+watch|travel\s+watch|office\s+watch|business\s+watch)\b", RegexOptions.IgnoreCase);
    }

    // Returns `count` randomly selected queries from the curated bank as suggest-type actions.
    private static List<ChatAction> GetStaticSuggestions(int count = 3) =>
        _suggestedQueryBank
            .OrderBy(_ => Random.Shared.Next())
            .Take(count)
            .Select(q => new ChatAction { Type = "suggest", Label = q, Query = q })
            .ToList();

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
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var stripped = new string(decomposed
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .ToArray())
            .Normalize(NormalizationForm.FormC);
        var compact = Regex.Replace(stripped.ToLowerInvariant(), @"[^\p{L}\p{Nd}]+", " ");
        return Regex.Replace(compact, @"\s+", " ").Trim();
    }

    private static string CanonicalizeQueryForRouting(string query, EntityMentions mentions)
    {
        if (string.IsNullOrWhiteSpace(query))
            return query;

        var canonicalQuery = NormalizeCompoundWatchTerms(query);
        foreach (var brand in mentions.Brands.OrderByDescending(brand => brand.Name.Length))
        {
            var aliases = _brandAliases
                .Where(alias =>
                    LooksLikeBrandAcronymAlias(alias.Key)
                    && string.Equals(
                        NormalizeEntityText(alias.Value),
                        NormalizeEntityText(brand.Name),
                        StringComparison.OrdinalIgnoreCase))
                .Select(alias => alias.Key)
                .Where(alias => !string.Equals(alias, brand.Name, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(alias => alias.Length);

            foreach (var alias in aliases)
                canonicalQuery = Regex.Replace(canonicalQuery, $@"\b{Regex.Escape(alias)}\b", brand.Name, RegexOptions.IgnoreCase);
        }

        return canonicalQuery;
    }

    private static bool LooksLikeBrandAcronymAlias(string alias)
    {
        var lettersOnly = new string(alias.Where(char.IsLetter).ToArray());
        return lettersOnly.Length is >= 2 and <= 4
            && lettersOnly.All(char.IsUpper);
    }

    private static string NormalizeCompoundWatchTerms(string query)
    {
        var normalized = Regex.Replace(query, @"\bsportwatch(es)?\b", "sport watch$1", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bdresswatch(es)?\b", "dress watch$1", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\bdivewatch(es)?\b", "dive watch$1", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\btoolwatch(es)?\b", "tool watch$1", RegexOptions.IgnoreCase);
        return normalized;
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

    private static string BuildSmartSearchQuery(string originalQuery, List<Watch> ordered, EntityMentions? mentions = null)
    {
        var cleaned = NormalizeCompoundWatchTerms(originalQuery.Trim());

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
            @"^\s*(?:some|any|a few|few|a couple(?:\s+of)?)\s+"
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
        cleaned = Regex.Replace(cleaned, @"\b(?:please|pls|some|any|maybe|few|couple)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\bfor me\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\bsomething like\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\b(?:should i wear|would i wear|should i buy|would i buy|change the cursor to|set the cursor to|switch the cursor to)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\b(?:browse the web|search the web|web|internet|history|heritage|background|founder|founded|origins?)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim(' ', ',', '.', '?', '!');

        if (ordered.Count == 0)
            return cleaned;

        var requestedBrands = mentions?.Brands
            .Where(brand => !string.IsNullOrWhiteSpace(brand.Name))
            .Select(brand => brand.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        var requestedCollections = mentions?.Collections
            .Where(collection => !string.IsNullOrWhiteSpace(collection.Name))
            .Select(collection => collection.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        var styleHint = ExtractSmartSearchStyleHint(originalQuery);

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

        foreach (var brand in requestedBrands.Concat(distinctBrands).Distinct(StringComparer.OrdinalIgnoreCase))
            descriptor = RemoveSearchTerm(descriptor, brand);

        foreach (var collection in requestedCollections.Concat(distinctCollections).Distinct(StringComparer.OrdinalIgnoreCase))
            descriptor = RemoveSearchTerm(descriptor, collection, allowPlural: true);

        foreach (var alias in _brandAliases.Where(alias =>
            requestedBrands.Concat(distinctBrands).Contains(alias.Value, StringComparer.OrdinalIgnoreCase)))
        {
            descriptor = RemoveSearchTerm(descriptor, alias.Key, allowPlural: true);
        }

        descriptor = Regex.Replace(
            descriptor,
            @"\b(?:recommend|suggest|find|show|give|bring|help|discover|looking|look|want|need|please|pls|me|some|any|maybe|few|couple|options?|pieces?|models?|watches?|should|wear|buy|cursor|change|switch|set|jlc|ap|pp|vc|als|history|heritage|background|web|internet|founder|founded|origins?|from|and)\b",
            " ",
            RegexOptions.IgnoreCase);
        descriptor = Regex.Replace(descriptor, @"\s+", " ").Trim(' ', ',', '.', '?', '!');

        var terms = new List<string>();
        if (requestedBrands.Count > 0)
            terms.AddRange(requestedBrands);
        else if (distinctBrands.Count == 1)
            terms.Add(distinctBrands[0]);

        if (requestedCollections.Count > 0)
            terms.AddRange(requestedCollections);
        else if (requestedBrands.Count <= 1 && distinctCollections.Count == 1)
            terms.Add(distinctCollections[0]);

        if (!string.IsNullOrWhiteSpace(styleHint)
            && !terms.Contains(styleHint, StringComparer.OrdinalIgnoreCase)
            && !descriptor.Contains(styleHint, StringComparison.OrdinalIgnoreCase))
        {
            terms.Add(styleHint);
        }
        if (!string.IsNullOrWhiteSpace(descriptor))
            terms.Add(descriptor);

        var fallback = string.Join(" ", terms.Where(t => !string.IsNullOrWhiteSpace(t)));
        if (!string.IsNullOrWhiteSpace(fallback))
            return Regex.Replace(fallback, @"\s+", " ").Trim();

        return Regex.Replace(cleaned, @"\s+", " ").Trim();
    }

    private static string? ExtractSmartSearchStyleHint(string query)
    {
        var normalized = NormalizeCompoundWatchTerms(query);
        if (Regex.IsMatch(normalized, @"\bsport\s*watch", RegexOptions.IgnoreCase))
            return "sport watch";
        if (Regex.IsMatch(normalized, @"\bdress\s*watch", RegexOptions.IgnoreCase))
            return "dress watch";
        if (Regex.IsMatch(normalized, @"\bdiv(?:er|e\s*watch|ing\s*watch)", RegexOptions.IgnoreCase))
            return "diver watch";
        return null;
    }

    private static int ParseCompactOrdinalCount(string value) => value.ToLowerInvariant() switch
    {
        "2" or "two" => 2,
        "3" or "three" => 3,
        "4" or "four" => 4,
        _ => 0
    };

    private static string RemoveSearchTerm(string input, string term, bool allowPlural = false)
    {
        if (string.IsNullOrWhiteSpace(input) || string.IsNullOrWhiteSpace(term))
            return input;

        var suffix = allowPlural && !term.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? "s?" : "";
        var pattern = $@"\b{Regex.Escape(term)}{suffix}\b";
        return Regex.Replace(input, pattern, " ", RegexOptions.IgnoreCase);
    }

    private static string ResolveResponseLanguage(string query, string? preferredLanguage)
    {
        if (LooksLikeVietnameseText(query))
            return "vietnamese";

        if (LooksLikeFrenchText(query))
            return "french";

        if (query.All(c => c < 128))
            return "english";

        return NormalizeLanguageHint(preferredLanguage) ?? "english";
    }

    private static string? NormalizeLanguageHint(string? preferredLanguage)
    {
        if (string.IsNullOrWhiteSpace(preferredLanguage))
            return null;

        var normalized = preferredLanguage.Trim().ToLowerInvariant();
        if (normalized.StartsWith("en")) return "english";
        if (normalized.StartsWith("fr")) return "french";
        if (normalized.StartsWith("vi")) return "vietnamese";
        if (normalized.StartsWith("ja")) return "japanese";
        if (normalized.StartsWith("zh")) return "chinese";
        return null;
    }

    private static bool LooksLikeVietnameseText(string query) =>
        Regex.IsMatch(query, @"[ăâêôơưđáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:xin chao|xin chào|dong ho|đồng hồ|lich su|lịch sử|thuong hieu|thương hiệu|bo suu tap|bộ sưu tập)\b", RegexOptions.IgnoreCase);

    private static bool LooksLikeFrenchText(string query) =>
        Regex.IsMatch(query, @"[àâçéèêëîïôûùüÿœæ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:bonjour|montre|histoire|heritage|maison|collection|parlez[- ]moi|raconte[- ]moi|suisse)\b", RegexOptions.IgnoreCase);

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

    // Generates 0–2 contextual follow-up suggestion chips grounded in the resolved watch cards.
    // Appended after primary actions so they appear as secondary prompts, not main CTAs.
    private static List<ChatAction> BuildSuggestionActions(
        List<ChatWatchCard> watchCards,
        List<ChatAction> primaryActions,
        bool suppressCompareSuggestion = false)
    {
        if (watchCards.Count == 0)
        {
            // Greetings and cursor-only responses — show 3 example query chips so the user
            // always has a concrete next step regardless of why no cards were returned.
            if (!primaryActions.Any())
                return GetStaticSuggestions();
            return [];
        }

        var suggestions = new List<ChatAction>();
        var hasCompareAction = primaryActions.Any(a =>
            string.Equals(a.Type, "compare", StringComparison.OrdinalIgnoreCase));

        // Suggest comparing first two when no compare action was already generated
        if (!suppressCompareSuggestion && !hasCompareAction && watchCards.Count >= 2)
        {
            var label1 = CardShortLabel(watchCards[0]);
            var label2 = CardShortLabel(watchCards[1]);
            suggestions.Add(new ChatAction
            {
                Type = "compare",
                Label = $"Compare {label1} and {label2} side by side",
                Slugs = [watchCards[0].Slug, watchCards[1].Slug]
            });
        }

        // For compare responses with cards from two different brands: suggest one chip per brand.
        // For everything else: suggest the primary brand + primary collection.
        var distinctBrands = watchCards
            .Where(c => !string.IsNullOrWhiteSpace(c.BrandSlug))
            .GroupBy(c => c.BrandSlug)
            .Select(g => g.First())
            .Take(2)
            .ToList();

        if (hasCompareAction && distinctBrands.Count >= 2)
        {
            // Two different brands in a compare: suggest one brand chip per brand
            foreach (var card in distinctBrands)
            {
                if (suggestions.Count >= 2) break;
                suggestions.Add(new ChatAction
                {
                    Type = "navigate",
                    Label = $"Tell me more about {card.BrandName}",
                    Href = $"/brands/{card.BrandSlug}"
                });
            }
        }
        else
        {
            // Single brand or discovery: suggest the primary brand then primary collection
            var firstWithBrand = distinctBrands.FirstOrDefault();
            if (firstWithBrand != null && suggestions.Count < 2)
            {
                suggestions.Add(new ChatAction
                {
                    Type = "navigate",
                    Label = $"Tell me more about {firstWithBrand.BrandName}",
                    Href = $"/brands/{firstWithBrand.BrandSlug}"
                });
            }

            if (suggestions.Count < 2)
            {
                var firstWithCollection = watchCards.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.CollectionSlug));
                if (firstWithCollection != null)
                {
                    suggestions.Add(new ChatAction
                    {
                        Type = "navigate",
                        Label = $"Explore the {FormatCollectionChipName(firstWithCollection.CollectionName)} collection",
                        Href = $"/collections/{firstWithCollection.CollectionSlug}"
                    });
                }
            }
        }

        return suggestions;
    }

    // Returns the collection name with any leading generic word stripped for use in chip labels.
    // e.g. "Collection Convexe" → "Convexe", "Aquanaut" → "Aquanaut"
    private static string FormatCollectionChipName(string? collectionName)
    {
        if (string.IsNullOrWhiteSpace(collectionName)) return "this collection";
        var words = collectionName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length > 1 && _genericCollectionWords.Contains(words[0]))
            return string.Join(" ", words.Skip(1));
        return collectionName;
    }

    // Returns a short human-readable label for a chip (e.g. "Compare Aquanaut vs Overseas").
    // Prefers: last word of collection name + first reference part > non-editorial Description > Name.
    private static string CardShortLabel(ChatWatchCard card)
    {
        // Collection name last word + first name segment (e.g. "Aquanaut 5164G-001")
        var collName = card.CollectionName?.Trim();
        if (!string.IsNullOrWhiteSpace(collName))
        {
            var collWords = collName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var distinctWord = collWords.Length == 1 ? collWords[0] : collWords.Last();
            if (!_genericCollectionWords.Contains(distinctWord))
            {
                var refPart = card.Name?.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
                return string.IsNullOrWhiteSpace(refPart) ? distinctWord : $"{distinctWord} {refPart}";
            }
        }

        // Description — only if it doesn't start with an article or editorial word
        if (!string.IsNullOrWhiteSpace(card.Description))
        {
            var descWords = card.Description.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (descWords.Length >= 2 && !_editorialLeadWords.Contains(descWords[0].TrimEnd('.', ',')))
                return string.Join(" ", descWords.Take(2));
        }

        // Fallback: first word(s) of the watch name (reference number)
        var nameWords = card.Name?.Split(' ', StringSplitOptions.RemoveEmptyEntries) ?? [];
        return nameWords.Length > 0 ? string.Join(" ", nameWords.Take(2)) : card.Name ?? "";
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
        BrandName = watch.Brand?.Name,
        BrandSlug = watch.Brand?.Slug,
        CollectionName = watch.Collection?.Name,
        CollectionSlug = watch.Collection?.Slug,
    };
}
