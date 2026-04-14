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
    Task<WatchFinderResult> FindWatchesAsync(string query, IReadOnlyList<int> excludedBrandIds);
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
    private const int DiscoveryCardLimit = 10;

    // Lazy-loaded catalogue roster — built once and reused for the service lifetime.
    private string? _catalogueRoster;
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
        // Populated by each routing branch for structured tracing.
        public string RoutingPath { get; set; } = "unknown";
        // Populated when WatchFinderService is called; mirrors WatchFinderResult.SearchPath.
        public string? SearchPath { get; set; }
    }

    private sealed class EntityMentions
    {
        public List<Brand> Brands { get; set; } = [];
        public List<Collection> Collections { get; set; } = [];
        public bool HasAny => Brands.Count > 0 || Collections.Count > 0;

        // Returns a copy with rejected brands (and their collections) removed.
        public EntityMentions WithoutBrands(IReadOnlyList<int> excludedBrandIds)
        {
            var filteredBrands = Brands.Where(b => !excludedBrandIds.Contains(b.Id)).ToList();
            var allowedBrandIds = filteredBrands.Select(b => b.Id).ToHashSet();
            var filteredCollections = Collections
                .Where(c => allowedBrandIds.Contains(c.BrandId))
                .ToList();
            return new EntityMentions { Brands = filteredBrands, Collections = filteredCollections };
        }
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
        public string? DiscoveryQuery { get; set; }
        public List<string> RejectedWatchSlugs { get; set; } = [];
        public string? LastCorrectionSummary { get; set; }
        /// Brands the user has explicitly rejected in this session — persisted across turns.
        public List<int> ExcludedBrandIds { get; set; } = [];
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
            DiscoveryQuery = string.IsNullOrWhiteSpace(state.DiscoveryQuery) ? null : state.DiscoveryQuery.Trim(),
            RejectedWatchSlugs = state.RejectedWatchSlugs
                .Where(slug => !string.IsNullOrWhiteSpace(slug))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(24)
                .ToList(),
            LastCorrectionSummary = string.IsNullOrWhiteSpace(state.LastCorrectionSummary) ? null : state.LastCorrectionSummary.Trim(),
            ExcludedBrandIds = state.ExcludedBrandIds.Distinct().Take(10).ToList(),
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

        var routingSw = System.Diagnostics.Stopwatch.StartNew();
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
                resolution.WebQuery);
            var keepDeterministic = ShouldKeepDeterministicResolutionMessage(aiResult, resolution)
                || await MentionsUnsupportedResolvedEntitiesAsync(aiResult, resolution);
            aiMessage = keepDeterministic
                ? resolution.Message
                : aiResult;
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

        routingSw.Stop();
        var actionSummary = string.Join(", ", actions
            .Where(a => a.Type is "compare" or "search" or "navigate" or "set_cursor")
            .Select(a => a.Type switch
            {
                "compare"    => $"compare:{a.Slugs?.Count ?? 0}w",
                "search"     => $"search:{(a.Query?.Length > 35 ? a.Query[..35] + "…" : a.Query)}",
                "navigate"   => $"navigate:{a.Href}",
                "set_cursor" => $"cursor:{a.Cursor}",
                _            => a.Type,
            }));
        _logger.LogInformation(
            "Chat session={SessionId} path={RoutingPath} finder={SearchPath} actions=[{Actions}] cards={CardCount} elapsed={ElapsedMs}ms",
            sessionId,
            resolution.RoutingPath,
            resolution.SearchPath ?? "none",
            actionSummary,
            watchCards.Count,
            routingSw.ElapsedMilliseconds);

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
        // Fast-path checks that need no entity resolution — always safe to return early.
        if (IsAbusiveQuery(message))
            return new ChatResolution
            {
                Message = "I am here to help with Tourbillon watches and horology only. If you want, ask about a watch, brand, comparison, or product search.",
                RoutingPath = "abusive"
            };

        if (IsGreetingQuery(message))
            return new ChatResolution { Message = GreetingMessage, RoutingPath = "greeting" };

        var cursorResolution = TryResolveCursorCommand(message);
        if (cursorResolution != null)
        {
            cursorResolution.RoutingPath = "cursor";
            return cursorResolution;
        }

        // Entity resolution — required for rejection detection and all routing below.
        var mentions = await ResolveEntityMentionsAsync(message);
        var canonicalMessage = CanonicalizeQueryForRouting(message, mentions);
        var referencedWatches = await TryResolveReferencedWatchesAsync(message, lastWatchCards);

        // Detect brands the user has rejected in this turn and accumulate with prior session rejections.
        var newlyRejected = DetectBrandRejections(canonicalMessage, mentions);
        var excludedBrandIds = (sessionState?.ExcludedBrandIds ?? [])
            .Union(newlyRejected).Distinct().ToList();

        var resolution = await ResolveWatchScopedAsync(
            message, canonicalMessage, mentions, referencedWatches,
            lastWatchCards, compareScope, sessionState, excludedBrandIds);

        // Propagate accumulated exclusions into session state for future turns.
        if (excludedBrandIds.Count > 0)
        {
            resolution.SessionState ??= new ChatSessionState();
            resolution.SessionState.ExcludedBrandIds = excludedBrandIds;

            // For AI-path responses (no catalogue context injected), prepend the rejection
            // reminder so the model doesn't re-surface excluded brands from conversation history.
            if (resolution.UseAi && resolution.Context is { Count: 0 })
            {
                var excludedNames = await GetBrandNamesAsync(excludedBrandIds);
                resolution.Context.Add(
                    $"User preference: the user has expressed dislike for {string.Join(", ", excludedNames)}. Do not suggest these brands; offer alternatives from the supplied context instead.");
            }
        }
        return resolution;
    }

    // Core routing after entity resolution. Receives pre-computed excludedBrandIds so
    // WatchFinder calls and context building can honour session-level brand rejections.
    private async Task<ChatResolution> ResolveWatchScopedAsync(
        string message,
        string canonicalMessage,
        EntityMentions mentions,
        List<Watch> referencedWatches,
        List<ChatWatchCard> lastWatchCards,
        ChatCompareScope? compareScope,
        ChatSessionState? sessionState,
        List<int> excludedBrandIds)
    {
        if (IsExplicitCompareQuery(canonicalMessage))
        {
            var compareWatches = await TryResolveCompareWatchesAsync(canonicalMessage, lastWatchCards, mentions, compareScope);
            if (compareWatches.Count >= 2)
            {
                var r = await BuildCompareResolutionAsync(canonicalMessage, compareWatches);
                r.RoutingPath = "compare";
                return r;
            }
        }

        if (referencedWatches.Count > 0)
        {
            var r = BuildReferencedWatchResolution(canonicalMessage, referencedWatches);
            r.RoutingPath = "referenced_watch";
            return r;
        }

        var recommendationRevision = await TryResolveRecommendationRevisionAsync(
            message,
            canonicalMessage,
            lastWatchCards,
            sessionState,
            excludedBrandIds);
        if (recommendationRevision != null)
        {
            recommendationRevision.RoutingPath = "revision";
            return recommendationRevision;
        }

        var contextualFollowUp = await TryResolveContextualFollowUpAsync(message, lastWatchCards, sessionState, excludedBrandIds);
        if (contextualFollowUp != null)
        {
            contextualFollowUp.RoutingPath = "contextual_followup";
            return contextualFollowUp;
        }

        // Price-only follow-ups like "under 10k" lack watch keywords but are clearly watch-scoped
        // when the user is already mid-session (has watch history or active brand exclusions).
        var hasSessionContext = sessionState?.WatchSlugs.Count > 0 || sessionState?.ExcludedBrandIds.Count > 0;
        var hasWatchScope = mentions.HasAny
            || referencedWatches.Count > 0
            || WatchFinderService.HasWatchDomainSignal(canonicalMessage)
            || (sessionState?.WatchSlugs.Count > 0 && LooksLikeContextualFollowUp(message))
            || (hasSessionContext && LooksLikePriceFollowUp(canonicalMessage));

        // Queries without watch-domain signals still go to the AI for scoped wording,
        // while backend retains control of any structured actions shown to the user.
        if (!hasWatchScope)
            return new ChatResolution { UseAi = true, Query = message, Context = [], RoutingPath = "ai_fallback" };

        if (LooksLikeBrandHistoryRequest(canonicalMessage, mentions))
        {
            var r = await BuildEntityInfoResolutionAsync(canonicalMessage, mentions, allowWebEnrichment: true);
            r.RoutingPath = "brand_history";
            return r;
        }

        if (LooksLikeEntityInfoRequest(canonicalMessage, mentions))
        {
            var r = await BuildEntityInfoResolutionAsync(canonicalMessage, mentions);
            r.RoutingPath = "entity_info";
            return r;
        }

        var directEntityResolution = await TryResolveDirectEntityResolutionAsync(canonicalMessage, mentions, sessionState, excludedBrandIds);
        if (directEntityResolution != null)
        {
            directEntityResolution.RoutingPath = "entity_direct";
            return directEntityResolution;
        }

        var searchResult = excludedBrandIds.Count > 0
            ? await _watchFinderService.FindWatchesAsync(canonicalMessage, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(canonicalMessage);
        searchResult ??= new WatchFinderResult();

        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
            return new ChatResolution { Message = UnsupportedQueryMessage, RoutingPath = "non_watch" };

        var exactWatch = await TryResolveExactWatchAsync(canonicalMessage, searchResult);
        if (exactWatch != null)
        {
            var r = BuildExactWatchResolution(exactWatch, canonicalMessage);
            r.RoutingPath = "exact_match";
            r.SearchPath = searchResult.SearchPath;
            return r;
        }

        if (searchResult.Watches.Count > 0)
        {
            var r = await BuildDiscoveryResolutionAsync(canonicalMessage, searchResult, excludedBrandIds, mentions: mentions);
            r.RoutingPath = "discovery";
            r.SearchPath = searchResult.SearchPath;
            return r;
        }

        // Suppress entity info for any brand the user has rejected — the entity info path
        // returns that brand's watches, which would re-surface the rejected brand.
        var filteredMentions = excludedBrandIds.Count > 0
            ? mentions.WithoutBrands(excludedBrandIds)
            : mentions;

        if (filteredMentions.HasAny)
        {
            var r = await BuildEntityInfoResolutionAsync(canonicalMessage, filteredMentions, noDirectMatch: true);
            r.RoutingPath = "entity_info_fallback";
            return r;
        }

        // No catalogue match but query is watch-scoped — let AI handle it as a helpful concierge
        // response (e.g. "recommend me watch models", "what should I look for first?").
        return new ChatResolution
        {
            UseAi = true,
            Query = canonicalMessage,
            RoutingPath = "ai_no_match",
            Context =
            [
                "No specific Tourbillon catalogue records were resolved for this query. Respond as a helpful boutique concierge: if the user is asking for general watch discovery or guidance, invite them to narrow the brief by style, brand, or price range. Stay concise and within Tourbillon's scope."
            ]
        };
    }

    private async Task<string> CallAiServiceAsync(
        List<ChatHistoryEntry> history,
        string query,
        List<string> context,
        string? responseLanguage = null,
        bool allowWebEnrichment = false,
        string? webQuery = null)
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
            };
            var resp = await httpClient.PostAsJsonAsync("/chat", payload);
            chatSw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chat ai-service /chat returned {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, chatSw.ElapsedMilliseconds);
                return ProcessingFallbackMessage;
            }

            _logger.LogInformation("Chat ai-service /chat {ElapsedMs}ms", chatSw.ElapsedMilliseconds);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            var message = json.TryGetProperty("message", out var messageEl) ? messageEl.GetString() ?? "" : "";
            return string.IsNullOrWhiteSpace(message)
                ? NoCloseMatchMessage
                : message;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat ai-service call threw before producing a response");
            return ProcessingFallbackMessage;
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

        var blockedCollectionTokens = WatchFinderService.BuildBlockedCollectionTokens(mentions.Brands);
        var fuzzyCollections = WatchFinderService.ResolveFuzzyCollections(
            query,
            collections,
            matchedBrandIds,
            blockedCollectionTokens);
        foreach (var collection in fuzzyCollections)
        {
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
        ChatSessionState? sessionState,
        List<int>? excludedBrandIds = null)
    {
        // Strip cards from rejected brands so follow-up paths never re-surface them.
        if (excludedBrandIds?.Count > 0)
            lastWatchCards = lastWatchCards.Where(c => !excludedBrandIds.Contains(c.BrandId)).ToList();

        if (IsAffirmativeFollowUp(query))
        {
            if (lastWatchCards.Count > 0)
                return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: true, sessionState?.FollowUpMode);

            var storedMentions = await ResolveMentionsFromSessionStateAsync(sessionState);
            if (storedMentions.HasAny)
                return await BuildEntityInfoResolutionAsync(sessionState?.CanonicalQuery ?? query, storedMentions);
        }

        // "Show me more" in a compare context would otherwise re-echo the same cards.
        // Instead, reload all models from the session's collections excluding already-shown slugs.
        if (string.Equals(sessionState?.FollowUpMode, "compare", StringComparison.OrdinalIgnoreCase)
            && sessionState?.CollectionIds.Count > 0
            && LooksLikeExplicitMoreRequest(query))
        {
            var shownSlugs = lastWatchCards
                .Select(c => c.Slug)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var moreWatches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .AsNoTracking()
                .Where(w => sessionState.CollectionIds.Contains(w.CollectionId ?? 0)
                    && !shownSlugs.Contains(w.Slug))
                .OrderByDescending(w => w.CurrentPrice)
                .Take(DiscoveryCardLimit)
                .ToListAsync();

            if (moreWatches.Count > 0)
            {
                var moreCards = moreWatches.Select(ToChatWatchCard).ToList();
                var moreContext = new List<string>
                {
                    "The user wants to see more models from the collections already under discussion. Surface these additional models, note what distinguishes them from the earlier set, and invite the user to compare any two or narrow the brief."
                };
                foreach (var w in moreWatches)
                    moreContext.Add(BuildWatchContext(w));

                return new ChatResolution
                {
                    UseAi = true,
                    Query = query,
                    Context = moreContext,
                    WatchCards = moreCards,
                    Actions = [],
                    RoutingPath = "compare_expand",
                    SessionState = new ChatSessionState
                    {
                        CollectionIds = sessionState.CollectionIds,
                        BrandIds = sessionState.BrandIds,
                        WatchSlugs = moreCards.Select(c => c.Slug).Where(s => !string.IsNullOrWhiteSpace(s)).ToList(),
                        FollowUpMode = "compare",
                        CanonicalQuery = sessionState.CanonicalQuery,
                    }
                };
            }

            // All models from these collections have already been surfaced — return a message
            // only (no cards) so the old set is not re-echoed.
            return new ChatResolution
            {
                Message = "Those are all the current models from these collections in the Tourbillon catalogue. Let me know if you'd like to compare any two or explore a different brief.",
                WatchCards = [],
                Actions = [],
                RoutingPath = "compare_expand",
                SessionState = sessionState,
            };
        }

        if (!LooksLikeContextualFollowUp(query) || lastWatchCards.Count == 0)
        {
            if (lastWatchCards.Count > 0 && LooksLikeShortlistContinuation(query))
                return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: false, sessionState?.FollowUpMode);

            return null;
        }

        return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: false, sessionState?.FollowUpMode);
    }

    private async Task<ChatResolution?> TryResolveRecommendationRevisionAsync(
        string originalMessage,
        string canonicalMessage,
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState? sessionState,
        List<int> excludedBrandIds)
    {
        if (excludedBrandIds.Count > 0)
            lastWatchCards = lastWatchCards.Where(card => !excludedBrandIds.Contains(card.BrandId)).ToList();

        if (!LooksLikeRecommendationRevision(canonicalMessage, lastWatchCards, sessionState))
            return null;

        var accumulatedRejectedSlugs = (sessionState?.RejectedWatchSlugs ?? [])
            .Union(DetectRejectedWatchSlugs(canonicalMessage, lastWatchCards), StringComparer.OrdinalIgnoreCase)
            .ToList();

        var revisionSummary = ExtractRecommendationCorrectionFocus(canonicalMessage);
        var revisedQuery = BuildRecommendationRevisionQuery(
            canonicalMessage,
            sessionState?.DiscoveryQuery ?? sessionState?.CanonicalQuery,
            revisionSummary);

        var searchResult = excludedBrandIds.Count > 0
            ? await _watchFinderService.FindWatchesAsync(revisedQuery, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(revisedQuery);
        searchResult ??= new WatchFinderResult();

        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
            return null;

        var filteredResult = FilterRejectedWatchCandidates(searchResult, accumulatedRejectedSlugs);
        if (filteredResult.Watches.Count == 0)
        {
            return new ChatResolution
            {
                Message = "Tourbillon could not find a stronger revised shortlist in the current catalogue yet. Try narrowing by material, occasion, price, or a specific brand.",
                SessionState = BuildUpdatedRecommendationState(
                    sessionState,
                    [],
                    sessionState?.DiscoveryQuery ?? revisedQuery,
                    revisionSummary,
                    accumulatedRejectedSlugs,
                    excludedBrandIds)
            };
        }

        var revisedMentions = await ResolveEntityMentionsAsync(revisedQuery);
        var resolution = await BuildDiscoveryResolutionAsync(
            revisedQuery,
            filteredResult,
            excludedBrandIds,
            includeSearchAction: true,
            mentions: revisedMentions,
            revisionSummary: string.IsNullOrWhiteSpace(revisionSummary) ? originalMessage.Trim() : revisionSummary,
            rejectedWatchSlugs: accumulatedRejectedSlugs);

        var revisedWatches = await LoadWatchesByIdsAsync(
            filteredResult.Watches.Take(DiscoveryCardLimit).Select(watch => watch.Id).ToList());
        resolution.SessionState = BuildUpdatedRecommendationState(
            resolution.SessionState ?? sessionState,
            revisedWatches,
            revisedQuery,
            revisionSummary,
            accumulatedRejectedSlugs,
            excludedBrandIds);
        return resolution;
    }

    private async Task<ChatResolution?> TryResolveDirectEntityResolutionAsync(
        string query,
        EntityMentions mentions,
        ChatSessionState? sessionState,
        List<int>? excludedBrandIds = null)
    {
        var directEntityQuery = ExtractDirectEntityQuery(query, mentions, sessionState);
        if (string.IsNullOrWhiteSpace(directEntityQuery))
            return null;

        var result = (excludedBrandIds?.Count > 0
            ? await _watchFinderService.FindWatchesAsync(directEntityQuery, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(directEntityQuery))
            ?? new WatchFinderResult();
        if (string.Equals(result.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase) || result.Watches.Count == 0)
            return null;

        var exactWatch = await TryResolveExactWatchAsync(directEntityQuery, result);
        if (exactWatch != null)
            return BuildExactWatchResolution(exactWatch, directEntityQuery);

        return await BuildDiscoveryResolutionAsync(directEntityQuery, result, excludedBrandIds, includeSearchAction: false);
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
            Message = BuildCardContinuationFallbackMessage(ordered, isCompareFollowUp, affirmative),
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
                ordered.Count == 1 ? ordered[0].Name : BuildCanonicalEntityQuery(ordered, query),
                discoveryQuery: query),
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
        string? canonicalQuery = null,
        string? discoveryQuery = null)
    {
        return new ChatSessionState
        {
            BrandIds = watches.Select(w => w.BrandId).Distinct().ToList(),
            CollectionIds = watches.Where(w => w.CollectionId != null).Select(w => w.CollectionId!.Value).Distinct().ToList(),
            WatchSlugs = watches.Select(w => w.Slug).ToList(),
            FollowUpMode = followUpMode,
            CanonicalQuery = canonicalQuery,
            DiscoveryQuery = discoveryQuery,
        };
    }

    private static ChatSessionState BuildFallbackSessionState(List<ChatWatchCard> cards)
    {
        return new ChatSessionState
        {
            BrandIds = cards.Select(card => card.BrandId).Distinct().ToList(),
            WatchSlugs = cards.Select(card => card.Slug).Where(slug => !string.IsNullOrWhiteSpace(slug)).ToList(),
            FollowUpMode = cards.Count > 0 ? "watch_cards" : "",
            DiscoveryQuery = cards.Count > 0
                ? string.Join(" ", cards
                    .Select(card => card.CollectionName ?? card.BrandName)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(3))
                : null,
        };
    }

    private async Task<List<Watch>> LoadWatchesByIdsAsync(List<int> ids)
    {
        if (ids.Count == 0)
            return [];

        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => ids.Contains(w.Id))
            .ToListAsync();

        return ids
            .Select(id => watches.FirstOrDefault(w => w.Id == id))
            .Where(w => w != null)
            .Cast<Watch>()
            .ToList();
    }

    // Returns a prestige tier used to stable-sort discovery cards so higher-tier brands
    // surface first when WatchFinder's vector ranking alone would promote entry-level brands.
    // Tier 4 — Holy Trinity + Lange: Patek Philippe, Vacheron Constantin, Audemars Piguet, A. Lange & Söhne.
    // Tier 3 — All other prestige brands (Rolex, Grand Seiko, F.P. Journe, JLC, Omega, Glashütte Original, etc.).
    // Tier 2 — Frédérique Constant (accessible luxury, should not lead prestige shortlists).
    private static int GetBrandPrestigeTier(Watch watch)
    {
        var name = watch.Brand?.Name ?? "";
        if (name.Contains("Patek", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Vacheron", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Audemars", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Lange", StringComparison.OrdinalIgnoreCase)) return 4;
        if (name.Contains("Frédérique", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Frederique", StringComparison.OrdinalIgnoreCase)) return 2;
        return 3;
    }

    private static ChatSessionState BuildUpdatedRecommendationState(
        ChatSessionState? existingState,
        List<Watch> watches,
        string discoveryQuery,
        string? revisionSummary,
        IReadOnlyCollection<string> rejectedWatchSlugs,
        IReadOnlyCollection<int> excludedBrandIds)
    {
        var nextState = watches.Count > 0
            ? BuildSessionStateFromWatches(
                watches,
                "watch_cards",
                BuildCanonicalEntityQuery(watches, discoveryQuery),
                discoveryQuery: discoveryQuery)
            : new ChatSessionState
            {
                FollowUpMode = "watch_cards",
                CanonicalQuery = existingState?.CanonicalQuery ?? discoveryQuery,
                DiscoveryQuery = discoveryQuery,
            };

        nextState.RejectedWatchSlugs = (existingState?.RejectedWatchSlugs ?? [])
            .Union(rejectedWatchSlugs, StringComparer.OrdinalIgnoreCase)
            .ToList();
        nextState.ExcludedBrandIds = (existingState?.ExcludedBrandIds ?? [])
            .Union(excludedBrandIds)
            .Distinct()
            .ToList();
        nextState.LastCorrectionSummary = string.IsNullOrWhiteSpace(revisionSummary)
            ? existingState?.LastCorrectionSummary
            : revisionSummary.Trim();

        return nextState;
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
        bool allowWebEnrichment = false)
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
        };
    }

    private async Task<ChatResolution> BuildDiscoveryResolutionAsync(
        string query,
        WatchFinderResult result,
        List<int>? excludedBrandIds = null,
        bool includeSearchAction = true,
        EntityMentions? mentions = null,
        string? revisionSummary = null,
        IReadOnlyCollection<string>? rejectedWatchSlugs = null)
    {
        var topIds = result.Watches.Take(DiscoveryCardLimit).Select(w => w.Id).Distinct().ToList();
        var ordered = await LoadWatchesByIdsAsync(topIds);
        var requestedDirections = DetectDiscoveryDirections(query);
        ordered = await DiversifyDiscoveryWatchesAsync(
            query,
            ordered,
            requestedDirections,
            mentions,
            excludedBrandIds);

        // For unidirectional queries the diversifier does nothing, so WatchFinder's raw
        // vector ranking determines order. Apply a stable prestige sort so higher-tier
        // brands surface first regardless of embedding score — same tier weights as the
        // watch listing Featured sort (PP=5, VC/AP/Rolex=4, JLC/Omega=3, others=1).
        if (requestedDirections.Count < 2)
            ordered = [.. ordered.OrderByDescending(GetBrandPrestigeTier)];

        if (rejectedWatchSlugs is { Count: > 0 })
        {
            ordered = ordered
                .Where(watch => !string.IsNullOrWhiteSpace(watch.Slug)
                    && !rejectedWatchSlugs.Contains(watch.Slug, StringComparer.OrdinalIgnoreCase))
                .Take(DiscoveryCardLimit)
                .ToList();
        }

        var context = new List<string>
        {
            includeSearchAction
                ? $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Search guidance request: answer like a sales concierge, highlight the strongest matches, give each surfaced watch one short fit reason tied to the brief, tell the user the Smart Search chip can broaden discovery, emit one Smart Search action with a concise catalogue-style query built from the resolved matches rather than the user's raw wording, and end with a short follow-up question about size, material, budget, occasion, or a specific model."
                : $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Answer like a sales concierge, stay anchored to these exact catalogue matches, give each surfaced watch one short fit reason tied to the brief, do not emit a Smart Search action, and end with a short follow-up question about size, material, budget, occasion, or a specific model.",
            includeSearchAction
                ? "Smart Search action guidance: rewrite discovery queries into compact catalogue terms. Prefer canonical brand and collection names from the supplied context. Good example: 'Jaeger-LeCoultre Reverso'. Bad example: 'yo, suggest me some reversos'."
                : "Action guidance: no Smart Search action is needed for this reply."
        };

        context.Add("Recommendation writing guidance: reason from catalogue facts and description cues, but do not paste or closely paraphrase Watch.Description into the answer.");
        if (requestedDirections.Count >= 2)
        {
            context.Insert(0,
                $"Mixed brief guidance: the user wants a shortlist that covers {string.Join(" and ", requestedDirections.Select(FormatDirectionLabel))}. Keep the answer grouped or clearly balanced across those directions, and keep the surfaced watches aligned with that split.");
        }
        if (!string.IsNullOrWhiteSpace(revisionSummary))
            context.Insert(0, $"Recommendation revision request: the user corrected or rejected the previous shortlist ({revisionSummary}). Replace the prior direction with a genuinely revised set from the supplied catalogue context only, and do not resurface the rejected watches.");

        var requestedBrandNames = mentions?.Brands
            .Select(brand => brand.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];
        var resolvedBrandNames = ordered
            .Where(watch => !string.IsNullOrWhiteSpace(watch.Brand?.Name))
            .Select(watch => watch.Brand!.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var missingBrandNames = requestedBrandNames.Count == 0
            ? []
            : requestedBrandNames
                .Where(name => resolvedBrandNames.All(resolved => !string.Equals(resolved, name, StringComparison.OrdinalIgnoreCase)))
                .ToList();

        if (requestedBrandNames.Count > 0)
        {
            if (missingBrandNames.Count > 0)
            {
                context.Add(
                    $"Requested brand coverage: the user asked about {string.Join(", ", requestedBrandNames)}. The supplied catalogue matches only cover {string.Join(", ", resolvedBrandNames)}. Do not invent products or collections for the missing requested brands; say plainly when Tourbillon does not have a strong supplied match for them in this result set.");
            }
        }

        if (excludedBrandIds?.Count > 0)
        {
            var excludedNames = await GetBrandNamesAsync(excludedBrandIds);
            context.Add($"User preference: the user has expressed dislike for {string.Join(", ", excludedNames)}. Do not suggest these brands; offer alternatives from the supplied watches instead.");
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

        var coverageMessage = BuildMissingBrandCoverageMessage(
            missingBrandNames,
            resolvedBrandNames,
            ordered,
            result.QueryIntent?.Style,
            includeSearchAction);
        if (coverageMessage != null)
        {
            return new ChatResolution
            {
                Message = coverageMessage,
                WatchCards = ordered.Select(ToChatWatchCard).Take(DiscoveryCardLimit).ToList(),
                Actions = actions,
                SessionState = BuildSessionStateFromWatches(
                    ordered,
                    "watch_cards",
                    BuildCanonicalEntityQuery(ordered, query),
                    discoveryQuery: query)
            };
        }

        return new ChatResolution
        {
            UseAi = true,
            Message = BuildGroundedDiscoveryMessage(ordered, includeSearchAction, requestedDirections),
            Query = query,
            Context = context,
            WatchCards = ordered.Select(ToChatWatchCard).Take(DiscoveryCardLimit).ToList(),
            Actions = actions,
            SessionState = BuildSessionStateFromWatches(
                ordered,
                "watch_cards",
                BuildCanonicalEntityQuery(ordered, query),
                discoveryQuery: query)
        };
    }

    private static string? BuildMissingBrandCoverageMessage(
        List<string> missingBrandNames,
        List<string> resolvedBrandNames,
        List<Watch> ordered,
        string? style,
        bool includeSearchAction)
    {
        if (missingBrandNames.Count == 0 || ordered.Count == 0 || resolvedBrandNames.Count == 0)
            return null;

        var styleLabel = style switch
        {
            "sport" => "sport-watch",
            "dress" => "dress-watch",
            "diver" => "diver-watch",
            _ => "catalogue"
        };

        var primaryCollection = ordered
            .Select(w => w.Collection?.Name)
            .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name));
        var primaryBrand = resolvedBrandNames[0];
        var coverageLead = missingBrandNames.Count == 1
            ? $"Tourbillon does not have a strong {styleLabel} match for {missingBrandNames[0]} in this result set."
            : $"Tourbillon does not have strong {styleLabel} matches for {string.Join(", ", missingBrandNames)} in this result set.";

        var resolvedLead = !string.IsNullOrWhiteSpace(primaryCollection)
            ? $"The clearest match here is {primaryBrand}'s {primaryCollection}."
            : $"The clearest supplied match here is from {primaryBrand}.";
        var close = includeSearchAction
            ? "Open Smart Search to broaden the brief, or compare the surfaced watches side by side."
            : "If you want, compare the surfaced watches side by side or narrow the brief by budget, size, or material.";

        return $"{coverageLead} {resolvedLead} {close}";
    }

    private async Task<List<Watch>> DiversifyDiscoveryWatchesAsync(
        string query,
        List<Watch> currentOrdered,
        List<string> requestedDirections,
        EntityMentions? mentions,
        List<int>? excludedBrandIds)
    {
        if (currentOrdered.Count == 0 || requestedDirections.Count < 2)
            return currentOrdered.Take(DiscoveryCardLimit).ToList();

        var missingDirections = requestedDirections
            .Where(direction => !currentOrdered.Any(watch => WatchMatchesDirection(watch, direction)))
            .ToList();

        if (missingDirections.Count == 0 && currentOrdered.Count >= Math.Min(DiscoveryCardLimit, requestedDirections.Count * 2))
            return currentOrdered.Take(DiscoveryCardLimit).ToList();

        var directionalQueries = requestedDirections
            .Select(direction => new
            {
                Direction = direction,
                Query = BuildDirectionalDiscoveryQuery(query, mentions, direction)
            })
            .DistinctBy(item => item.Query, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var directionalPools = new List<(string Direction, List<Watch> Watches)>();
        foreach (var item in directionalQueries)
        {
            var searchResult = excludedBrandIds?.Count > 0
                ? await _watchFinderService.FindWatchesAsync(item.Query, excludedBrandIds)
                : await _watchFinderService.FindWatchesAsync(item.Query);
            searchResult ??= new WatchFinderResult();

            var watchIds = searchResult.Watches
                .Take(DiscoveryCardLimit)
                .Select(watch => watch.Id)
                .Distinct()
                .ToList();
            var loaded = watchIds.Count > 0
                ? await LoadWatchesByIdsAsync(watchIds)
                : [];
            if (loaded.Count == 0)
                loaded = await LoadDirectionalFallbackWatchesAsync(item.Direction, mentions, excludedBrandIds);

            var matched = loaded
                .Where(watch => WatchMatchesDirection(watch, item.Direction))
                .ToList();
            if (matched.Count == 0)
                matched = await LoadDirectionalFallbackWatchesAsync(item.Direction, mentions, excludedBrandIds);

            directionalPools.Add((item.Direction, matched));
        }
        var merged = new List<Watch>();
        var seenSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddWatch(Watch watch)
        {
            if (merged.Count >= DiscoveryCardLimit || string.IsNullOrWhiteSpace(watch.Slug))
                return;

            if (seenSlugs.Add(watch.Slug))
                merged.Add(watch);
        }

        foreach (var direction in requestedDirections)
        {
            foreach (var watch in directionalPools
                .Where(pool => string.Equals(pool.Direction, direction, StringComparison.OrdinalIgnoreCase))
                .SelectMany(pool => pool.Watches)
                .Take(3))
            {
                AddWatch(watch);
            }
        }

        foreach (var watch in currentOrdered)
            AddWatch(watch);

        foreach (var watch in directionalPools.SelectMany(pool => pool.Watches))
            AddWatch(watch);

        return merged.Count > 0
            ? merged.Take(DiscoveryCardLimit).ToList()
            : currentOrdered.Take(DiscoveryCardLimit).ToList();
    }

    private static List<string> DetectDiscoveryDirections(string query)
    {
        var directions = new List<string>();
        AddDiscoveryDirectionIfMatched(directions, query, "art", @"\b(?:art|artistic|artisan|craft|craftsmanship|metiers d'?art|rare handcraft)\b");
        AddDiscoveryDirectionIfMatched(directions, query, "diver", @"\b(?:dive|diver|diving|tool watch|tool watches)\b");
        AddDiscoveryDirectionIfMatched(directions, query, "dress", @"\b(?:dress|formal|elegant|black tie)\b");
        AddDiscoveryDirectionIfMatched(directions, query, "sport", @"\b(?:sport|sporty|sports|everyday sport|luxury sport)\b");
        return directions;
    }

    private static void AddDiscoveryDirectionIfMatched(List<string> directions, string query, string direction, string pattern)
    {
        if (Regex.IsMatch(query, pattern, RegexOptions.IgnoreCase) && !directions.Contains(direction, StringComparer.OrdinalIgnoreCase))
            directions.Add(direction);
    }

    private static string FormatDirectionLabel(string direction) => direction switch
    {
        "art" => "art-led watches",
        "diver" => "dive watches",
        "dress" => "dress watches",
        "sport" => "sport watches",
        _ => direction
    };

    private static bool WatchMatchesDirection(Watch watch, string direction)
    {
        var styles = watch.Collection?.Styles ?? [];
        if (styles.Contains(direction, StringComparer.OrdinalIgnoreCase))
            return true;

        var searchable = $"{watch.Description} {watch.Collection?.Name} {watch.Collection?.Description}";
        return direction switch
        {
            "art" => Regex.IsMatch(searchable, @"\b(?:metiers d'?art|guilloche|enamel|engraving|miniature painting|gem[- ]setting|urushi|maki[- ]e)\b", RegexOptions.IgnoreCase),
            "diver" => Regex.IsMatch(searchable, @"\b(?:dive|diver|diving|seamaster|submariner|marine|polaris)\b", RegexOptions.IgnoreCase),
            "dress" => Regex.IsMatch(searchable, @"\b(?:dress|formal|elegant|patrimony|calatrava|ultra thin)\b", RegexOptions.IgnoreCase),
            "sport" => Regex.IsMatch(searchable, @"\b(?:sport|sporty|chronograph|gmt|nautilus|overseas|royal oak)\b", RegexOptions.IgnoreCase),
            _ => false
        };
    }

    private async Task<List<Watch>> LoadDirectionalFallbackWatchesAsync(
        string direction,
        EntityMentions? mentions,
        List<int>? excludedBrandIds)
    {
        var query = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => w.Collection != null && w.Collection.Styles.Contains(direction));

        if (mentions?.Brands.Count > 0)
        {
            var brandIds = mentions.Brands.Select(brand => brand.Id).ToList();
            query = query.Where(w => brandIds.Contains(w.BrandId));
        }

        if (excludedBrandIds?.Count > 0)
            query = query.Where(w => !excludedBrandIds.Contains(w.BrandId));

        return await query
            .OrderBy(w => w.Brand!.Name)
            .ThenBy(w => w.Collection!.Name)
            .ThenBy(w => w.Name)
            .Take(DiscoveryCardLimit)
            .ToListAsync();
    }

    private static string BuildDirectionalDiscoveryQuery(string originalQuery, EntityMentions? mentions, string direction)
    {
        var parts = new List<string>();
        parts.AddRange((mentions?.Brands ?? [])
            .Where(brand => !string.IsNullOrWhiteSpace(brand.Name))
            .Select(brand => brand.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2));

        parts.Add(direction switch
        {
            "art" => "art watches",
            "diver" => "dive watches",
            "dress" => "dress watches",
            "sport" => "sport watches",
            _ => originalQuery
        });

        var budgetClause = ExtractBudgetClause(originalQuery);
        if (!string.IsNullOrWhiteSpace(budgetClause))
            parts.Add(budgetClause);

        return string.Join(" ", parts.Where(part => !string.IsNullOrWhiteSpace(part))).Trim();
    }

    private static string? ExtractBudgetClause(string query)
    {
        var match = Regex.Match(
            query,
            @"\b(?:under|below|over|above|around)\s+\$?\d[\d,]*(?:\s*k)?\b|\bbetween\s+\$?\d[\d,]*(?:\s*k)?\s+(?:and|to)\s+\$?\d[\d,]*(?:\s*k)?\b",
            RegexOptions.IgnoreCase);
        return match.Success ? match.Value.Trim() : null;
    }

    private static string BuildGroundedDiscoveryMessage(List<Watch> ordered, bool includeSearchAction, List<string>? requestedDirections = null)
    {
        if (ordered.Count == 0)
            return NoCloseMatchMessage;

        requestedDirections ??= [];
        if (requestedDirections.Count >= 2)
        {
            var representatives = requestedDirections
                .Select(direction => (Direction: direction, Watch: ordered.FirstOrDefault(watch => WatchMatchesDirection(watch, direction))))
                .Where(entry => entry.Watch != null)
                .ToList();

            if (representatives.Count >= 2)
            {
                var leftWatch = representatives[0].Watch!;
                var rightWatch = representatives[1].Watch!;
                var leftLink = $"[{BuildWatchTitle(leftWatch)}](/watches/{leftWatch.Slug})";
                var rightLink = $"[{BuildWatchTitle(rightWatch)}](/watches/{rightWatch.Slug})";
                var closeMixed = includeSearchAction
                    ? "Open Smart Search to broaden either direction, or ask Tourbillon to narrow the final picks."
                    : "If you want, ask Tourbillon to narrow the final picks or compare the strongest two side by side.";

                return $"{leftLink} carries the {FormatDirectionLabel(representatives[0].Direction)} side of the brief, while {rightLink} covers the {FormatDirectionLabel(representatives[1].Direction)} angle. {closeMixed}";
            }
        }

        var first = ordered[0];
        var firstBrandLink = first.Brand != null && !string.IsNullOrWhiteSpace(first.Brand.Slug)
            ? $"[{first.Brand.Name}](/brands/{first.Brand.Slug})"
            : "its brand";
        var firstCollectionLink = first.Collection != null && !string.IsNullOrWhiteSpace(first.Collection.Slug)
            ? $"[{first.Collection.Name}](/collections/{first.Collection.Slug})"
            : null;
        var firstWatchLink = $"[{BuildWatchTitle(first)}](/watches/{first.Slug})";

        if (ordered.Count == 1)
        {
            var close = includeSearchAction
                ? "Open Smart Search to broaden the brief if you want adjacent options."
                : "If you want, ask about size, material, or a nearby alternative.";
            return firstCollectionLink != null
                ? $"{firstWatchLink} in {firstCollectionLink} from {firstBrandLink} is the clearest catalogue match Tourbillon surfaced. {close}"
                : $"{firstWatchLink} from {firstBrandLink} is the clearest catalogue match Tourbillon surfaced. {close}";
        }

        var second = ordered[1];
        var secondWatchLink = $"[{BuildWatchTitle(second)}](/watches/{second.Slug})";
        var secondCollectionLink = second.Collection != null && !string.IsNullOrWhiteSpace(second.Collection.Slug)
            ? $"[{second.Collection.Name}](/collections/{second.Collection.Slug})"
            : null;
        var closeTwo = includeSearchAction
            ? "Open Smart Search to broaden the brief, or compare the surfaced watches side by side."
            : "If you want, compare the surfaced watches side by side or narrow by size, material, or budget.";

        if (firstCollectionLink != null && secondCollectionLink != null)
            return $"{firstWatchLink} in {firstCollectionLink} and {secondWatchLink} in {secondCollectionLink} are the strongest catalogue matches Tourbillon surfaced. {closeTwo}";

        return $"{firstWatchLink} and {secondWatchLink} are the strongest catalogue matches Tourbillon surfaced. {closeTwo}";
    }

    private static bool ShouldKeepDeterministicResolutionMessage(string? aiMessage, ChatResolution resolution)
    {
        if (string.IsNullOrWhiteSpace(resolution.Message))
            return false;

        if (resolution.WatchCards.Count == 0 && resolution.Actions.Count == 0)
            return false;

        if (string.IsNullOrWhiteSpace(aiMessage))
            return true;

        return IsGenericAiFallbackMessage(aiMessage)
            || IsUngroundedCatalogueReply(aiMessage, resolution);
    }

    private static bool IsGenericAiFallbackMessage(string message)
    {
        var normalized = Regex.Replace(message, @"\s+", " ").Trim();
        return normalized.Equals(NoCloseMatchMessage, StringComparison.OrdinalIgnoreCase)
            || normalized.Equals(ProcessingFallbackMessage, StringComparison.OrdinalIgnoreCase)
            || normalized.Equals(UnsupportedQueryMessage, StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("I don't quite get the request from the current Tourbillon catalogue context.", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("I don't quite get that request right now.", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("I specialise in Tourbillon watches and horology.", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsUngroundedCatalogueReply(string message, ChatResolution resolution)
    {
        if (resolution.WatchCards.Count == 0)
            return false;

        if (resolution.Actions.Any(action => string.Equals(action.Type, "compare", StringComparison.OrdinalIgnoreCase)))
            return false;

        return !MentionsResolvedCatalogueEntity(message, resolution.WatchCards);
    }

    private static bool MentionsResolvedCatalogueEntity(string message, List<ChatWatchCard> watchCards)
    {
        var normalizedMessage = NormalizeEntityText(message);
        var candidates = watchCards
            .Take(3)
            .SelectMany(card => new[] { card.BrandName, card.CollectionName, card.Name })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => NormalizeEntityText(value!))
            .Where(value => value.Length >= 4)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        return candidates.Any(candidate => normalizedMessage.Contains(candidate, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<bool> MentionsUnsupportedResolvedEntitiesAsync(string message, ChatResolution resolution)
    {
        if (string.IsNullOrWhiteSpace(message) || resolution.WatchCards.Count == 0)
            return false;

        var normalizedMessage = NormalizeEntityText(message);
        if (string.IsNullOrWhiteSpace(normalizedMessage))
            return false;

        var allowedNames = resolution.WatchCards
            .SelectMany(card => new[] { card.BrandName, card.CollectionName, card.Name })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => NormalizeEntityText(value!))
            .Where(value => value.Length >= 4)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var brandNames = await _context.Brands
            .AsNoTracking()
            .Select(brand => brand.Name)
            .ToListAsync();
        var collectionNames = await _context.Collections
            .AsNoTracking()
            .Select(collection => collection.Name)
            .ToListAsync();

        var knownNames = brandNames
            .Concat(collectionNames)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => NormalizeEntityText(name))
            .Where(name => name.Length >= 4)
            .Where(name => !_genericCollectionWords.Contains(name))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        return knownNames.Any(name =>
            !allowedNames.Contains(name)
            && normalizedMessage.Contains(name, StringComparison.OrdinalIgnoreCase));
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

    private async Task<ChatResolution> BuildCompareResolutionAsync(string query, List<Watch> watches)
    {
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

        // For collection-level compares, load all models from both collections (up to 5 each,
        // 10 total) so the user can choose what to compare rather than seeing a single hardcoded
        // representative per side. Prestige sort within each collection by price descending.
        if (isCollectionLevelCompare)
        {
            var collectionIds = collections.Select(c => c.Id).ToList();
            var allModels = new List<Watch>();
            foreach (var collectionId in collectionIds)
            {
                var models = await _context.Watches
                    .Include(w => w.Brand)
                    .Include(w => w.Collection)
                    .AsNoTracking()
                    .Where(w => w.CollectionId == collectionId)
                    .OrderByDescending(w => w.CurrentPrice)
                    .Take(5)
                    .ToListAsync();
                allModels.AddRange(models);
            }

            var context = new List<string>
            {
                "Tourbillon resolved a collection-level comparison. Write a short character split between the two collections, then pick two specific models from the surfaced watches that best illustrate the contrast and naturally suggest comparing them. Do not use the phrase 'representative'. End with a short buying question."
            };
            foreach (var collection in collections)
                context.Add(BuildCollectionContext(collection));
            foreach (var brand in brands.Take(2))
                context.Add(BuildBrandContext(brand));
            foreach (var w in allModels)
                context.Add(BuildWatchContext(w));

            var allCards = allModels.Select(ToChatWatchCard).ToList();
            return new ChatResolution
            {
                UseAi = true,
                Query = query,
                Context = context,
                WatchCards = allCards,
                Actions = [],
                // AI suggests the pair in prose — suppress the auto-compare chip post-processing adds.
                SuppressCompareSuggestion = true,
                SessionState = new ChatSessionState
                {
                    CollectionIds = collectionIds,
                    BrandIds = brands.Select(b => b.Id).Distinct().ToList(),
                    WatchSlugs = allCards.Select(c => c.Slug).Where(s => !string.IsNullOrWhiteSpace(s)).ToList(),
                    FollowUpMode = "compare",
                    CanonicalQuery = BuildCanonicalEntityQuery(watches, query),
                }
            };
        }

        // Concrete compare (specific watch references resolved).
        var watchCards = watches.Select(ToChatWatchCard).ToList();
        var links = watches.Select(w => $"[{BuildWatchTitle(w)}](/watches/{w.Slug})");
        var concreteContext = new List<string>
        {
            "Tourbillon resolved a concrete comparison set. Compare guidance request: explain the main split in practical buying terms, stay concise, end with a complete sentence, and assume the compare view will open immediately with these exact watches preloaded."
        };
        foreach (var watch in watches)
            concreteContext.Add(BuildWatchContext(watch));

        return new ChatResolution
        {
            UseAi = true,
            Message = $"Tourbillon resolved this comparison set: {string.Join(", ", links)}. The compare view will open with these watches preloaded.",
            Query = query,
            Context = concreteContext,
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
        var descriptor = $"{string.Join(" ", collection.Styles)} {collection.Description} {representativeWatch.Description} {representativeWatch.Specs}".ToLowerInvariant();

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
            .Take(DiscoveryCardLimit)
            .ToList();

        if (distinctSlugs.Count == 0) return [];

        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .Where(w => distinctSlugs.Contains(w.Slug))
            .AsNoTracking()
            .ToListAsync();

        return distinctSlugs
            .Select(slug => watches.FirstOrDefault(w => string.Equals(w.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(watch => watch != null)
            .Select(watch => ToChatWatchCard(watch!))
            .ToList();
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
        Regex.IsMatch(query.Trim(), @"^(?:hi|hello|hey(?:\s+there)?|yo|hiya|sup|what'?s up|good morning|good afternoon|good evening)[!.]*$", RegexOptions.IgnoreCase);

    private static bool LooksLikeContextualFollowUp(string query) =>
        query.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length <= 10
        && Regex.IsMatch(query,
            @"\b(?:yes|yeah|yep|sure|ok|okay|please|those|these|them|that|this|first|second|third|fourth|fifth|more|details|tell me|show me|compare|go ahead|sounds good|do it)\b",
            RegexOptions.IgnoreCase);

    private static bool LooksLikeRecommendationRevision(
        string query,
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState? sessionState)
    {
        if (lastWatchCards.Count == 0 && string.IsNullOrWhiteSpace(sessionState?.DiscoveryQuery))
            return false;

        if (!string.Equals(sessionState?.FollowUpMode, "watch_cards", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(sessionState?.DiscoveryQuery))
            return false;

        if (IsExplicitCompareQuery(query) || IsAffirmativeFollowUp(query))
            return false;

        return Regex.IsMatch(
            query,
            @"\b(?:show me something else|show me another|what else|anything else|another option|different option|different direction|not what i meant|not really|not quite|don't like|do not like|dislike|hate|skip these|skip those|avoid these|avoid those|those are not|these are not|they are not|isn't right|aren't right|wrong direction|too sporty|too dressy|too expensive|too big|too small|more artistic|more art|less sporty|less dressy|more formal|more casual|make the list richer|richer list|separate the .* direction|split by intent|group(?:ed)? guidance|introduce the brands|introduce the collections|narrow to the best models|best models|final shortlist|final list|curated shortlist|curated list|strongest final shortlist)\b",
            RegexOptions.IgnoreCase);
    }

    private static bool LooksLikeShortlistContinuation(string query) =>
        Regex.IsMatch(
            query,
            @"\b(?:introduce the brands|introduce the collections|narrow to the best models|best models|final shortlist|final list|curated shortlist|curated list|final answer|mixed shortlist|which two are the clearest|art-led pick|dive-led pick|not just \w+ this time|compare the strongest)\b",
            RegexOptions.IgnoreCase);

    // Detects explicit "show me more / expand the list" intent, used to avoid re-echoing
    // the same watch cards when the user wants additional models rather than a continuation.
    private static bool LooksLikeExplicitMoreRequest(string query) =>
        Regex.IsMatch(
            query,
            @"\b(?:show me more|more models?|more result|more watches?|more options?|expand|see more|all models?|full list|other models?|what else is there|what other)\b",
            RegexOptions.IgnoreCase);

    // Detects refinement queries that contain only price/budget signals — no watch vocabulary.
    // Used to keep pure price follow-ups ("under 10k", "what about 20,000?") in the discovery
    // flow when the user is already mid-session, rather than routing them to the AI with no context.
    private static bool LooksLikePriceFollowUp(string query) =>
        Regex.IsMatch(query,
            @"\b(?:under|below|above|over|around|budget|price|cost|between|cheap|affordable|expensive|luxury)\b"
            + @"|\b\d[\d,]*\s*(?:k|000)?\b",
            RegexOptions.IgnoreCase);

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

        var normalizedCanonicalQuery = NormalizeEntityText(canonicalQuery);
        foreach (var collection in mentions.Collections.OrderByDescending(collection => collection.Name.Length))
        {
            var normalizedCollectionName = NormalizeEntityText(collection.Name);
            if (string.IsNullOrWhiteSpace(normalizedCollectionName)
                || normalizedCanonicalQuery.Contains(normalizedCollectionName, StringComparison.OrdinalIgnoreCase))
                continue;

            canonicalQuery = $"{canonicalQuery.Trim()} {collection.Name}".Trim();
            normalizedCanonicalQuery = NormalizeEntityText(canonicalQuery);
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
        var style = collection.Styles.Length == 0 ? "" : $" [Style: {string.Join("/", collection.Styles)}]";
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
        var prefix = !LooksLikeEditorialDescription(watch.Description)
            ? watch.Description!.Trim()
            : string.Join(" ", new[] { watch.Brand?.Name, watch.Collection?.Name }.Where(s => !string.IsNullOrWhiteSpace(s)));
        if (string.IsNullOrWhiteSpace(prefix))
            return watch.Name;

        return prefix.Contains(watch.Name, StringComparison.OrdinalIgnoreCase)
            ? prefix
            : $"{prefix} {watch.Name}".Trim();
    }

    private static bool LooksLikeEditorialDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
            return true;

        var trimmed = description.Trim();
        if (trimmed.Length > 80 || CountWords(trimmed) > 8)
            return true;

        if (Regex.IsMatch(trimmed, @"[.!?:;]"))
            return true;

        var firstWord = trimmed
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?
            .Trim(' ', ',', '.', '"', '\'');
        return !string.IsNullOrWhiteSpace(firstWord)
            && _editorialLeadWords.Contains(firstWord);
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
        if (normalized.StartsWith("es")) return "spanish";
        if (normalized.StartsWith("de")) return "german";
        if (normalized.StartsWith("it")) return "italian";
        if (normalized.StartsWith("pt")) return "portuguese";
        if (normalized.StartsWith("ko")) return "korean";
        return null;
    }

    private static bool LooksLikeVietnameseText(string query) =>
        Regex.IsMatch(query, @"[ăâêôơưđáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:xin chao|xin chào|dong ho|đồng hồ|lich su|lịch sử|thuong hieu|thương hiệu|bo suu tap|bộ sưu tập)\b", RegexOptions.IgnoreCase);

    private static bool LooksLikeFrenchText(string query) =>
        Regex.IsMatch(query, @"[àâçéèêëîïôûùüÿœæ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:bonjour|montre|histoire|heritage|maison|collection|parlez[- ]moi|raconte[- ]moi|suisse)\b", RegexOptions.IgnoreCase);

    /// Returns brand IDs that appear near a negation word in the message (within 12 preceding words).
    private static List<int> DetectBrandRejections(string message, EntityMentions mentions)
    {
        if (!mentions.Brands.Any()) return [];
        var rejected = new List<int>();
        foreach (var brand in mentions.Brands)
        {
            var idx = message.IndexOf(brand.Name, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) continue;
            var prefix = message[..idx];
            var window = string.Join(" ", prefix.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).TakeLast(12));
            if (Regex.IsMatch(window,
                @"\b(?:don'?t\s+like|not\s+interested\s+in|no\b|not\b|other\s+than|instead\s+of|avoid|hate|dislike|skip)\b",
                RegexOptions.IgnoreCase))
                rejected.Add(brand.Id);
        }
        return rejected;
    }

    private static List<string> DetectRejectedWatchSlugs(string message, List<ChatWatchCard> lastWatchCards)
    {
        if (lastWatchCards.Count == 0)
            return [];

        var explicitMatches = lastWatchCards
            .Where(card =>
                (!string.IsNullOrWhiteSpace(card.Name) && message.Contains(card.Name, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(card.CollectionName) && message.Contains(card.CollectionName, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrWhiteSpace(card.BrandName) && message.Contains(card.BrandName, StringComparison.OrdinalIgnoreCase)))
            .Select(card => card.Slug)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (explicitMatches.Count > 0)
            return explicitMatches;

        return Regex.IsMatch(
            message,
            @"\b(?:those|these|them|they|that|this|options?|watches?|models?)\b|\b(?:show me something else|show me another|what else|anything else|different option|different direction|don't like|do not like|not what i meant|those are not|these are not|they are not|too )\b",
            RegexOptions.IgnoreCase)
            ? lastWatchCards.Select(card => card.Slug).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
            : [];
    }

    private static string ExtractRecommendationCorrectionFocus(string query)
    {
        var cleaned = NormalizeCompoundWatchTerms(query);
        cleaned = Regex.Replace(cleaned, @"\b(?:those|these|them|they|that|this|are|is|were|was|not|isn't|aren't|don't|do not|doesn't|does not|too|more|less|really|quite|feel|feels|look|looks|seem|seems|show me|give me|i want|i need|something|else|another|different|direction|wrong|right|related|enough|what i meant|options?|ones?)\b", " ", RegexOptions.IgnoreCase);
        return Regex.Replace(cleaned, @"\s+", " ").Trim(' ', ',', '.', '?', '!');
    }

    private static string BuildRecommendationRevisionQuery(
        string originalMessage,
        string? baseQuery,
        string revisionFocus)
    {
        if (LooksLikePriceFollowUp(originalMessage) && !string.IsNullOrWhiteSpace(baseQuery))
            return $"{baseQuery} {originalMessage}".Trim();

        if (!string.IsNullOrWhiteSpace(baseQuery) && !string.IsNullOrWhiteSpace(revisionFocus))
        {
            var combined = $"{baseQuery} {revisionFocus}".Trim();
            return combined;
        }

        if (!string.IsNullOrWhiteSpace(revisionFocus) && CountWords(revisionFocus) >= 2)
            return revisionFocus;

        if (!string.IsNullOrWhiteSpace(baseQuery))
            return baseQuery.Trim();

        return originalMessage.Trim();
    }

    private static WatchFinderResult FilterRejectedWatchCandidates(
        WatchFinderResult result,
        IReadOnlyCollection<string> rejectedWatchSlugs)
    {
        if (rejectedWatchSlugs.Count == 0)
            return result;

        var combined = result.Watches
            .Concat(result.OtherCandidates)
            .Where(watch => !string.IsNullOrWhiteSpace(watch.Slug) && !rejectedWatchSlugs.Contains(watch.Slug, StringComparer.OrdinalIgnoreCase))
            .GroupBy(watch => watch.Slug, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

        var allowedIds = combined.Select(watch => watch.Id).ToHashSet();
        return new WatchFinderResult
        {
            Watches = combined.Take(WatchFinderService.TopMatchLimit).ToList(),
            OtherCandidates = combined.Skip(WatchFinderService.TopMatchLimit).ToList(),
            MatchDetails = result.MatchDetails
                .Where(pair => allowedIds.Contains(pair.Key))
                .ToDictionary(pair => pair.Key, pair => pair.Value),
            ParsedIntent = result.ParsedIntent,
            QueryIntent = result.QueryIntent,
            SearchPath = result.SearchPath,
        };
    }

    private async Task<List<string>> GetBrandNamesAsync(IEnumerable<int> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return [];
        return await _context.Brands
            .Where(b => idList.Contains(b.Id))
            .Select(b => b.Name)
            .ToListAsync();
    }

    /// Builds (and caches) a one-line-per-brand catalogue roster for context injection.
    private async Task<string> BuildCatalogueRosterContextAsync()
    {
        if (_catalogueRoster is not null) return _catalogueRoster;

        var brands = await _context.Brands.AsNoTracking().OrderBy(b => b.Name).ToListAsync();
        var collections = await _context.Collections.AsNoTracking().OrderBy(c => c.Name).ToListAsync();
        var colsByBrand = collections.GroupBy(c => c.BrandId).ToDictionary(g => g.Key, g => g.ToList());

        var lines = brands.Select(b =>
        {
            var cols = colsByBrand.GetValueOrDefault(b.Id, [])
                .Select(c => c.Styles.Length == 0 ? c.Name : $"{c.Name} ({string.Join("/", c.Styles)})")
                .ToList();
            return $"- {b.Name}: {(cols.Count > 0 ? string.Join(", ", cols) : "no collections listed")}";
        });

        _catalogueRoster = "Tourbillon catalogue — available brands and their collections:\n" + string.Join("\n", lines);
        return _catalogueRoster;
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

    private static string BuildCardContinuationFallbackMessage(
        List<Watch> watches,
        bool isCompareFollowUp,
        bool affirmative)
    {
        if (watches.Count == 0)
            return NoCloseMatchMessage;

        if (isCompareFollowUp && watches.Count >= 2)
        {
            var leftLink = $"[{BuildWatchTitle(watches[0])}](/watches/{watches[0].Slug})";
            var rightLink = $"[{BuildWatchTitle(watches[1])}](/watches/{watches[1].Slug})";
            return affirmative
                ? $"{leftLink} and {rightLink} remain the active compare set. Tourbillon can keep sharpening the practical split between them."
                : $"{leftLink} and {rightLink} are still the active compare anchors. Tourbillon can compare them further or narrow the brief from here.";
        }

        if (watches.Count == 1)
        {
            var watchLink = $"[{BuildWatchTitle(watches[0])}](/watches/{watches[0].Slug})";
            return affirmative
                ? $"{watchLink} is still the clearest active shortlist reference. Tourbillon can keep expanding on it or suggest a nearby alternative."
                : $"{watchLink} is still the active shortlist reference. Tourbillon can narrow the brief further or compare it with another watch.";
        }

        var firstLink = $"[{BuildWatchTitle(watches[0])}](/watches/{watches[0].Slug})";
        var secondLink = $"[{BuildWatchTitle(watches[1])}](/watches/{watches[1].Slug})";
        return affirmative
            ? $"{firstLink} and {secondLink} remain the strongest active shortlist anchors. Tourbillon can keep refining the shortlist from here."
            : $"{firstLink} and {secondLink} remain the clearest active shortlist anchors. Tourbillon can group them, compare them, or narrow the shortlist further.";
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
