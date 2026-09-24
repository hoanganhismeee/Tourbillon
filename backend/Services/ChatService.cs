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
using Microsoft.Extensions.Caching.Memory;
using backend.Infrastructure;

namespace backend.Services;

public interface IWatchFinderService
{
    Task<WatchFinderResult> FindWatchesAsync(string query);
    Task<WatchFinderResult> FindWatchesAsync(string query, IReadOnlyList<int> excludedBrandIds);
}

// Lets the concierge overlap the finder's model work with its own. Only WatchFinderService implements
// it, so a test double of IWatchFinderService simply never receives these hints.
public interface IConciergeSearchHints
{
    // Starts the LLM parse of a message before the concierge classifies it, so the two model calls
    // run side by side instead of back to back.
    void PrefetchIntent(string query);

    // Hands over the concierge's own classification of that message, so the finder's off-topic check
    // reuses the verdict instead of asking the same classifier the same question a second time.
    void ShareClassification(string query, IntentClassification classification);
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

    /// Which handler answered, and which retrieval stage produced the cards. Smart Search has
    /// exposed the equivalent on its own response all along; without the same on chat there is
    /// no way to tell whether a concierge reply came from SQL, from vector search or from
    /// cache, so no change to the concierge's routing can be measured.
    public string? RoutingPath { get; set; }
    public string? FinderPath { get; set; }

    /// The retrieval pool behind the cards, in rank order, when ChatSettings:ExposeCandidates is on.
    /// Scoring the concierge on the cards alone conflates two jobs — whether retrieval found the
    /// right watch and whether the shortlist picked it — and those are fixed in different places.
    /// Off in production: it is an evaluation hook, not part of the contract the frontend reads.
    public List<int>? CandidateWatchIds { get; set; }

    /// What the parse made of the brief, behind the same switch. A brief can fail because the
    /// parse missed a constraint or because retrieval missed the watch, and the cards alone do not
    /// say which; reading this offline is the difference between guessing and knowing.
    public string? ParsedIntent { get; set; }
}

public class ChatService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TourbillonContext _context;
    private readonly IRedisService _redis;
    private readonly IConfiguration _config;
    private readonly IWatchFinderService _watchFinderService;
    private readonly ILogger<ChatService> _logger;
    private readonly IIntentClassifier _classifier;
    private readonly IActionPlanner _planner;
    private readonly IStorageService _storage;
    private readonly IAiUsageQuotaService _quota;
    private readonly IMemoryCache _memoryCache;

    // Brand/collection rosters change rarely. Caching them for 5 minutes removes
    // two full-table scans per chat turn (entity resolution + catalogue roster build).
    private const string BrandsCacheKey = "chat:roster:brands";
    private const string CollectionsCacheKey = "chat:roster:collections";
    private static readonly TimeSpan RosterCacheTtl = TimeSpan.FromMinutes(5);

    // Set by ResolveWatchScopedAsync once /classify returns. Read by follow-up
    // routing branches that now trust the classifier instead of semantic regexes.
    // ChatService is scoped per request, so this is safe as an instance field.
    private IntentClassification? _lastClassification;

    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(1);
    private const int DiscoveryCardLimit = 10;
    // Advisor mode surfaces a tight, hand-picked set rather than a wide discovery row.
    private const int AdviceCardLimit = 3;

    // Response cache: a context-free first-turn message resolves to the same cards + prose every
    // time, so we cache the whole turn and skip the classify → search → chat → plan LLM chain.
    // Version-keyed so a single counter bump invalidates every entry on a catalogue change.
    private const string ResponseCacheVersionKey = ChatCacheKeys.ResponseVersion;
    private static readonly TimeSpan ResponseCacheTtl = TimeSpan.FromHours(12);

    // Mirrors the frontend EXAMPLE_PROMPTS (ChatPanel.tsx). Pre-warmed so the suggestions a user is
    // most likely to click return instantly. Keep in sync with the frontend list.
    //
    // Ordered, not filtered. The concierge handles spec briefs too — they route to the same
    // deterministic SQL the search bar uses — so those prompts stay. But the open-ended occasion
    // questions come first, because they are the ones a user would not think to type into a search
    // box, and the top chips are the ones that get clicked.
    internal static readonly string[] StarterPrompts =
    [
        "Something elegant for a formal dinner",
        "What should I wear to a summer wedding",
        "Where do I start with my first serious watch",
        "Sporty watches under $20,000",
        "Best diving watch from Rolex",
        "Compare the Aquanaut and the Overseas",
        "Tell me about Patek Philippe",
    ];

    // What a cached turn stores: the response served to the client plus the session state that the
    // live path would have persisted, so follow-up turns work identically after a cache hit.
    private sealed class CachedChatTurn
    {
        public ChatApiResponse Response { get; set; } = new();
        public ChatSessionState? SessionState { get; set; }
    }

    // Lazy-loaded catalogue roster — built once and reused for the service lifetime.
    private string? _catalogueRoster;
    // The language this turn answers in, resolved once from the message and the browser hint. The
    // fixed replies below read from it, so a French or Vietnamese visitor is not answered in English
    // when the backend, rather than the model, writes the reply.
    private string _replyLanguage = "english";
    private string UnsupportedQueryMessage => ChatMessages.UnsupportedQuery(_replyLanguage);
    private string NoCloseMatchMessage => ChatMessages.NoCloseMatch(_replyLanguage);
    private string ProcessingFallbackMessage => ChatMessages.ProcessingFallback(_replyLanguage);
    private string AdviceNoMatchMessage => ChatMessages.AdviceNoMatch(_replyLanguage);
    private string GreetingMessage => ChatMessages.Greeting(_replyLanguage);

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
        public List<string> SuggestedCompareSlugs { get; set; } = [];
        // Retrieval's own output before the card cut, for the evaluation hook above.
        public List<int> CandidateWatchIds { get; set; } = [];
        public string? ParsedIntentSummary { get; set; }
        // Brands and collections whose context this reply supplies beyond the cards. The draft
        // validator accepts them: a question about two brands has to be answerable in both names,
        // even when only one of them has cards on screen.
        public List<string> AllowedEntityNames { get; set; } = [];
        public string? ResponseLanguage { get; set; }
        public bool AllowWebEnrichment { get; set; }
        public string? WebQuery { get; set; }
        // "advisor" routes the AI wording layer into advice-led mode (lead with personal-fit
        // guidance, then a tight curated set). Null keeps the default concierge wording.
        public string? AiMode { get; set; }
        // How long the AI wording may run. "explain" is for brand and collection overviews and
        // histories; everything else (recommendations, advice, comparisons) is "short", because the
        // watch cards already carry the detail. The AI service turns this into a length rule.
        public string ReplyLength { get; set; } = "short";
        // Populated by each routing branch for structured tracing.
        public string RoutingPath { get; set; } = "unknown";
        // Populated when WatchFinderService is called; mirrors WatchFinderResult.SearchPath.
        public string? SearchPath { get; set; }
    }

    private sealed class NormalizedUserQuery
    {
        public string RawQuery { get; set; } = "";
        public string RepairedQuery { get; set; } = "";
        public List<string> RepairNotes { get; set; } = [];
    }

    private sealed class AiChatDraft
    {
        public string Message { get; set; } = "";
        public List<string> GroundedWatchSlugs { get; set; } = [];
        public List<string> GroundedBrandNames { get; set; } = [];
        public List<string> GroundedCollectionNames { get; set; } = [];
        // True when the AI draft failed validation twice and we fell back to deterministic text —
        // a degraded reply that must never be written into the response cache.
        public bool Fallback { get; set; }
    }

    private sealed class AiDraftValidation
    {
        public bool IsValid { get; set; }
        public string? FailureReason { get; set; }
    }

    private sealed class AllowedCatalogueContext
    {
        public List<string> WatchTitles { get; set; } = [];
        public List<string> WatchSlugs { get; set; } = [];
        public List<string> BrandNames { get; set; } = [];
        public List<string> CollectionNames { get; set; } = [];
    }

    // Intent class constants returned by the AI classifier — single source of truth for routing.
    private static class ChatIntent
    {
        public const string WatchCompare        = "watch_compare";
        public const string CollectionCompare   = "collection_compare";
        public const string BrandDecision       = "brand_decision";
        public const string AffirmativeFollowUp = "affirmative_followup";
        public const string ExpansionRequest    = "expansion_request";
        public const string RevisionRequest     = "revision_request";
        public const string ContextualFollowUp  = "contextual_followup";
        public const string BrandInfo           = "brand_info";
        public const string CollectionInfo      = "collection_info";
        public const string BrandHistory        = "brand_history";
        public const string AdviceRequest       = "advice_request";
        public const string Discovery           = "discovery";
        public const string NonWatch            = "non_watch";
        public const string Unclear             = "unclear";
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
        ILogger<ChatService> logger,
        IIntentClassifier classifier,
        IActionPlanner planner,
        IStorageService storageService,
        IMemoryCache memoryCache,
        IAiUsageQuotaService? quotaService = null)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
        _redis = redis;
        _config = config;
        _watchFinderService = watchFinderService;
        _logger = logger;
        _classifier = classifier;
        _planner = planner;
        _storage = storageService;
        _memoryCache = memoryCache;
        _quota = quotaService ?? new AiUsageQuotaService(redis);
    }

    private Task<List<Brand>> GetCachedBrandsAsync() =>
        _memoryCache.GetOrCreateAsync(BrandsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = RosterCacheTtl;
            return await _context.Brands.AsNoTracking().ToListAsync();
        })!;

    private Task<List<Collection>> GetCachedCollectionsAsync() =>
        _memoryCache.GetOrCreateAsync(CollectionsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = RosterCacheTtl;
            return await _context.Collections.AsNoTracking().ToListAsync();
        })!;

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
        string? preferredLanguage = null,
        bool isAdmin = false,
        bool bypassResponseCache = false,
        CancellationToken cancellationToken = default)
    {
        _replyLanguage = ResolveResponseLanguage(message, preferredLanguage);
        var disableLimit = _config.GetValue<bool>("ChatSettings:DisableLimitInDev");
        var dailyLimit = _config.GetValue<int>("ChatSettings:DailyLimit", 5);
        var quotaSubject = userId ?? ipAddress ?? "anon";
        AiQuotaStatus? quotaStatus = disableLimit || isAdmin
            ? null
            : await _quota.CheckAsync("chat", quotaSubject, dailyLimit, disabled: false, isAdmin: false);
        if (quotaStatus?.RateLimited == true && !CanBypassChatQuotaBeforeRouting(message))
        {
            _logger.LogInformation(
                "Chat quota hit userId={UserId} used={Used} limit={Limit}",
                userId ?? "anonymous", quotaStatus.DailyUsed, quotaStatus.DailyLimit);
            return new ChatApiResponse
            {
                RateLimited = true,
                DailyUsed = quotaStatus.DailyUsed,
                DailyLimit = quotaStatus.DailyLimit,
                Message = ChatMessages.DailyQuota(_replyLanguage, quotaStatus.DailyLimit)
            };
        }

        var routingSw = System.Diagnostics.Stopwatch.StartNew();
        var sessionHistory = await GetSessionHistoryAsync(sessionId);
        var lastWatchCards = await GetLastWatchCardsAsync(sessionId);
        var compareScope = await GetCompareScopeAsync(sessionId);
        var sessionState = await GetSessionStateAsync(sessionId);

        // A turn is cacheable only when nothing personal or contextual shapes the answer: a fresh
        // first message, no behavioural personalization, and no carried-over session scope. Such a
        // turn is a pure function of (query, language, catalogue) — safe to share across users.
        // The reply's language keys the cache, not the raw browser tag: "en-US" and "en-AU" get the same
        // English answer, and the starter warm-up, which sends no tag, has to land on the key a real click
        // reads. Keyed by the raw tag, no visitor ever hit a warmed starter.
        var langKey = _replyLanguage;
        var responseCacheable = sessionHistory.Count == 0
            && string.IsNullOrWhiteSpace(behaviorSummary)
            && (sessionState == null
                || (sessionState.ExcludedBrandIds.Count == 0 && string.IsNullOrEmpty(sessionState.FollowUpMode)));

        if (responseCacheable && !bypassResponseCache)
        {
            var hit = await TryServeCachedTurnAsync(
                sessionId, message, langKey, sessionHistory,
                quotaSubject, dailyLimit, disableLimit, isAdmin, cancellationToken);
            if (hit != null)
            {
                _logger.LogInformation("Chat response cache HIT session={SessionId} elapsed={ElapsedMs}ms",
                    sessionId, routingSw.ElapsedMilliseconds);
                return hit;
            }
        }

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

        if (resolution.UseAi && quotaStatus?.RateLimited == true)
        {
            _logger.LogInformation(
                "Chat quota hit userId={UserId} used={Used} limit={Limit}",
                userId ?? "anonymous", quotaStatus.DailyUsed, quotaStatus.DailyLimit);
            return new ChatApiResponse
            {
                RateLimited = true,
                DailyUsed = quotaStatus.DailyUsed,
                DailyLimit = quotaStatus.DailyLimit,
                Message = ChatMessages.DailyQuota(_replyLanguage, quotaStatus.DailyLimit)
            };
        }
        if (resolution.UseAi && !disableLimit && !isAdmin)
        {
            // If the client disconnected before we reach the AI call, skip the charge entirely.
            cancellationToken.ThrowIfCancellationRequested();
            quotaStatus = await _quota.ChargeAsync("chat", quotaSubject, dailyLimit, disabled: false, isAdmin: false);
            if (quotaStatus.RateLimited)
            {
                _logger.LogInformation(
                    "Chat quota hit userId={UserId} used={Used} limit={Limit}",
                    userId ?? "anonymous", quotaStatus.DailyUsed, quotaStatus.DailyLimit);
                return new ChatApiResponse
                {
                    RateLimited = true,
                    DailyUsed = quotaStatus.DailyUsed,
                    DailyLimit = quotaStatus.DailyLimit,
                    Message = ChatMessages.DailyQuota(_replyLanguage, quotaStatus.DailyLimit)
                };
            }
        }

        // Planner runs in parallel with the wording draft when we have watch cards. Covers the
        // common path: discovery / compare / info responses where chip variety matters. When
        // there are no cards (greeting, refusal, cursor command) the planner has nothing to
        // ground slugs against, so we skip it.
        var plannerTask = (resolution.UseAi && watchCards.Count > 0)
            ? PlanSuggestedActionsAsync(resolution, message, watchCards, actions, sessionState)
            : Task.FromResult<IReadOnlyList<PlannedAction>>(Array.Empty<PlannedAction>());

        var aiDraftFallback = false;
        if (resolution.UseAi)
        {
            if (!string.IsNullOrWhiteSpace(behaviorSummary))
                resolution.Context.Insert(0, $"[User context] {behaviorSummary}");

            if (resolution.Context.Count == 0)
                resolution.Context.Add("Stay within Tourbillon's catalogue and watch expertise. No relevant catalogue records were resolved.");

            var responseLanguage = resolution.ResponseLanguage ?? ResolveResponseLanguage(message, preferredLanguage);
            var aiDraftTask = ComposeValidatedAiDraftAsync(
                HistoryForResolution(history, resolution),
                resolution.Query,
                resolution.Context,
                resolution,
                responseLanguage,
                resolution.AllowWebEnrichment,
                resolution.WebQuery,
                cancellationToken);

            // Await both the wording draft and the planner together — planner is best-effort so
            // its result is either a usable list or an empty fallback; it never throws out here.
            await Task.WhenAll(aiDraftTask, plannerTask);

            var aiDraft = await aiDraftTask;
            aiDraftFallback = aiDraft.Fallback;
            var aiResult = aiDraft.Message;
            // Skip unsupported-entity rejection for referenced_watch — the AI naturally
            // weaves in related entities from conversation history, which is correct behaviour
            // for a single-watch deep-dive. Rejecting it produces a one-line stub.
            var keepDeterministic = ShouldKeepDeterministicResolutionMessage(aiResult, resolution)
                || (!string.Equals(resolution.RoutingPath, "referenced_watch", StringComparison.Ordinal)
                    && await MentionsUnsupportedResolvedEntitiesAsync(aiResult, resolution));
            // Only use the deterministic message when it's actually set — an empty deterministic
            // message (e.g. collection compare where AI writes the intro) should still use aiResult.
            aiMessage = keepDeterministic && !string.IsNullOrWhiteSpace(resolution.Message)
                ? resolution.Message
                : aiResult;
            aiMessage = MergeBrandIntoCollectionLink(
                UnwrapNestedMarkdownLinks(LinkCatalogueNames(aiMessage, resolution.WatchCards, resolution.Context)));
            if (watchCards.Count == 0)
                watchCards = await ExtractWatchCardsAsync(aiMessage, actions);
        }

        // Drain the planner task (no-op fallback if UseAi is false / no cards / planner errored).
        var plannedActions = plannerTask.IsCompletedSuccessfully
            ? plannerTask.Result
            : await plannerTask;

        // Append 1–2 contextual follow-up suggestion chips grounded in the resolved watch cards.
        // Planner picks chips first when it returned usable results; otherwise the deterministic
        // rule tree below runs unchanged so the fallback path always produces chips.
        var suggestions = BuildSuggestionActions(
            watchCards,
            actions,
            resolution.SuggestedCompareSlugs,
            resolution.SuppressCompareSuggestion,
            plannedActions);
        if (suggestions.Count > 0)
            actions = [..actions, ..suggestions];

        sessionHistory.Add(new ChatMessage { Role = "user", Content = message });
       sessionHistory.Add(new ChatMessage { Role = "assistant", Content = aiMessage });
        await SaveSessionHistoryAsync(sessionId, sessionHistory);
        await SaveLastWatchCardsAsync(sessionId, watchCards);
        await SaveCompareScopeAsync(sessionId, await BuildCompareScopeAsync(actions));
        var nextSessionState = resolution.SessionState ?? BuildFallbackSessionState(watchCards);
        if (string.Equals(nextSessionState.FollowUpMode, "watch_cards", StringComparison.OrdinalIgnoreCase)
            && ClassifierMatchesAny(ChatIntent.ContextualFollowUp, ChatIntent.RevisionRequest, ChatIntent.WatchCompare))
        {
            nextSessionState = PreserveBroaderWatchCardSessionState(sessionState, nextSessionState);
        }
        await SaveSessionStateAsync(sessionId, nextSessionState);

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

        var apiResponse = new ChatApiResponse
        {
            Message = aiMessage,
            WatchCards = watchCards,
            Actions = actions,
            DailyUsed = disableLimit || isAdmin ? null : quotaStatus?.DailyUsed,
            DailyLimit = disableLimit || isAdmin ? null : dailyLimit,
            RoutingPath = resolution.RoutingPath,
            FinderPath = resolution.SearchPath,
            CandidateWatchIds = _config.GetValue<bool>("ChatSettings:ExposeCandidates")
                && resolution.CandidateWatchIds.Count > 0
                ? resolution.CandidateWatchIds
                : null,
            ParsedIntent = _config.GetValue<bool>("ChatSettings:ExposeCandidates")
                ? resolution.ParsedIntentSummary
                : null,
        };

        // Store a context-free turn for reuse. Skip degraded replies (AI fallback / canned error)
        // and card-less answers (greetings, refusals) — only genuine, grounded results are cached.
        if (responseCacheable && watchCards.Count > 0 && !aiDraftFallback && !IsCannedMessage(aiMessage))
            await StoreCachedTurnAsync(message, langKey, apiResponse, nextSessionState);

        return apiResponse;
    }

    private bool IsCannedMessage(string message) =>
        message == UnsupportedQueryMessage || message == NoCloseMatchMessage
        || message == ProcessingFallbackMessage || message == GreetingMessage;

    public async Task ClearSessionAsync(string sessionId) =>
        await _redis.RemoveHashAsync($"chat:session:{sessionId}");

    // ── Response cache ──────────────────────────────────────────────────────────────────────

    // Serves a previously-cached context-free turn: charges quota (so cached turns still count),
    // replays the session persistence the live path would have done, then returns the response.
    // Returns null on a miss / unusable entry so the caller falls through to the live pipeline.
    private async Task<ChatApiResponse?> TryServeCachedTurnAsync(
        string sessionId,
        string message,
        string langKey,
        List<ChatMessage> sessionHistory,
        string quotaSubject,
        int dailyLimit,
        bool disableLimit,
        bool isAdmin,
        CancellationToken cancellationToken)
    {
        var cacheKey = await BuildResponseCacheKeyAsync(message, langKey);
        var json = await _redis.GetStringAsync(cacheKey);
        if (string.IsNullOrEmpty(json))
            return null;

        CachedChatTurn? cached;
        try { cached = JsonSerializer.Deserialize<CachedChatTurn>(json, _jsonOptions); }
        catch (JsonException) { return null; }
        if (cached?.Response == null || cached.Response.WatchCards.Count == 0)
            return null;

        // Cached turns still count toward the daily limit; the live path charges here too.
        if (!disableLimit && !isAdmin)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var charge = await _quota.ChargeAsync("chat", quotaSubject, dailyLimit, disabled: false, isAdmin: false);
            if (charge.RateLimited)
                return new ChatApiResponse
                {
                    RateLimited = true,
                    DailyUsed = charge.DailyUsed,
                    DailyLimit = charge.DailyLimit,
                    Message = ChatMessages.DailyQuota(_replyLanguage, charge.DailyLimit),
                };
            cached.Response.DailyUsed = charge.DailyUsed;
            cached.Response.DailyLimit = dailyLimit;
        }
        else
        {
            cached.Response.DailyUsed = null;
            cached.Response.DailyLimit = null;
        }

        // Replay the persistence so follow-up turns share the live path's grounding.
        sessionHistory.Add(new ChatMessage { Role = "user", Content = message });
        sessionHistory.Add(new ChatMessage { Role = "assistant", Content = cached.Response.Message });
        await SaveSessionHistoryAsync(sessionId, sessionHistory);
        await SaveLastWatchCardsAsync(sessionId, cached.Response.WatchCards);
        await SaveCompareScopeAsync(sessionId, await BuildCompareScopeAsync(cached.Response.Actions));
        if (cached.SessionState != null)
            await SaveSessionStateAsync(sessionId, cached.SessionState);

        return cached.Response;
    }

    private async Task StoreCachedTurnAsync(string message, string langKey, ChatApiResponse response, ChatSessionState? sessionState)
    {
        try
        {
            // Strip user-specific quota fields — they are re-stamped on every hit.
            var stored = new CachedChatTurn
            {
                Response = new ChatApiResponse
                {
                    Message = response.Message,
                    WatchCards = response.WatchCards,
                    Actions = response.Actions,
                },
                SessionState = sessionState,
            };
            var cacheKey = await BuildResponseCacheKeyAsync(message, langKey);
            // A starter answer stays until the catalogue changes, which moves the key's version on; any
            // other turn expires, so one-off questions do not pile up.
            var expiry = IsStarterPrompt(message) ? (TimeSpan?)null : ResponseCacheTtl;
            await _redis.SetStringAsync(cacheKey, JsonSerializer.Serialize(stored, _jsonOptions), expiry);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat response cache store failed");
        }
    }

    private async Task<string> BuildResponseCacheKeyAsync(string query, string langKey)
    {
        var version = await _redis.GetCounterAsync(ResponseCacheVersionKey) ?? 0;
        return ResponseCacheKey(version, langKey, query);
    }

    internal static string ResponseCacheKey(long version, string langKey, string query) =>
        $"chat:resp:{version}:{langKey}:{NormalizeCacheQuery(query)}";

    internal static bool IsStarterPrompt(string message) =>
        StarterPrompts.Any(prompt => NormalizeCacheQuery(prompt) == NormalizeCacheQuery(message));

    private static string NormalizeCacheQuery(string query)
    {
        var normalized = query.Trim().ToLowerInvariant();
        normalized = Regex.Replace(normalized, @"[^\w\s]", "");
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized.Trim();
    }

    // Computes and caches any starter answer that is missing. A cached starter is left alone: it has no
    // expiry, and only a catalogue change (a new key version) makes it missing again. Runs on startup and
    // after a catalogue change. isAdmin bypasses the quota; a throwaway session keeps it out of any real
    // conversation.
    public async Task WarmStartersAsync()
    {
        var warmed = 0;
        foreach (var prompt in StarterPrompts)
        {
            var cacheKey = await BuildResponseCacheKeyAsync(prompt, ResolveResponseLanguage(prompt, null));
            if (await _redis.GetStringAsync(cacheKey) != null)
                continue;

            warmed++;
            var warmSession = $"__warm__:{Guid.NewGuid():N}";
            try
            {
                await HandleMessageAsync(
                    warmSession, prompt, userId: null, ipAddress: "warmup",
                    behaviorSummary: null, preferredLanguage: null, isAdmin: true, bypassResponseCache: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Chat starter warm failed prompt={Prompt}", prompt);
            }
            finally
            {
                await ClearSessionAsync(warmSession);
            }
        }
        _logger.LogInformation("Chat starter cache warmed {Warmed} of {Count} prompts", warmed, StarterPrompts.Length);
    }

    // Bumps the cache version (orphaning every existing entry) then re-warms the starters. Enqueued
    // after a catalogue mutation so cached prices and cards never go stale.
    public async Task InvalidateAndRewarmStartersAsync()
    {
        await _redis.IncrementAsync(ResponseCacheVersionKey);
        // Same switch as the scheduled warm-up: with it off (local dev), a catalogue edit still
        // orphans stale answers but does not spend seven paid concierge turns re-warming them.
        if (_config.GetValue("ChatSettings:WarmStarters", true))
            await WarmStartersAsync();
    }

    private static bool CanBypassChatQuotaBeforeRouting(string message)
    {
        var trimmed = message.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return true;

        return IsAbusiveQuery(trimmed)
            || IsObviouslyOffTopicQuery(trimmed)
            || Regex.IsMatch(trimmed, @"^\s*(?:yo|hey|hi|hello)\b[\s,!.?]*$", RegexOptions.IgnoreCase)
            || Regex.IsMatch(trimmed, @"\b(?:change|set|switch)\s+(?:the\s+)?cursor\b", RegexOptions.IgnoreCase);
    }

    private async Task<ChatResolution> ResolveMessageAsync(
        string message,
        List<ChatWatchCard> lastWatchCards,
        ChatCompareScope? compareScope,
        ChatSessionState? sessionState)
    {
        var normalizedQuery = NormalizeUserQuery(message);
        var repairedMessage = normalizedQuery.RepairedQuery;

        // Fast-path checks that need no entity resolution — always safe to return early.
        if (IsAbusiveQuery(repairedMessage))
            return new ChatResolution
            {
                Message = ChatMessages.WatchesOnly(_replyLanguage),
                RoutingPath = "abusive"
            };

        // Deterministic off-topic guard: catches clear programming / translation queries before
        // entity resolution assigns spurious watch-domain signals to them.
        if (IsObviouslyOffTopicQuery(repairedMessage))
            return new ChatResolution { Message = UnsupportedQueryMessage, RoutingPath = "non_watch" };

        var cursorResolution = TryResolveCursorCommand(repairedMessage);
        if (cursorResolution != null)
        {
            cursorResolution.RoutingPath = "cursor";
            return cursorResolution;
        }

        // Entity resolution — required for rejection detection and all routing below.
        var mentions = await ResolveEntityMentionsAsync(repairedMessage);
        var canonicalMessage = CanonicalizeQueryForRouting(repairedMessage, mentions);
        var referencedWatches = await TryResolveReferencedWatchesAsync(repairedMessage, lastWatchCards);

        // Detect brands the user has rejected in this turn and accumulate with prior session rejections.
        var newlyRejected = DetectBrandRejections(canonicalMessage, mentions);
        var excludedBrandIds = (sessionState?.ExcludedBrandIds ?? [])
            .Union(newlyRejected).Distinct().ToList();

        var resolution = await ResolveWatchScopedAsync(
            repairedMessage, canonicalMessage, mentions, referencedWatches,
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
            if (compareWatches.Count < 2 && sessionState?.WatchSlugs.Count > 0)
                compareWatches = await TryResolveSessionShortlistCompareWatchesAsync(canonicalMessage, sessionState, lastWatchCards, excludedBrandIds);
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

        // The finder's LLM parse does not depend on the intent, so it starts now and runs beside the
        // classifier; a discovery or advice turn then finds it finished instead of paying for both in
        // sequence. A turn that never reaches the finder leaves one small parse call unused.
        var searchHints = _watchFinderService as IConciergeSearchHints;
        if (_config.GetValue("ChatSettings:PrefetchParse", true))
            searchHints?.PrefetchIntent(canonicalMessage);

        // AI intent classifier — single LLM call determines routing for all fuzzy cases.
        // Returns "unclear" on failure, which falls through to existing regex routing.
        var classification = await _classifier.ClassifyAsync(
            canonicalMessage,
            mentions.Brands.Select(b => b.Name).ToList(),
            mentions.Collections.Select(c => c.Name).ToList(),
            sessionState?.FollowUpMode ?? "",
            lastWatchCards.Count,
            sessionState?.BrandIds ?? []);
        searchHints?.ShareClassification(canonicalMessage, classification);

        // Cache the classification so downstream follow-up routing can reuse it.
        _lastClassification = classification;

        _logger.LogInformation(
            "Chat classify intent={Intent} confidence={Confidence:F2}",
            classification.Intent, classification.Confidence);

        if (classification.Intent != ChatIntent.Unclear && classification.Confidence >= 0.6)
        {
            var dispatched = await DispatchByIntentAsync(
                classification.Intent, message, canonicalMessage, mentions,
                sessionState, lastWatchCards, compareScope, excludedBrandIds);
            if (dispatched != null)
            {
                dispatched.RoutingPath = $"classifier_{classification.Intent}";
                return dispatched;
            }
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

        // Price-only and style-only follow-ups like "under 10k" or "something dressier" lack
        // watch keywords but are clearly watch-scoped when the user is already mid-session.
        var hasSessionContext = sessionState?.WatchSlugs.Count > 0 || sessionState?.ExcludedBrandIds.Count > 0;
        var hasWatchScope = mentions.HasAny
            || referencedWatches.Count > 0
            || WatchFinderService.HasWatchDomainSignal(canonicalMessage)
            || (sessionState?.WatchSlugs.Count > 0
                && ClassifierMatchesAny(ChatIntent.ContextualFollowUp, ChatIntent.AffirmativeFollowUp))
            || (hasSessionContext && LooksLikePriceFollowUp(canonicalMessage))
            || (hasSessionContext && LooksLikeStyleFollowUp(canonicalMessage));

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

        // Two-brand decision queries ("Vacheron and A. Lange, which should I choose?") get a
        // dedicated brand-compare path so they never fall into WatchFinder discovery and produce
        // garbled deterministic messages.
        if (mentions.Brands.Count >= 2 && LooksLikeBrandDecisionRequest(canonicalMessage))
        {
            var r = await BuildBrandDecisionResolutionAsync(canonicalMessage, mentions);
            r.RoutingPath = "brand_compare";
            return r;
        }

        var skipDirectEntityResolution = ClassifierMatchesAny(
            ChatIntent.RevisionRequest,
            ChatIntent.ContextualFollowUp,
            ChatIntent.WatchCompare);
        if (!skipDirectEntityResolution)
        {
            var directEntityResolution = await TryResolveDirectEntityResolutionAsync(
                canonicalMessage,
                mentions,
                lastWatchCards,
                sessionState,
                excludedBrandIds);
            if (directEntityResolution != null)
            {
                directEntityResolution.RoutingPath = "entity_direct";
                return directEntityResolution;
            }
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

        // No catalogue match — hardcoded refusal as the genuine last resort. The graceful-degrade
        // widening pass in WatchFinder already gives the AI a chance to handle over-constrained
        // discovery queries before we land here.
        return new ChatResolution
        {
            Message = NoCloseMatchMessage,
            RoutingPath = "no_close_match"
        };
    }

    private async Task<AiChatDraft> ComposeValidatedAiDraftAsync(
        List<ChatHistoryEntry> history,
        string query,
        List<string> context,
        ChatResolution resolution,
        string? responseLanguage = null,
        bool allowWebEnrichment = false,
        string? webQuery = null,
        CancellationToken cancellationToken = default)
    {
        var aiDraft = await CallAiServiceAsync(
            history,
            query,
            context,
            responseLanguage,
            allowWebEnrichment,
            webQuery,
            resolution.AiMode,
            resolution.ReplyLength,
            cancellationToken);

        var validation = await ValidateAiDraftAsync(aiDraft, resolution);
        if (validation.IsValid)
            return aiDraft;

        var retryContext = BuildAiRewriteContext(validation.FailureReason ?? "left the allowed catalogue scope", resolution);
        retryContext.AddRange(context);

        _logger.LogInformation(
            "Chat ai draft retry path={RoutingPath} reason={Reason}",
            resolution.RoutingPath,
            validation.FailureReason ?? "unknown");

        var correctedDraft = await CallAiServiceAsync(
            history,
            query,
            retryContext,
            responseLanguage,
            allowWebEnrichment,
            webQuery,
            resolution.AiMode,
            resolution.ReplyLength,
            cancellationToken);

        var correctedValidation = await ValidateAiDraftAsync(correctedDraft, resolution);
        if (correctedValidation.IsValid)
            return correctedDraft;

        var fallbackMessage = BuildDeterministicAiFallbackMessage(resolution);
        _logger.LogWarning(
            "Chat ai draft fallback path={RoutingPath} firstReason={FirstReason} secondReason={SecondReason}",
            resolution.RoutingPath,
            validation.FailureReason ?? "unknown",
            correctedValidation.FailureReason ?? "unknown");

        return new AiChatDraft { Message = fallbackMessage, Fallback = true };
    }

    private async Task<AiChatDraft> CallAiServiceAsync(
        List<ChatHistoryEntry> history,
        string query,
        List<string> context,
        string? responseLanguage = null,
        bool allowWebEnrichment = false,
        string? webQuery = null,
        string? mode = null,
        string replyLength = "short",
        CancellationToken cancellationToken = default)
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
                mode,
                replyLength,
            };
            var resp = await StageTimings.TimeAsync("chat", () => httpClient.PostAsJsonAsync("/chat", payload, cancellationToken));
            chatSw.Stop();

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Chat ai-service /chat returned {Status} after {ElapsedMs}ms",
                    (int)resp.StatusCode, chatSw.ElapsedMilliseconds);
                return new AiChatDraft { Message = ProcessingFallbackMessage };
            }

            _logger.LogInformation("Chat ai-service /chat {ElapsedMs}ms", chatSw.ElapsedMilliseconds);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            var message = json.TryGetProperty("message", out var messageEl) ? messageEl.GetString() ?? "" : "";
            return new AiChatDraft
            {
                Message = string.IsNullOrWhiteSpace(message) ? NoCloseMatchMessage : message,
                GroundedWatchSlugs = ReadStringArray(json, "groundedWatchSlugs"),
                GroundedBrandNames = ReadStringArray(json, "groundedBrandNames"),
                GroundedCollectionNames = ReadStringArray(json, "groundedCollectionNames"),
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat ai-service call threw before producing a response");
            return new AiChatDraft { Message = ProcessingFallbackMessage };
        }
    }

    private async Task<AiDraftValidation> ValidateAiDraftAsync(AiChatDraft draft, ChatResolution resolution)
    {
        if (string.IsNullOrWhiteSpace(draft.Message))
            return new AiDraftValidation { FailureReason = "returned an empty message" };

        if (IsGenericAiFallbackMessage(draft.Message))
            return new AiDraftValidation { FailureReason = "fell back to a generic refusal instead of using the supplied catalogue context" };

        if (resolution.WatchCards.Count == 0)
            return new AiDraftValidation { IsValid = true };

        var allowedContext = BuildAllowedCatalogueContext(resolution);
        if (draft.GroundedWatchSlugs.Any(slug => !allowedContext.WatchSlugs.Contains(slug, StringComparer.OrdinalIgnoreCase)))
            return new AiDraftValidation { FailureReason = "grounded itself to watches outside the allowed shortlist" };

        if (draft.GroundedBrandNames.Any(name => !allowedContext.BrandNames.Contains(name, StringComparer.OrdinalIgnoreCase)))
            return new AiDraftValidation { FailureReason = "grounded itself to brands outside the allowed shortlist" };

        if (draft.GroundedCollectionNames.Any(name => !allowedContext.CollectionNames.Contains(name, StringComparer.OrdinalIgnoreCase)))
            return new AiDraftValidation { FailureReason = "grounded itself to collections outside the allowed shortlist" };

        if (!string.Equals(resolution.RoutingPath, "referenced_watch", StringComparison.Ordinal)
            && await MentionsUnsupportedResolvedEntitiesAsync(draft.Message, resolution))
        {
            return new AiDraftValidation { FailureReason = "mentioned catalogue entities outside the allowed shortlist" };
        }

        var claim = UnsupportedSpecClaim(draft.Message, resolution.Context);
        if (claim != null)
            return new AiDraftValidation { FailureReason = $"claimed \"{claim}\", which the supplied specs do not support" };

        return new AiDraftValidation { IsValid = true };
    }

    private static AllowedCatalogueContext BuildAllowedCatalogueContext(ChatResolution resolution)
    {
        var allowed = new AllowedCatalogueContext
        {
            WatchTitles = resolution.WatchCards
                .Select(BuildWatchCardTitle)
                .Where(title => !string.IsNullOrWhiteSpace(title))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            WatchSlugs = resolution.WatchCards
                .Select(card => card.Slug)
                .Where(slug => !string.IsNullOrWhiteSpace(slug))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            BrandNames = resolution.WatchCards
                .Select(card => card.BrandName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            CollectionNames = resolution.WatchCards
                .Select(card => card.CollectionName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
        };

        foreach (var item in resolution.Context)
        {
            var watchMatch = Regex.Match(item, "Watch \"([^\"]+)\" \\(Slug: ([\\w-]+)\\)");
            if (watchMatch.Success)
            {
                if (!allowed.WatchTitles.Contains(watchMatch.Groups[1].Value, StringComparer.OrdinalIgnoreCase))
                    allowed.WatchTitles.Add(watchMatch.Groups[1].Value);
                if (!allowed.WatchSlugs.Contains(watchMatch.Groups[2].Value, StringComparer.OrdinalIgnoreCase))
                    allowed.WatchSlugs.Add(watchMatch.Groups[2].Value);
            }

            var brandMatch = Regex.Match(item, "Brand \"([^\"]+)\" \\(Slug: [\\w-]+\\)");
            if (brandMatch.Success && !allowed.BrandNames.Contains(brandMatch.Groups[1].Value, StringComparer.OrdinalIgnoreCase))
                allowed.BrandNames.Add(brandMatch.Groups[1].Value);

            var collectionMatch = Regex.Match(item, "Collection \"([^\"]+)\" \\(Slug: [\\w-]+\\)");
            if (collectionMatch.Success && !allowed.CollectionNames.Contains(collectionMatch.Groups[1].Value, StringComparer.OrdinalIgnoreCase))
                allowed.CollectionNames.Add(collectionMatch.Groups[1].Value);
        }

        return allowed;
    }

    private static List<string> BuildAiRewriteContext(string failureReason, ChatResolution resolution)
    {
        var allowed = BuildAllowedCatalogueContext(resolution);
        var context = new List<string>
        {
            $"Rewrite correction: the previous draft was rejected because it {failureReason}. Rewrite the reply from the supplied Tourbillon catalogue context only.",
            "Grounding rule: mention only watches, brands, and collections that appear in the supplied context. Do not introduce substitutes, adjacent icons, or famous references that are not explicitly present."
        };

        if (allowed.WatchTitles.Count > 0)
            context.Add($"Allowed watches: {string.Join(" | ", allowed.WatchTitles.Take(8))}.");
        if (allowed.BrandNames.Count > 0)
            context.Add($"Allowed brands: {string.Join(", ", allowed.BrandNames.Take(6))}.");
        if (allowed.CollectionNames.Count > 0)
            context.Add($"Allowed collections: {string.Join(", ", allowed.CollectionNames.Take(6))}.");
        if (resolution.Actions.Any(action => string.Equals(action.Type, "compare", StringComparison.OrdinalIgnoreCase)))
            context.Add("Compare handling: the compare action is already prepared client-side, so keep the prose focused on the supplied pair instead of inventing more options.");

        return context;
    }

    private string BuildDeterministicAiFallbackMessage(ChatResolution resolution)
    {
        if (!string.IsNullOrWhiteSpace(resolution.Message) && !IsGenericAiFallbackMessage(resolution.Message))
            return resolution.Message;

        if (resolution.WatchCards.Count == 0)
            return ProcessingFallbackMessage;

        var compareCards = resolution.Actions
            .Where(action => string.Equals(action.Type, "compare", StringComparison.OrdinalIgnoreCase))
            .SelectMany(action => action.Slugs ?? [])
            .Select(slug => resolution.WatchCards.FirstOrDefault(card => string.Equals(card.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(card => card != null)
            .Cast<ChatWatchCard>()
            .DistinctBy(card => card.Slug)
            .Take(2)
            .ToList();
        if (compareCards.Count >= 2)
        {
            var leftLink = $"[{BuildWatchCardTitle(compareCards[0])}](/watches/{compareCards[0].Slug})";
            var rightLink = $"[{BuildWatchCardTitle(compareCards[1])}](/watches/{compareCards[1].Slug})";
            return $"Tourbillon resolved this comparison set: {leftLink} and {rightLink}. The compare view will open with these watches preloaded.";
        }

        var first = resolution.WatchCards[0];
        var firstLink = $"[{BuildWatchCardTitle(first)}](/watches/{first.Slug})";
        if (resolution.WatchCards.Count == 1)
        {
            var brandLink = !string.IsNullOrWhiteSpace(first.BrandSlug)
                ? $"[{first.BrandName}](/brands/{first.BrandSlug})"
                : first.BrandName ?? "its brand";
            return $"{firstLink} from {brandLink} is the clearest catalogue match Tourbillon has in this context. If you want, ask about size, material, or a nearby alternative.";
        }

        var second = resolution.WatchCards[1];
        var secondLink = $"[{BuildWatchCardTitle(second)}](/watches/{second.Slug})";
        return $"{firstLink} and {secondLink} are the strongest catalogue matches Tourbillon has in this context. If you want, compare them side by side or narrow by size, material, or budget.";
    }

    private static List<string> ReadStringArray(JsonElement json, string propertyName)
    {
        if (!json.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.Array)
            return [];

        return property
            .EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString())
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<EntityMentions> ResolveEntityMentionsAsync(string query)
    {
        var brands = await GetCachedBrandsAsync();
        var collections = await GetCachedCollectionsAsync();
        var mentions = new EntityMentions();
        var matchedBrandIds = new HashSet<int>();
        var normalizedQuery = QueryNormalizer.NormalizeText(query);

        foreach (var (alias, canonical) in QueryNormalizer.BrandAliases)
        {
            if (!Regex.IsMatch(query, $@"\b{Regex.Escape(alias)}\b", RegexOptions.IgnoreCase))
                continue;

            var brand = brands.FirstOrDefault(b =>
                string.Equals(QueryNormalizer.NormalizeText(b.Name), QueryNormalizer.NormalizeText(canonical), StringComparison.OrdinalIgnoreCase));
            if (brand != null && matchedBrandIds.Add(brand.Id))
                mentions.Brands.Add(brand);
        }

        foreach (var brand in brands.OrderByDescending(b => b.Name.Length))
        {
            var normalizedName = QueryNormalizer.NormalizeText(brand.Name);
            if (!query.Contains(brand.Name, StringComparison.OrdinalIgnoreCase) && !normalizedQuery.Contains(normalizedName))
                continue;

            if (matchedBrandIds.Add(brand.Id))
                mentions.Brands.Add(brand);
        }

        var allowFuzzyBrandResolution = matchedBrandIds.Count == 0
            && (WatchFinderService.HasWatchDomainSignal(query)
                || Regex.IsMatch(
                    query,
                    @"\b(?:tell\s+me\s+about|show\s+me|introduce\s+me|brand|history|heritage|maison|collection|do\s+you\s+have)\b",
                    RegexOptions.IgnoreCase)
                || CountWords(query) <= 4);
        if (allowFuzzyBrandResolution)
        {
            foreach (var brand in ResolveFuzzyBrands(query, brands))
            {
                if (matchedBrandIds.Add(brand.Id))
                    mentions.Brands.Add(brand);
            }
        }

        var collectionPool = mentions.Brands.Count > 0
            ? collections.Where(c => mentions.Brands.Any(b => b.Id == c.BrandId)).ToList()
            : collections;

        var matchedCollectionIds = new HashSet<int>();
        foreach (var collection in collectionPool.OrderByDescending(c => c.Name.Length))
        {
            var normalizedName = QueryNormalizer.NormalizeText(collection.Name);

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

        // Only do fuzzy collection resolution when the pool is already brand-scoped, at least one
        // collection was already resolved (user is clearly in watch territory), or the query has
        // an explicit watch domain signal. Without these guards, single-token fuzzy matching
        // produces false positives (e.g. "reverse" → "Reverso") on off-topic queries.
        if (matchedBrandIds.Count > 0 || matchedCollectionIds.Count > 0 || WatchFinderService.HasWatchDomainSignal(query))
        {
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
        }

        return mentions;
    }

    private ChatResolution? TryResolveCursorCommand(string query)
    {
        if (!Regex.IsMatch(query, @"\b(?:cursor|pointer)\b", RegexOptions.IgnoreCase))
            return null;

        if (!Regex.IsMatch(query, @"\b(?:change|changed|set|switch|switched|use|make|give|want|reset)\b", RegexOptions.IgnoreCase)
            && !Regex.IsMatch(query, @"\bcursor\s+to\b", RegexOptions.IgnoreCase))
            return null;

        var normalized = QueryNormalizer.NormalizeText(query);
        var resolvedCursor = _cursorAliases
            .OrderByDescending(alias => alias.Key.Length)
            .FirstOrDefault(alias => normalized.Contains(QueryNormalizer.NormalizeText(alias.Key), StringComparison.OrdinalIgnoreCase));

        if (string.IsNullOrWhiteSpace(resolvedCursor.Value))
        {
            // Cursor intent is clear but the cursor name is unrecognized — list available options
            // so the user knows what to ask for instead of falling to the generic ai_fallback.
            var available = _cursorAliases.Values
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(v => char.ToUpperInvariant(v[0]) + v[1..])
                .OrderBy(v => v);
            return new ChatResolution
            {
                Message = $"Available cursors: {string.Join(", ", available)}. Which would you like?",
                RoutingPath = "cursor_unresolved"
            };
        }

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

        if (ClassifierMatches(ChatIntent.AffirmativeFollowUp))
        {
            if (lastWatchCards.Count > 0)
                return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: true, sessionState?.FollowUpMode, sessionState);

            var storedMentions = await ResolveMentionsFromSessionStateAsync(sessionState);
            if (storedMentions.HasAny)
                return await BuildEntityInfoResolutionAsync(sessionState?.CanonicalQuery ?? query, storedMentions);
        }

        if (sessionState?.WatchSlugs.Count > 0
            && string.Equals(sessionState.FollowUpMode, "watch_cards", StringComparison.OrdinalIgnoreCase)
            && ClassifierMatchesAny(ChatIntent.ContextualFollowUp, ChatIntent.RevisionRequest, ChatIntent.WatchCompare))
        {
            var sessionShortlist = await BuildSessionShortlistFollowUpResolutionAsync(
                query,
                lastWatchCards,
                sessionState,
                excludedBrandIds);
            if (sessionShortlist != null)
                return sessionShortlist;
        }

        // "Show me more" in a compare context would otherwise re-echo the same cards.
        // Instead, reload all models from the session's collections excluding already-shown slugs.
        if (string.Equals(sessionState?.FollowUpMode, "compare", StringComparison.OrdinalIgnoreCase)
            && sessionState?.CollectionIds.Count > 0
            && ClassifierMatches(ChatIntent.ExpansionRequest))
        {
            return await BuildCompareExpandResolutionAsync(query, lastWatchCards, sessionState);
        }

        if (!ClassifierMatchesAny(ChatIntent.ContextualFollowUp, ChatIntent.AffirmativeFollowUp)
            || lastWatchCards.Count == 0)
            return null;

        return await BuildCardContinuationResolutionAsync(query, lastWatchCards, affirmative: false, sessionState?.FollowUpMode, sessionState);
    }

    private async Task<ChatResolution?> BuildSessionShortlistFollowUpResolutionAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState sessionState,
        List<int>? excludedBrandIds)
    {
        var sessionWatches = await LoadSessionWatchesAsync(sessionState, lastWatchCards, excludedBrandIds);
        if (sessionWatches.Count == 0)
            return null;

        var directions = DetectDiscoveryDirections($"{sessionState.DiscoveryQuery} {query}");
        if (ClassifierMatches(ChatIntent.WatchCompare) || IsExplicitCompareQuery(query))
        {
            var compareWatches = SelectSessionShortlistWatches(sessionWatches, directions, query, maxCount: 2);
            if (compareWatches.Count >= 2)
            {
                var compareResolution = await BuildCompareResolutionAsync(query, compareWatches);
                compareResolution.SessionState = PreserveBroaderWatchCardSessionState(
                    sessionState,
                    compareResolution.SessionState ?? BuildSessionStateFromWatches(compareWatches, "compare", BuildCanonicalEntityQuery(compareWatches, query), discoveryQuery: sessionState.DiscoveryQuery ?? query));
                return compareResolution;
            }
        }

        var selectedWatches = SelectSessionShortlistWatches(
            sessionWatches,
            directions,
            query,
            maxCount: DiscoveryCardLimit);
        if (selectedWatches.Count == 0)
            selectedWatches = sessionWatches.Take(DiscoveryCardLimit).ToList();

        var mentions = await ResolveMentionsFromSessionStateAsync(sessionState);
        var resolution = await BuildDiscoveryResolutionAsync(
            query,
            new WatchFinderResult
            {
                Watches = selectedWatches.Select(watch => WatchDto.FromWatch(watch, _storage)).ToList(),
                SearchPath = "session_shortlist"
            },
            excludedBrandIds,
            includeSearchAction: false,
            mentions: mentions);
        resolution.SearchPath = "session_shortlist";
        resolution.SessionState = PreserveBroaderWatchCardSessionState(
            sessionState,
            resolution.SessionState ?? BuildSessionStateFromWatches(selectedWatches, "watch_cards", BuildCanonicalEntityQuery(selectedWatches, query), discoveryQuery: sessionState.DiscoveryQuery ?? query));
        return resolution;
    }

    private async Task<List<Watch>> TryResolveSessionShortlistCompareWatchesAsync(
        string query,
        ChatSessionState sessionState,
        List<ChatWatchCard> lastWatchCards,
        List<int>? excludedBrandIds)
    {
        var sessionWatches = await LoadSessionWatchesAsync(sessionState, lastWatchCards, excludedBrandIds);
        if (sessionWatches.Count == 0)
            return [];

        var directions = DetectDiscoveryDirections($"{sessionState.DiscoveryQuery} {query}");
        return SelectSessionShortlistWatches(sessionWatches, directions, query, maxCount: 2);
    }

    // Loads unseen models from the session's compare collections and returns an AI-worded card row.
    // Returns a message-only resolution when all models have already been surfaced.
    private async Task<ChatResolution> BuildCompareExpandResolutionAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState sessionState)
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
            Message = ChatMessages.AllCurrentModels(_replyLanguage),
            WatchCards = [],
            Actions = [],
            RoutingPath = "compare_expand",
            SessionState = sessionState,
        };
    }

    // Dispatches to the appropriate resolution builder based on the AI classifier's intent.
    // Returns null when the intent cannot be resolved (e.g. missing entities for brand_decision),
    // which causes the caller to fall through to the remaining structural/backend routing.
    private async Task<ChatResolution?> DispatchByIntentAsync(
        string intent,
        string message,
        string canonicalMessage,
        EntityMentions mentions,
        ChatSessionState? sessionState,
        List<ChatWatchCard> lastWatchCards,
        ChatCompareScope? compareScope,
        List<int> excludedBrandIds)
    {
        switch (intent)
        {
            case ChatIntent.WatchCompare:
            case ChatIntent.CollectionCompare:
            {
                var compareWatches = await TryResolveCompareWatchesAsync(
                    canonicalMessage, lastWatchCards, mentions, compareScope);
                if (compareWatches.Count < 2 && sessionState?.WatchSlugs.Count > 0)
                    compareWatches = await TryResolveSessionShortlistCompareWatchesAsync(canonicalMessage, sessionState, lastWatchCards, excludedBrandIds);
                if (compareWatches.Count < 2)
                {
                    var found = compareWatches.Count == 1 ? $" I found {compareWatches[0].Name}," : "";
                    return new ChatResolution
                    {
                        Message = $"To compare I need at least two models.{found} try naming both by model or collection.",
                        RoutingPath = "compare_insufficient"
                    };
                }
                return await BuildCompareResolutionAsync(canonicalMessage, compareWatches);
            }

            case ChatIntent.BrandDecision:
                if (mentions.Brands.Count < 2) return null;
                return await BuildBrandDecisionResolutionAsync(canonicalMessage, mentions);

            case ChatIntent.AffirmativeFollowUp:
            {
                if (lastWatchCards.Count > 0)
                    return await BuildCardContinuationResolutionAsync(
                        message, lastWatchCards, affirmative: true, sessionState?.FollowUpMode, sessionState);
                var storedMentions = await ResolveMentionsFromSessionStateAsync(sessionState);
                if (storedMentions.HasAny)
                    return await BuildEntityInfoResolutionAsync(sessionState?.CanonicalQuery ?? message, storedMentions);
                return new ChatResolution
                {
                    Message = ChatMessages.WhatAreYouLookingFor(_replyLanguage),
                    RoutingPath = "affirmative_no_context"
                };
            }

            case ChatIntent.ExpansionRequest:
            {
                // Compare-mode expansion: show unseen models from the same collections.
                if (string.Equals(sessionState?.FollowUpMode, "compare", StringComparison.OrdinalIgnoreCase)
                    && sessionState?.CollectionIds.Count > 0)
                {
                    return await BuildCompareExpandResolutionAsync(message, lastWatchCards, sessionState);
                }
                return null; // General expansion falls through to legacy routing
            }

            case ChatIntent.RevisionRequest:
            {
                var revision = await TryResolveRecommendationRevisionAsync(
                    message, canonicalMessage, lastWatchCards, sessionState, excludedBrandIds);
                if (revision != null) return revision;

                // A revision with nothing to revise is a first brief in a complaint's grammar.
                // "I hate date windows" opens a session, reads as a correction, finds no shortlist
                // to correct and used to answer with no cards at all. It is a search whenever the
                // sentence states something searchable on its own.
                if (lastWatchCards.Count == 0 && string.IsNullOrWhiteSpace(sessionState?.DiscoveryQuery)
                    && StatesItsOwnBrief(canonicalMessage))
                    return await BuildSearchDiscoveryResolutionAsync(canonicalMessage, mentions, excludedBrandIds);
                return null;
            }

            case ChatIntent.ContextualFollowUp:
                if (lastWatchCards.Count == 0) return null;
                // Session-aware path first: preserves the broader shortlist and handles
                // direction-aware selection. Falls through to the simpler continuation
                // when no session shortlist exists or the rich handler declines.
                if (sessionState?.WatchSlugs.Count > 0
                    && string.Equals(sessionState.FollowUpMode, "watch_cards", StringComparison.OrdinalIgnoreCase))
                {
                    var shortlist = await BuildSessionShortlistFollowUpResolutionAsync(
                        message, lastWatchCards, sessionState, excludedBrandIds);
                    if (shortlist != null) return shortlist;
                }
                return await BuildCardContinuationResolutionAsync(
                    message, lastWatchCards, affirmative: false, sessionState?.FollowUpMode, sessionState);

            case ChatIntent.BrandInfo:
            case ChatIntent.CollectionInfo:
                if (!mentions.HasAny) return null;
                return await BuildEntityInfoResolutionAsync(canonicalMessage, mentions);

            case ChatIntent.BrandHistory:
                if (mentions.Brands.Count == 0) return null;
                return await BuildEntityInfoResolutionAsync(
                    canonicalMessage, mentions, allowWebEnrichment: true);

            case ChatIntent.AdviceRequest:
                return await BuildAdviceResolutionAsync(canonicalMessage, mentions, excludedBrandIds);

            case ChatIntent.Discovery:
            {
                // Simple brand/collection reference (no descriptors) → pure SQL sample, no LLM search cost.
                // Uses semantic routing (embedding cosine similarity) with regex as fallback.
                if (await IsSimpleBrandQueryAsync(canonicalMessage, mentions))
                {
                    var brandId = mentions.Brands.FirstOrDefault()?.Id;
                    var collectionId = mentions.Collections.FirstOrDefault()?.Id;
                    var sqlWatches = await GetCatalogueSampleAsync(brandId, collectionId, excludedBrandIds, limit: 6);
                    if (sqlWatches.Count > 0)
                    {
                        var sqlResult = new WatchFinderResult
                        {
                            Watches = sqlWatches.Select(w => WatchDto.FromWatch(w, _storage)).ToList(),
                            SearchPath = "direct_sql_brand"
                        };
                        var sqlR = await BuildDiscoveryResolutionAsync(
                            canonicalMessage, sqlResult, excludedBrandIds, mentions: mentions);
                        sqlR.SearchPath = "direct_sql_brand";
                        return sqlR;
                    }
                    // No SQL results (brand with 0 watches) → fall through to full pipeline
                }

                // Complex query or brand returned empty → full WatchFinder (LLM parse, vector + BM25F fused by RRF).
                return await BuildSearchDiscoveryResolutionAsync(canonicalMessage, mentions, excludedBrandIds);
            }

            case ChatIntent.NonWatch:
                if (WatchFinderService.HasWatchDomainSignal(message))
                    return null;

                if (CountWords(message) <= 3
                    && !mentions.HasAny
                    && !WatchFinderService.HasWatchDomainSignal(message)
                    && Regex.IsMatch(message, @"^[\p{L}\s'!.?-]+$"))
                {
                    return new ChatResolution { Message = GreetingMessage, RoutingPath = "greeting" };
                }

                return new ChatResolution { Message = UnsupportedQueryMessage, RoutingPath = "non_watch" };

            default:
                return null;
        }
    }

    // Advisor mode: lead with personal-fit guidance, then a tight curated set. Reuses the
    // discovery search + grounding pipeline but caps the cards and flags the AI wording layer
    // to advise rather than just list matches.
    private async Task<ChatResolution?> BuildAdviceResolutionAsync(
        string canonicalMessage,
        EntityMentions mentions,
        List<int> excludedBrandIds)
    {
        var searchResult = excludedBrandIds.Count > 0
            ? await _watchFinderService.FindWatchesAsync(canonicalMessage, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(canonicalMessage);
        searchResult ??= new WatchFinderResult();

        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
            return new ChatResolution { Message = UnsupportedQueryMessage, RoutingPath = "non_watch" };

        // No catalogue fit: still advise in prose and ask for what would narrow it, rather than
        // dead-ending with a bare "no matches" line. No Smart Search chip: handing the same brief to
        // a filter search that found nothing opens an empty page.
        if (searchResult.Watches.Count == 0)
        {
            return new ChatResolution
            {
                UseAi = true,
                AiMode = "advisor",
                Query = canonicalMessage,
                Message = AdviceNoMatchMessage,
                RoutingPath = "advice_no_match"
            };
        }

        var resolution = await BuildDiscoveryResolutionAsync(
            canonicalMessage,
            searchResult,
            excludedBrandIds,
            mentions: mentions,
            cardLimit: AdviceCardLimit,
            aiMode: "advisor");
        resolution.SearchPath = searchResult.SearchPath;
        resolution.RoutingPath = "advice";
        return resolution;
    }

    /// The full retrieval path behind a brief: LLM parse, vector and BM25F fused by RRF. Shared by
    /// discovery and by a revision that arrived with nothing to revise.
    private async Task<ChatResolution> BuildSearchDiscoveryResolutionAsync(
        string canonicalMessage, EntityMentions mentions, List<int> excludedBrandIds)
    {
        var searchResult = excludedBrandIds.Count > 0
            ? await _watchFinderService.FindWatchesAsync(canonicalMessage, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(canonicalMessage);
        searchResult ??= new WatchFinderResult();
        if (string.Equals(searchResult.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
            return new ChatResolution { Message = UnsupportedQueryMessage, RoutingPath = "non_watch" };
        if (searchResult.Watches.Count == 0)
            return new ChatResolution { Message = NoCloseMatchMessage, RoutingPath = "discovery_empty" };

        var resolution = await BuildDiscoveryResolutionAsync(
            canonicalMessage, searchResult, excludedBrandIds, mentions: mentions);
        resolution.SearchPath = searchResult.SearchPath;
        return resolution;
    }

    /// A one-line record of what the parse understood, for the evaluation hook only. Empty fields
    /// are left out, so the line reads as the brief was read: "maxPrice=5000; excl-comp=date".
    private static string? SummariseIntent(QueryIntent? intent)
    {
        if (intent == null) return null;
        var parts = new List<string>();
        void Add(string key, object? value) { if (value != null) parts.Add($"{key}={value}"); }

        Add("brand", intent.BrandId);
        if (intent.BrandIds.Count > 0) Add("brands", string.Join(",", intent.BrandIds));
        Add("collection", intent.CollectionId);
        if (intent.CollectionIds.Count > 0) Add("collections", string.Join(",", intent.CollectionIds));
        Add("minPrice", intent.MinPrice);
        Add("maxPrice", intent.MaxPrice);
        Add("style", intent.Style);
        Add("material", intent.CaseMaterial);
        Add("dial", intent.DialColour);
        Add("minDia", intent.MinDiameterMm);
        Add("maxDia", intent.MaxDiameterMm);
        Add("water", intent.WaterResistance);
        if (intent.Complications.Count > 0) Add("comp", string.Join(",", intent.Complications));
        if (intent.ExcludedComplications.Count > 0) Add("excl-comp", string.Join(",", intent.ExcludedComplications));
        if (intent.ExcludedMaterials.Count > 0) Add("excl-mat", string.Join(",", intent.ExcludedMaterials));
        if (intent.ExcludedBrandIds.Count > 0) Add("excl-brand", string.Join(",", intent.ExcludedBrandIds));

        return parts.Count > 0 ? string.Join("; ", parts) : null;
    }

    /// True when the sentence carries a constraint the catalogue can be searched on. "I hate date
    /// windows" does; "something cheaper" does not, and without a shortlist behind it that one has
    /// nothing to be cheaper than.
    private static bool StatesItsOwnBrief(string message)
    {
        var parsed = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(message, parsed);
        return parsed.HasAnyFilter();
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

        var hasRevisionContext = lastWatchCards.Count > 0 || !string.IsNullOrWhiteSpace(sessionState?.DiscoveryQuery);
        if (!hasRevisionContext || !ClassifierMatches(ChatIntent.RevisionRequest))
            return null;

        var accumulatedRejectedSlugs = (sessionState?.RejectedWatchSlugs ?? [])
            .Union(DetectRejectedWatchSlugs(canonicalMessage, lastWatchCards), StringComparer.OrdinalIgnoreCase)
            .ToList();

        var revisionSummary = ExtractRecommendationCorrectionFocus(canonicalMessage);
        var revisedQuery = BuildRecommendationRevisionQuery(
            canonicalMessage,
            sessionState?.DiscoveryQuery ?? sessionState?.CanonicalQuery,
            revisionSummary);

        // Strip excluded brand names from the revised query so they don't re-enter entity
        // resolution or WatchFinder's LLM parser as spurious inclusion signals.
        if (excludedBrandIds.Count > 0)
        {
            var excludedNames = await GetBrandNamesAsync(excludedBrandIds);
            foreach (var name in excludedNames)
                revisedQuery = Regex.Replace(revisedQuery, $@"\b{Regex.Escape(name)}\b", "", RegexOptions.IgnoreCase);
            revisedQuery = Regex.Replace(revisedQuery, @"\s{2,}", " ").Trim(',', '.', '?', '!', ' ');
        }

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
                Message = ChatMessages.NoStrongerShortlist(_replyLanguage),
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
        List<ChatWatchCard> lastWatchCards,
        ChatSessionState? sessionState,
        List<int>? excludedBrandIds = null)
    {
        var directEntityQuery = ExtractDirectEntityQuery(query, mentions, sessionState);
        if (string.IsNullOrWhiteSpace(directEntityQuery))
            return null;

        var scopedMentions = mentions.HasAny
            ? mentions
            : await ResolveMentionsFromSessionStateAsync(sessionState);
        var keepWithinActiveScope = ShouldKeepDirectLookupInsideScope(scopedMentions, lastWatchCards);

        var result = (excludedBrandIds?.Count > 0
            ? await _watchFinderService.FindWatchesAsync(directEntityQuery, excludedBrandIds)
            : await _watchFinderService.FindWatchesAsync(directEntityQuery))
            ?? new WatchFinderResult();

        if (string.Equals(result.SearchPath, "non_watch", StringComparison.OrdinalIgnoreCase))
            return null;

        if (keepWithinActiveScope)
            result = await FilterResultToActiveScopeAsync(result, scopedMentions);

        if (result.Watches.Count == 0)
        {
            if (keepWithinActiveScope)
                return await BuildScopedNoDirectMatchResolutionAsync(query, directEntityQuery, scopedMentions);
            return null;
        }

        var exactWatch = await TryResolveExactWatchAsync(directEntityQuery, result);
        if (exactWatch != null)
            return BuildExactWatchResolution(exactWatch, directEntityQuery);

        return await BuildDiscoveryResolutionAsync(directEntityQuery, result, excludedBrandIds, includeSearchAction: false);
    }

    private static bool ShouldKeepDirectLookupInsideScope(EntityMentions mentions, List<ChatWatchCard> lastWatchCards)
    {
        if (mentions.Collections.Count > 0 || mentions.Brands.Count > 0)
            return true;

        return lastWatchCards
            .Where(card => card.BrandId > 0)
            .Select(card => card.BrandId)
            .Distinct()
            .Count() == 1;
    }

    private async Task<WatchFinderResult> FilterResultToActiveScopeAsync(WatchFinderResult result, EntityMentions mentions)
    {
        if (result.Watches.Count == 0 || !mentions.HasAny)
            return result;

        var watchIds = result.Watches.Select(watch => watch.Id).Distinct().ToList();
        var allowedBrandIds = mentions.Brands.Select(brand => brand.Id).ToHashSet();
        var allowedCollectionIds = mentions.Collections.Select(collection => collection.Id).ToHashSet();

        var scopeMap = await _context.Watches
            .AsNoTracking()
            .Where(watch => watchIds.Contains(watch.Id))
            .Select(watch => new { watch.Id, watch.BrandId, watch.CollectionId })
            .ToDictionaryAsync(watch => watch.Id);

        var scopedWatches = result.Watches
            .Where(watch =>
            {
                if (!scopeMap.TryGetValue(watch.Id, out var scope))
                    return false;

                if (allowedCollectionIds.Count > 0)
                    return scope.CollectionId is int collectionId && allowedCollectionIds.Contains(collectionId);

                return allowedBrandIds.Count == 0 || allowedBrandIds.Contains(scope.BrandId);
            })
            .ToList();

        return new WatchFinderResult
        {
            Watches = scopedWatches,
            OtherCandidates = [],
            SearchPath = result.SearchPath,
            QueryIntent = result.QueryIntent,
        };
    }

    private async Task<ChatResolution> BuildScopedNoDirectMatchResolutionAsync(
        string query,
        string directEntityQuery,
        EntityMentions scopedMentions)
    {
        var resolution = await BuildEntityInfoResolutionAsync(query, scopedMentions, noDirectMatch: true);
        var scopeLabel = scopedMentions.Collections.FirstOrDefault()?.Name
            ?? scopedMentions.Brands.FirstOrDefault()?.Name
            ?? "current Tourbillon scope";
        var displayQuery = directEntityQuery.Trim();
        resolution.Message = $"I couldn't find a Tourbillon model matching \"{displayQuery}\" in the current {scopeLabel} scope. Here are the closest grounded options from that same scope.";
        resolution.RoutingPath = "scoped_direct_miss";
        return resolution;
    }

    private async Task<ChatResolution> BuildCardContinuationResolutionAsync(
        string query,
        List<ChatWatchCard> lastWatchCards,
        bool affirmative,
        string? followUpMode,
        ChatSessionState? sessionState = null)
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
                Message = ChatMessages.NeedOneMoreDetail(_replyLanguage)
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

        var nextSessionState = BuildSessionStateFromWatches(
            ordered,
            isCompareFollowUp ? "compare" : "watch_cards",
            ordered.Count == 1 ? ordered[0].Name : BuildCanonicalEntityQuery(ordered, query),
            discoveryQuery: query);
        if (!isCompareFollowUp)
            nextSessionState = PreserveBroaderWatchCardSessionState(sessionState, nextSessionState);

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
            SessionState = nextSessionState,
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
            @"^\s*(?:introduce\s+me(?:\s+to)?(?:\s+the)?|tell\s+me\s+about(?:\s+the)?(?:\s+watch\s+named)?|show\s+me(?:\s+the)?(?:\s+watch\s+named)?|do\s+you\s+have(?:\s+(?:this|the))?(?:\s+(?:watch|model|reference|ref(?:erence)?))?|the\s+watch\s+named|the\s+model\s+named|model\s+named)\s+",
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
            @"^\s*do\s+you\s+have(?:\s+(?:this|the))?(?:\s+(?:watch|model|reference|ref(?:erence)?))?\s+(.+?)\s*$",
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

        var embeddedReference = Regex.Match(
            trimmed,
            @"\b([A-Za-z]{0,4}\d[\w/-]{2,})\b",
            RegexOptions.IgnoreCase);
        if (embeddedReference.Success
            && Regex.IsMatch(trimmed, @"\b(?:watch|model|reference|ref(?:erence)?|have|carry|stock)\b", RegexOptions.IgnoreCase))
        {
            return embeddedReference.Groups[1].Value;
        }

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

    private static ChatSessionState PreserveBroaderWatchCardSessionState(
        ChatSessionState? previousState,
        ChatSessionState nextState)
    {
        if (previousState == null
            || !string.Equals(previousState.FollowUpMode, "watch_cards", StringComparison.OrdinalIgnoreCase)
            || previousState.WatchSlugs.Count <= nextState.WatchSlugs.Count)
        {
            return nextState;
        }

        nextState.BrandIds = nextState.BrandIds
            .Union(previousState.BrandIds)
            .Distinct()
            .ToList();
        nextState.CollectionIds = nextState.CollectionIds
            .Union(previousState.CollectionIds)
            .Distinct()
            .ToList();
        nextState.WatchSlugs = previousState.WatchSlugs
            .Where(slug => !string.IsNullOrWhiteSpace(slug))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        nextState.DiscoveryQuery ??= previousState.DiscoveryQuery;
        nextState.CanonicalQuery ??= previousState.CanonicalQuery;
        return nextState;
    }

    private async Task<List<Watch>> LoadSessionWatchesAsync(
        ChatSessionState? sessionState,
        List<ChatWatchCard> lastWatchCards,
        List<int>? excludedBrandIds = null)
    {
        var slugsInOrder = (sessionState?.WatchSlugs ?? [])
            .Where(slug => !string.IsNullOrWhiteSpace(slug))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (slugsInOrder.Count == 0)
        {
            slugsInOrder = lastWatchCards
                .Select(card => card.Slug)
                .Where(slug => !string.IsNullOrWhiteSpace(slug))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        if (slugsInOrder.Count == 0)
            return [];

        var watches = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .Where(w => slugsInOrder.Contains(w.Slug))
            .ToListAsync();

        if (excludedBrandIds?.Count > 0)
            watches = watches.Where(watch => !excludedBrandIds.Contains(watch.BrandId)).ToList();

        return slugsInOrder
            .Select(slug => watches.FirstOrDefault(watch => string.Equals(watch.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(watch => watch != null)
            .Cast<Watch>()
            .ToList();
    }

    private static List<Watch> SelectSessionShortlistWatches(
        List<Watch> sessionWatches,
        List<string> directions,
        string query,
        int maxCount)
    {
        if (sessionWatches.Count == 0)
            return [];

        var requestedPerDirection = Regex.IsMatch(query, @"\bwhich\s+two\b|\btwo\s+are\b", RegexOptions.IgnoreCase)
            ? 2
            : 1;
        var selected = new List<Watch>();

        if (directions.Count >= 2)
        {
            foreach (var direction in directions)
            {
                foreach (var watch in sessionWatches.Where(watch => WatchMatchesDirection(watch, direction)).Take(requestedPerDirection))
                {
                    if (selected.All(existing => existing.Id != watch.Id))
                        selected.Add(watch);
                    if (selected.Count >= maxCount)
                        return selected;
                }
            }
        }

        if (selected.Count == 0)
            selected.AddRange(sessionWatches.Take(Math.Min(maxCount, DiscoveryCardLimit)));

        return selected
            .DistinctBy(watch => watch.Id)
            .Take(maxCount)
            .ToList();
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

    // Weaves other-brand candidates into a shortlist dominated by one brand so several brands
    // surface, displacing the dominant brand's surplus rather than growing the list. Round-robin
    // (dominant brand first) keeps the strongest dominant pick leading and is stable within each
    // brand, preserving the upstream ranking order. Other-brand candidates that share the dominant
    // brand or are already present are ignored, so single-brand shortlists pass through untouched.
    private static List<Watch> ApplyDiscoveryBrandDiversity(List<Watch> dominant, List<Watch> otherCandidates)
    {
        if (dominant.Count == 0 || otherCandidates.Count == 0)
            return dominant;

        var targetCount = dominant.Count;
        var presentIds = dominant.Select(w => w.Id).ToHashSet();
        var dominantBrandId = dominant
            .GroupBy(w => w.BrandId)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .First().Key;

        var injectable = otherCandidates
            .Where(w => w.BrandId != dominantBrandId && presentIds.Add(w.Id))
            .ToList();
        if (injectable.Count == 0)
            return dominant;

        var brandQueues = dominant
            .Concat(injectable)
            .GroupBy(w => w.BrandId)
            .OrderByDescending(g => g.Key == dominantBrandId)
            .Select(g => new Queue<Watch>(g))
            .ToList();

        var diversified = new List<Watch>(targetCount);
        while (diversified.Count < targetCount && brandQueues.Any(q => q.Count > 0))
        {
            foreach (var queue in brandQueues)
            {
                if (queue.Count == 0) continue;
                diversified.Add(queue.Dequeue());
                if (diversified.Count >= targetCount) break;
            }
        }

        return diversified;
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
        // Cards kept per entity, so a two-brand or two-collection question shows both rather than
        // four watches from whichever was resolved first.
        var cardsByEntity = new List<List<ChatWatchCard>>();
        var suppliedNames = new List<string>();

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
            suppliedNames.Add(fullCollection.Name);
            if (fullCollection.Brand?.Name is { Length: > 0 } collectionBrandName)
                suppliedNames.Add(collectionBrandName);

            var sampleWatches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .Where(w => w.CollectionId == fullCollection.Id)
                .OrderByDescending(w => w.CurrentPrice)
                .Take(4)
                .AsNoTracking()
                .ToListAsync();

            foreach (var watch in sampleWatches)
                context.Add(BuildWatchContext(watch));

            var collectionCards = sampleWatches.Select(ToChatWatchCard).ToList();
            cards.AddRange(collectionCards);
            cardsByEntity.Add(collectionCards);
        }

        foreach (var brand in mentions.Brands.Take(2))
        {
            var fullBrand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == brand.Id);
            if (fullBrand == null) continue;

            context.Add(BuildBrandContext(fullBrand));
            suppliedNames.Add(fullBrand.Name);

            var brandCollections = await _context.Collections
                .Where(c => c.BrandId == fullBrand.Id)
                .OrderBy(c => c.Name)
                .Take(3)
                .AsNoTracking()
                .ToListAsync();

            foreach (var collection in brandCollections)
            {
                context.Add(BuildCollectionContext(collection));
                suppliedNames.Add(collection.Name);
            }

            var sampleWatches = await _context.Watches
                .Include(w => w.Brand)
                .Include(w => w.Collection)
                .Where(w => w.BrandId == fullBrand.Id)
                .OrderByDescending(w => w.CurrentPrice)
                .Take(4)
                .AsNoTracking()
                .ToListAsync();

            foreach (var watch in sampleWatches)
                context.Add(BuildWatchContext(watch));

            var brandCards = sampleWatches.Select(ToChatWatchCard).ToList();
            cards.AddRange(brandCards);
            cardsByEntity.Add(brandCards);
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

        var dedupedCards = InterleaveEntityCards(cardsByEntity, 4);
        var suggestedCompareSlugs = allowWebEnrichment
            ? []
            : dedupedCards.Take(2)
                .Select(card => card.Slug)
                .Where(slug => !string.IsNullOrWhiteSpace(slug))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

        return new ChatResolution
        {
            UseAi = true,
            Query = query,
            Context = context,
            WatchCards = dedupedCards,
            ReplyLength = "explain",
            SuppressCompareSuggestion = allowWebEnrichment,
            SuggestedCompareSlugs = suggestedCompareSlugs,
            AllowedEntityNames = suppliedNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
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

    // Takes cards a round at a time from each entity's own list, so four slots shared by two brands
    // come out two each instead of four from the first. Order inside an entity is preserved.
    internal static List<ChatWatchCard> InterleaveEntityCards(List<List<ChatWatchCard>> cardsByEntity, int limit)
    {
        var taken = new List<ChatWatchCard>();
        var seen = new HashSet<int>();
        var depth = cardsByEntity.Count == 0 ? 0 : cardsByEntity.Max(group => group.Count);

        for (var round = 0; round < depth && taken.Count < limit; round++)
        {
            foreach (var group in cardsByEntity)
            {
                if (round >= group.Count) continue;
                if (!seen.Add(group[round].Id)) continue;
                taken.Add(group[round]);
                if (taken.Count == limit) break;
            }
        }

        return taken;
    }

    private async Task<ChatResolution> BuildDiscoveryResolutionAsync(
        string query,
        WatchFinderResult result,
        List<int>? excludedBrandIds = null,
        bool includeSearchAction = true,
        EntityMentions? mentions = null,
        string? revisionSummary = null,
        IReadOnlyCollection<string>? rejectedWatchSlugs = null,
        int cardLimit = DiscoveryCardLimit,
        string? aiMode = null)
    {
        var candidateIds = result.Watches.Concat(result.OtherCandidates)
            .Select(watch => watch.Id)
            .Distinct()
            .Take(50)
            .ToList();
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
        {
            // Pull other-brand runners-up in so a single dominant brand doesn't monopolise the
            // shortlist — they displace the dominant brand's surplus rather than padding it out.
            var otherCandidateIds = result.OtherCandidates
                .Select(w => w.Id)
                .Where(id => !topIds.Contains(id))
                .Distinct()
                .ToList();
            if (otherCandidateIds.Count > 0)
                ordered = ApplyDiscoveryBrandDiversity(ordered, await LoadWatchesByIdsAsync(otherCandidateIds));

            ordered = [.. ordered.OrderByDescending(GetBrandPrestigeTier)];

            // Cap tier-2 brands (e.g. Frédérique Constant) at 3 cards when higher-tier
            // alternatives are present — prevents a single accessible-luxury brand from
            // flooding a prestige shortlist just because it has broad catalogue coverage.
            const int tier2Cap = 3;
            bool hasTier3OrAbove = ordered.Any(w => GetBrandPrestigeTier(w) >= 3);
            if (hasTier3OrAbove)
            {
                var tier2Seen = 0;
                ordered = ordered
                    .Where(w =>
                    {
                        if (GetBrandPrestigeTier(w) >= 3) return true;
                        return ++tier2Seen <= tier2Cap;
                    })
                    .ToList();
            }
        }

        if (rejectedWatchSlugs is { Count: > 0 })
        {
            ordered = ordered
                .Where(watch => !string.IsNullOrWhiteSpace(watch.Slug)
                    && !rejectedWatchSlugs.Contains(watch.Slug, StringComparer.OrdinalIgnoreCase))
                .Take(DiscoveryCardLimit)
                .ToList();
        }

        // Sink Price-on-Request below priced matches before truncating: a discovery shortlist is a
        // list of buyable recommendations, so an in-budget priced piece must lead an expensive PoR
        // one even when prestige tier would otherwise rank PoR first. Stable within each group.
        ordered = [.. ordered.OrderBy(w => w.CurrentPrice <= 0 ? 1 : 0)];

        // Cap to the requested width (advisor mode tightens this) so the surfaced cards and the
        // catalogue context handed to the AI describe the same set of watches.
        if (ordered.Count > cardLimit)
            ordered = ordered.Take(cardLimit).ToList();

        if (ordered.Count == 0)
        {
            return new ChatResolution
            {
                Message = NoCloseMatchMessage
            };
        }

        var offerSmartSearch = includeSearchAction
            && !IsExplicitCompareQuery(query)
            && aiMode != "advisor"
            && ReadsAsSmartSearchQuery(query, mentions?.HasAny == true);

        var context = new List<string>
        {
            offerSmartSearch
                ? $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Search guidance request: answer like a sales concierge, highlight the strongest matches, give each surfaced watch one short fit reason tied to the brief, tell the user the Smart Search chip can broaden discovery, emit one Smart Search action with a concise catalogue-style query built from the resolved matches rather than the user's raw wording, and end with a short follow-up question about size, material, budget, occasion, or a specific model."
                : $"Tourbillon resolved these catalogue matches for the user's request. Search path: {result.SearchPath ?? "unknown"}. Answer like a sales concierge, stay anchored to these exact catalogue matches, give each surfaced watch one short fit reason tied to the brief, do not emit a Smart Search action, and end with a short follow-up question about size, material, budget, occasion, or a specific model.",
            offerSmartSearch
                ? "Smart Search action guidance: rewrite discovery queries into compact catalogue terms. Prefer canonical brand and collection names from the supplied context. Good example: 'Jaeger-LeCoultre Reverso'. Bad example: 'yo, suggest me some reversos'."
                : "Action guidance: no Smart Search action is needed for this reply."
        };

        context.Add("Catalogue boundary notice: the watches listed below are the ONLY matches Tourbillon has for this brief. Do not name, describe, or reference any watch model that does not appear below — not even to say it is unavailable. If the user named a famous model (e.g. Rolex Submariner) that is absent, do not mention it; present only the supplied watches as the available options.");
        context.Add("Recommendation writing guidance: reason from catalogue facts and description cues, but do not paste or closely paraphrase Watch.Description into the answer.");
        if (requestedDirections.Count >= 2)
        {
            context.Insert(0,
                $"Mixed brief guidance: the user wants a shortlist that covers {string.Join(" and ", requestedDirections.Select(FormatDirectionLabel))}. Keep the answer grouped or clearly balanced across those directions, and keep the surfaced watches aligned with that split.");
        }
        if (!string.IsNullOrWhiteSpace(revisionSummary))
            context.Insert(0, $"Recommendation revision request: the user corrected or rejected the previous shortlist ({revisionSummary}). Replace the prior direction with a genuinely revised set from the supplied catalogue context only, and do not resurface the rejected watches.");
        if (WatchFinderService.HasWidenedSearchPath(result.SearchPath))
            context.Insert(0, BuildWidenedSearchNotice(result.SearchPath));

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
            .Select(g => g.First()))
        {
            context.Add(BuildCollectionContext(collection));
        }

        var actions = !offerSmartSearch
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
            offerSmartSearch);
        var discoveryCards = ordered.Select(ToChatWatchCard).Take(cardLimit).ToList();
        var suggestedCompareSlugs = discoveryCards
            .Take(2)
            .Select(card => card.Slug)
            .Where(slug => !string.IsNullOrWhiteSpace(slug))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (coverageMessage != null)
        {
            return new ChatResolution
            {
                AiMode = aiMode,
                CandidateWatchIds = candidateIds,
                ParsedIntentSummary = SummariseIntent(result.QueryIntent),
                Message = coverageMessage,
                WatchCards = discoveryCards,
                Actions = actions,
                SuggestedCompareSlugs = suggestedCompareSlugs,
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
            AiMode = aiMode,
            CandidateWatchIds = candidateIds,
            ParsedIntentSummary = SummariseIntent(result.QueryIntent),
            Message = BuildGroundedDiscoveryMessage(ordered, offerSmartSearch, requestedDirections),
            Query = query,
            Context = context,
            WatchCards = discoveryCards,
            Actions = actions,
            SuggestedCompareSlugs = suggestedCompareSlugs,
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

    private string BuildGroundedDiscoveryMessage(List<Watch> ordered, bool includeSearchAction, List<string>? requestedDirections = null)
    {
        if (ordered.Count == 0)
            return NoCloseMatchMessage;

        // Outside English the sentence is a fixed one around the same links: the variants below read
        // as English prose with English clause order, which no translation of the parts would fix.
        if (_replyLanguage != "english")
        {
            var lead = $"[{BuildWatchTitle(ordered[0])}](/watches/{ordered[0].Slug})";
            var follow = ordered.Count > 1 ? $"[{BuildWatchTitle(ordered[1])}](/watches/{ordered[1].Slug})" : null;
            return ChatMessages.StrongestMatches(_replyLanguage, lead, follow);
        }

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

    private static string BuildWidenedSearchNotice(string? searchPath)
    {
        var widenKinds = WatchFinderService.GetWidenedSearchKinds(searchPath);
        var onlyRelevance = widenKinds.Count == 1
            && widenKinds[0].Equals("relevance", StringComparison.OrdinalIgnoreCase);

        if (onlyRelevance)
        {
            // Vague / low-signal query — no explicit constraint was relaxed. Tell the AI
            // the surfaced cards are approximate matches and steer the user toward a
            // sharper brief rather than apologising.
            return "Widened search notice: the user's brief was broad, so the surfaced cards are Tourbillon's closest approximate matches. Acknowledge the brief in one short phrase, introduce the picks below as starting points, and invite the user to narrow with a brand, collection, style, or budget.";
        }

        var constraintLabel = FormatWidenedConstraintLabel(widenKinds);
        var pivot = widenKinds.Contains("price", StringComparer.OrdinalIgnoreCase)
            ? "Acknowledge the user's budget in one short phrase, explain briefly that Tourbillon starts above that cap, and pivot to the entry-tier pieces below without refusing."
            : "Acknowledge the mismatch in one short phrase and pivot to the closest catalogue alternatives below without refusing.";

        return $"Widened search notice: nothing in Tourbillon's catalogue matched the user's exact {constraintLabel} constraint. The surfaced cards are the closest catalogue matches. {pivot}";
    }

    private static string FormatWidenedConstraintLabel(IReadOnlyList<string> widenKinds)
    {
        if (widenKinds.Count == 0)
            return "price, size, or water-resistance";

        var labels = widenKinds
            .Select(kind => kind.ToLowerInvariant() switch
            {
                "price" => "price",
                "size" => "size",
                "water" => "water-resistance",
                _ => kind
            })
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return labels.Count switch
        {
            1 => labels[0],
            2 => $"{labels[0]} and {labels[1]}",
            _ => $"{string.Join(", ", labels.Take(labels.Count - 1))}, and {labels[^1]}"
        };
    }

    private bool ShouldKeepDeterministicResolutionMessage(string? aiMessage, ChatResolution resolution)
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

    private bool IsGenericAiFallbackMessage(string message)
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

    /// The history the wording layer sees. A comparison is decided before the model is asked, and
    /// the shortlist it came from is still in the transcript: asked to compare the second with the
    /// last, the model wrote about one of the two and a third watch it had named a turn earlier.
    /// The user's own turns stay, because the occasion they described is what makes a comparison
    /// worth reading; the assistant's earlier lists do not.
    private static List<ChatHistoryEntry> HistoryForResolution(
        List<ChatHistoryEntry> history, ChatResolution resolution) =>
        string.Equals(resolution.RoutingPath, "compare", StringComparison.Ordinal)
            ? history.Where(entry => string.Equals(entry.Role, "user", StringComparison.OrdinalIgnoreCase)).ToList()
            : history;

    /// The figure a reply states about a watch has to come from that watch's record.
    ///
    /// Grading 36 held-out replies found six claiming a spec the cards do not carry — "65+ hours
    /// power reserve" for a watch with 45, "integrated bracelet" for one on leather. The name
    /// checks above catch a watch that was never supplied; this catches the supplied watch
    /// described wrongly, which reads exactly as confidently.
    ///
    /// Only sentences that name a supplied watch are read, so general advice ("I would stay under
    /// 40 mm for a dress watch") is untouched, and a hedged figure is a judgement rather than a
    /// claim. Returns the offending claim, or null when every figure is supported.
    internal static string? UnsupportedSpecClaim(string message, List<string> context)
    {
        if (string.IsNullOrWhiteSpace(message) || context.Count == 0) return null;

        var watches = ParseWatchFacts(context);
        if (watches.Count == 0) return null;

        foreach (var sentence in Regex.Split(message, @"(?<=[.!?])\s+"))
        {
            foreach (Match match in _specClaimPattern.Matches(sentence))
            {
                if (IsHedged(sentence, match.Index)) continue;
                if (!double.TryParse(match.Groups["value"].Value.Replace(",", ""),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var value))
                    continue;

                // A figure describes the watch named before it. When the nearest name is one the
                // context never described — a figure inside a watch's own name, or a watch the name
                // checks above will deal with — there is nothing here to check it against.
                var subject = NearestNamedWatch(watches, sentence, match.Index);
                if (subject == null) continue;
                // A record with no figures at all cannot contradict anything: the catalogue does not
                // fill every field, and silence is not evidence against the sentence.
                if (subject.Value.Numbers.Count == 0 && subject.Value.Price == null) continue;

                var isPrice = match.Value.TrimStart().StartsWith('$');
                if (Supports(subject.Value, value, isPrice)) continue;
                return match.Value.Trim();
            }
        }

        return null;
    }

    // A figure with a unit a watch record can answer, or a price. Anything else in a sentence is
    // prose, not a claim: "the 1950s", "two complications", "36 of them".
    private static readonly Regex _specClaimPattern = new(
        @"\$\s?(?<value>\d[\d,]*(?:\.\d+)?)|(?<value>\d[\d,]*(?:\.\d+)?)\s*(?:mm|millimet(?:re|er)s?|metres?|meters?|\bm\b|bar|hours?|hrs?|\bh\b)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Words that turn a figure into a judgement. "around 40 mm" is advice about size; "40 mm" beside
    // a named watch is a statement about that watch.
    private static readonly Regex _hedgePattern = new(
        @"\b(?:under|below|over|above|around|about|roughly|approximately|nearly|almost|up\s+to|at\s+least|at\s+most|from|between|beyond|within|past|sub)\W{0,3}$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsHedged(string sentence, int index) =>
        _hedgePattern.IsMatch(sentence[..index]);

    /// The numbers a watch record can defend: everything in its Specs summary, plus its price.
    private readonly record struct WatchFacts(string Title, string Reference, List<double> Numbers, decimal? Price);

    private static List<WatchFacts> ParseWatchFacts(List<string> context)
    {
        var facts = new List<WatchFacts>();
        foreach (var entry in context)
        {
            var header = Regex.Match(entry, "^Watch \"(?<title>[^\"]+)\"");
            if (!header.Success) continue;

            var specs = Regex.Match(entry, @"Specs (?<specs>.*)$", RegexOptions.Singleline);
            var price = Regex.Match(entry, @"Price \$(?<price>[\d,]+(?:\.\d+)?)");
            var numbers = new List<double>();
            if (specs.Success)
            {
                foreach (Match number in Regex.Matches(specs.Groups["specs"].Value, @"\d+(?:\.\d+)?"))
                    if (double.TryParse(number.Value, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out var parsed))
                        numbers.Add(parsed);
            }

            var title = header.Groups["title"].Value;
            // A name can carry the size — "lineSport elegante 40mm Titalyt" — and quoting the name
            // back is not a claim about anything. The reference is dropped first: it is a string of
            // numbers that mean nothing, and leaving it in would let any figure through.
            var titleWithoutReference = string.Join(" ", title
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(word => !(Regex.IsMatch(word, @"\d") && Regex.IsMatch(word, @"[./-]"))));
            foreach (Match number in Regex.Matches(titleWithoutReference, @"\d+(?:\.\d+)?"))
                if (double.TryParse(number.Value, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var fromTitle))
                    numbers.Add(fromTitle);

            facts.Add(new WatchFacts(
                title,
                Regex.Match(title, @"\S*\d\S*").Value,
                numbers,
                price.Success && decimal.TryParse(price.Groups["price"].Value.Replace(",", ""),
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var parsedPrice)
                    ? parsedPrice
                    : null));
        }

        return facts;
    }

    /// The supplied watch named closest before this figure, or null when the figure follows no name
    /// the context describes.
    private static WatchFacts? NearestNamedWatch(List<WatchFacts> watches, string sentence, int index)
    {
        WatchFacts? nearest = null;
        var nearestAt = -1;
        foreach (var watch in watches)
        {
            var at = MentionIndex(sentence[..index], watch);
            if (at > nearestAt) { nearestAt = at; nearest = watch; }
        }

        return nearestAt >= 0 ? nearest : null;
    }

    /// Where the sentence last names this watch before a point, or -1.
    private static int MentionIndex(string upToFigure, WatchFacts watch)
    {
        var byReference = string.IsNullOrWhiteSpace(watch.Reference)
            ? -1
            : upToFigure.LastIndexOf(watch.Reference, StringComparison.OrdinalIgnoreCase);
        var tail = TitleTail(watch.Title);
        var byTitle = tail == null ? -1 : upToFigure.LastIndexOf(tail, StringComparison.OrdinalIgnoreCase);
        return Math.Max(byReference, byTitle);
    }

    private static string? TitleTail(string title)
    {
        var words = title.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(word => word.Length >= 4 && !Regex.IsMatch(word, @"\d"))
            .ToList();
        return words.Count == 0 ? null : string.Join(" ", words.TakeLast(2));
    }


    /// A figure is supported when the record carries it. A millimetre rounded in prose is still the
    /// same case, so unit figures allow a point of slack; a price does not.
    private static bool Supports(WatchFacts watch, double value, bool isPrice)
    {
        if (isPrice)
            return watch.Price != null && Math.Abs((double)watch.Price.Value - value) < 1
                   || watch.Numbers.Any(number => Math.Abs(number - value) < 0.001);

        return watch.Numbers.Any(number => Math.Abs(number - value) <= 1)
               || (watch.Price != null && Math.Abs((double)watch.Price.Value - value) < 1);
    }

    private static bool MentionsResolvedCatalogueEntity(string message, List<ChatWatchCard> watchCards)
    {
        var normalizedMessage = QueryNormalizer.NormalizeText(message);
        var candidates = watchCards
            .Take(3)
            .SelectMany(card => new[] { card.BrandName, card.CollectionName, card.Name })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => QueryNormalizer.NormalizeText(value!))
            .Where(value => value.Length >= 4)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        return candidates.Any(candidate => normalizedMessage.Contains(candidate, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<bool> MentionsUnsupportedResolvedEntitiesAsync(string message, ChatResolution resolution)
    {
        if (string.IsNullOrWhiteSpace(message) || resolution.WatchCards.Count == 0)
            return false;

        var normalizedMessage = QueryNormalizer.NormalizeText(message);
        if (string.IsNullOrWhiteSpace(normalizedMessage))
            return false;

        var allowedNames = resolution.WatchCards
            .SelectMany(card => new[] { card.BrandName, card.CollectionName, card.Name })
            .Concat(resolution.AllowedEntityNames)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => QueryNormalizer.NormalizeText(value!))
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
            .Select(name => QueryNormalizer.NormalizeText(name))
            .Where(name => name.Length >= 4)
            .Where(name => !_genericCollectionWords.Contains(name))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        if (knownNames.Any(name =>
                !allowedNames.Contains(name)
                && normalizedMessage.Contains(name, StringComparison.OrdinalIgnoreCase)))
            return true;

        return await MentionsWatchOutsideTheShortlistAsync(normalizedMessage, allowedNames);
    }

    /// True when the draft names a catalogue reference it was not given. Brands and collections were
    /// the only names checked, so a compare of two watches came back describing a third: the shown
    /// cards were right and the sentence was about something else, which also left that name without
    /// a link because there was nothing to link it to.
    private async Task<bool> MentionsWatchOutsideTheShortlistAsync(string normalizedMessage, HashSet<string> allowedNames)
    {
        var references = await _context.Watches
            .AsNoTracking()
            .Select(watch => watch.Name)
            .ToListAsync();

        foreach (var reference in references)
        {
            var name = QueryNormalizer.NormalizeText(reference);
            // Short references collide with ordinary words and with each other; a long one is
            // distinctive enough that finding it in the draft means the model wrote it.
            if (name.Length < 5 || allowedNames.Contains(name)) continue;
            // "5711" is inside "5711/1a-010": a draft naming the allowed watch must not be read as
            // naming a different one whose reference is a fragment of it.
            if (allowedNames.Any(allowed => allowed.Contains(name, StringComparison.OrdinalIgnoreCase))) continue;
            if (normalizedMessage.Contains(name, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    // Words that carry no request of their own once the watch has been named. Anything left
    // after these and the watch's own name is the user actually asking for something.
    private static readonly HashSet<string> _lookupFillerWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "a", "an", "this", "that", "it", "its", "of", "for", "on", "in", "with", "and",
        "or", "to", "is", "are", "was", "were", "be", "do", "does", "did", "please", "show",
        "me", "see", "find", "get", "look", "up", "watch", "watches", "timepiece", "model",
        "reference", "ref", "info", "details",
    };

    /// True when the message asks something beyond naming the watch. Structural, not semantic:
    /// it strips the resolved watch's own words and the filler that surrounds a bare lookup,
    /// and asks whether anything is left. A bare reference gets the deterministic card blurb,
    /// which is fast and free; a real question needs the model, which has the specs in context.
    internal static bool AsksBeyondNamingWatch(string? query, string watchName, string? brandName, string? collectionName)
    {
        if (string.IsNullOrWhiteSpace(query)) return false;

        var named = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in new[] { watchName, brandName, collectionName })
        {
            foreach (var token in QueryNormalizer.NormalizeText(source).Split(' ', StringSplitOptions.RemoveEmptyEntries))
                named.Add(token);
        }

        var remaining = QueryNormalizer.NormalizeText(query)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => !named.Contains(token) && !_lookupFillerWords.Contains(token))
            .ToList();

        // One stray token is more often a typo or a leftover fragment than a question; two is
        // a request. "5711 specs" reads as a lookup, "what movement does 5711 use" does not.
        return remaining.Count >= 2;
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

        // Naming a watch is not the same as asking about it. The blurb below answers "which
        // watch is this"; it cannot answer "what is the case made of", and returning it for
        // both left factual questions unanswered because the model was never called.
        var asksSomething = AsksBeyondNamingWatch(
            canonicalQuery, watch.Name, watch.Brand?.Name, watch.Collection?.Name);

        var resolution = new ChatResolution
        {
            Message = asksSomething
                ? ""
                : $"{watchLink} is the closest exact match in Tourbillon's catalogue. {place} and is listed at {FormatPrice(watch.CurrentPrice)}. If you want, Tourbillon can also compare it with another watch or help you explore adjacent models."
                    .Replace("  ", " "),
            UseAi = asksSomething,
            Query = canonicalQuery ?? watch.Name,
            WatchCards = [ToChatWatchCard(watch)],
            SessionState = BuildSessionStateFromWatches([watch], "watch_cards", canonicalQuery ?? watch.Name)
        };

        if (asksSomething)
            resolution.Context.Add(BuildWatchContext(watch));

        return resolution;
    }

    // Handles "Vacheron and A. Lange, which should I choose?" style queries.
    // Loads up to 3 watches per brand so the AI can introduce each maison and suggest a shortlist.
    private async Task<ChatResolution> BuildBrandDecisionResolutionAsync(string query, EntityMentions mentions)
    {
        var allModels = new List<Watch>();
        var brands = new List<Brand>();
        foreach (var brandRef in mentions.Brands.Take(3))
        {
            var brand = await _context.Brands.AsNoTracking().FirstOrDefaultAsync(b => b.Id == brandRef.Id);
            if (brand == null) continue;
            brands.Add(brand);

            var models = await _context.Watches
                .Include(w => w.Brand).Include(w => w.Collection)
                .AsNoTracking()
                .Where(w => w.BrandId == brandRef.Id)
                .OrderByDescending(w => w.CurrentPrice)
                .Take(3)
                .ToListAsync();
            allModels.AddRange(models);
        }

        if (allModels.Count == 0)
            return new ChatResolution
            {
                UseAi = true,
                Query = query,
                Context = ["No specific Tourbillon catalogue records were resolved. Respond as a helpful boutique concierge."]
            };

        var context = new List<string>
        {
            "Tourbillon resolved a two-brand decision query. Introduce each brand's character and signature style grounded in the supplied catalogue context and any secondary web notes. Then name one or two specific watches that best represent each brand at a practical buying level, and end with a short question that helps the user narrow their brief."
        };
        foreach (var brand in brands)
            context.Add(BuildBrandContext(brand));

        var collections = allModels
            .Where(w => w.Collection != null)
            .Select(w => w.Collection!)
            .GroupBy(c => c.Id).Select(g => g.First())
            .Take(4).ToList();
        foreach (var col in collections)
            context.Add(BuildCollectionContext(col));

        foreach (var w in allModels)
            context.Add(BuildWatchContext(w));

        var webQuery = brands.Count >= 2
            ? $"{brands[0].Name} vs {brands[1].Name} luxury watch"
            : brands.FirstOrDefault()?.Name;

        var allCards = allModels.Select(ToChatWatchCard).ToList();
        return new ChatResolution
        {
            UseAi = true,
            Query = query,
            Context = context,
            WatchCards = allCards,
            Actions = [],
            AllowWebEnrichment = true,
            WebQuery = webQuery,
            SessionState = new ChatSessionState
            {
                BrandIds = brands.Select(b => b.Id).ToList(),
                WatchSlugs = allCards.Select(c => c.Slug).Where(s => !string.IsNullOrWhiteSpace(s)).ToList(),
                FollowUpMode = "watch_cards",
                CanonicalQuery = query,
            }
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
                "Tourbillon resolved a collection-level comparison. Introduce each collection in your own concierge voice — explain what defines its character, history, and who it suits. Do not just repeat the supplied description; bring the collection to life. Draw on any secondary web notes for historical colour. Then pick two specific models from the surfaced watches that best illustrate the contrast between the collections and naturally suggest comparing them side by side. End with a short buying question."
            };
            foreach (var collection in collections)
                context.Add(BuildCollectionContext(collection));
            foreach (var brand in brands.Take(2))
                context.Add(BuildBrandContext(brand));
            foreach (var w in allModels)
                context.Add(BuildWatchContext(w));

            // Web enrichment: query the first collection by name for historical colour.
            var webQuery = collections.Count > 0
                ? $"{brands.FirstOrDefault()?.Name} {collections[0].Name} watch history"
                : null;

            var allCards = allModels.Select(ToChatWatchCard).ToList();
            return new ChatResolution
            {
                UseAi = true,
                Query = query,
                Context = context,
                WatchCards = allCards,
                Actions = [],
                AllowWebEnrichment = true,
                WebQuery = webQuery,
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
        // The pair is named in the instruction, not just supplied below it. The shortlist from the
        // previous turn is still in the session history, and "compare the second with the last" came
        // back comparing one of the two against a third watch the reader never asked about.
        var comparedTitles = string.Join(" and ", watches.Select(BuildWatchTitle));
        var concreteContext = new List<string>
        {
            $"Tourbillon resolved a concrete comparison set: {comparedTitles}. Compare exactly these"
            + " two and name no other watch, even if earlier messages mention one. Explain the main"
            + " split in practical buying terms, stay concise, end with a complete sentence, and"
            + " assume the compare view will open immediately with these exact watches preloaded."
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
        working = Regex.Replace(working, @"\b(?:versus|vs\.?|against|with)\b", "|", RegexOptions.IgnoreCase);
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

    // Ordinal words with acceptable edit distance for typo tolerance (covers up to DiscoveryCardLimit = 10).
    // "last" is intentionally excluded — it's a common English word (4 chars) where distance-1
    // neighbours like "list" are high-probability false positives.
    private static readonly string[] _ordinalWords =
    [
        "first",
        "second",
        "third",
        "fourth",
        "fifth",
        "sixth",
        "seventh",
        "eighth",
        "ninth",
        "tenth",
    ];

    // Replaces ordinal-like words that are within a small edit distance of a known ordinal with
    // the canonical spelling, so downstream regex matching handles "forth", "fith", "thrid",
    // and slightly noisier forms like "fisrt" / "forurth".
    private static string NormalizeOrdinalTypos(string query) =>
        Regex.Replace(query, @"\b[a-z]{3,9}\b",
            m =>
            {
                var word = m.Value.ToLowerInvariant();
                var bestMatch = m.Value;
                var bestDistance = int.MaxValue;
                foreach (var canonical in _ordinalWords)
                {
                    var maxDist = canonical.Length >= 5 ? 2 : 1;
                    if (word[0] != canonical[0]) continue;
                    if (maxDist > 1 && word[^1] != canonical[^1]) continue;
                    if (Math.Abs(word.Length - canonical.Length) > maxDist) continue;
                    var distance = EditDistance(word.AsSpan(), canonical.AsSpan());
                    if (distance > maxDist || distance >= bestDistance) continue;
                    bestDistance = distance;
                    bestMatch = canonical;
                }
                return bestMatch;
            },
            RegexOptions.IgnoreCase);

    // Wagner-Fischer edit distance — O(n*m) time, O(m) space using a single row and stackalloc.
    private static int EditDistance(ReadOnlySpan<char> a, ReadOnlySpan<char> b)
    {
        if (a.IsEmpty) return b.Length;
        if (b.IsEmpty) return a.Length;
        Span<int> row = stackalloc int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) row[j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            var prev = row[0];
            row[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var temp = row[j];
                row[j] = a[i - 1] == b[j - 1]
                    ? prev
                    : 1 + Math.Min(prev, Math.Min(row[j], row[j - 1]));
                prev = temp;
            }
        }
        return row[b.Length];
    }

    private static List<int> ExtractReferencedCardIndexes(string query, int totalCards)
    {
        if (totalCards < 2)
            return [];

        query = NormalizeOrdinalTypos(query);

        // "both" / "either" = first two cards; "all of them/those/these" = every card up to limit
        if (Regex.IsMatch(query, @"\bboth\b|\beither\b", RegexOptions.IgnoreCase))
            return [0, 1];
        if (Regex.IsMatch(query, @"\ball\b(?:\s+(?:of\s+)?(?:them|those|these))?", RegexOptions.IgnoreCase))
            return Enumerable.Range(0, Math.Min(totalCards, DiscoveryCardLimit)).ToList();

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
            (@"\bfirst\b",   _ => 0),
            (@"\bsecond\b",  _ => 1),
            (@"\bthird\b",   _ => 2),
            (@"\bfourth\b",  _ => 3),
            (@"\bfifth\b",   _ => 4),
            (@"\bsixth\b",   _ => 5),
            (@"\bseventh\b", _ => 6),
            (@"\beighth\b",  _ => 7),
            (@"\bninth\b",   _ => 8),
            (@"\btenth\b",   _ => 9),
            (@"\blast\b",    _ => totalCards - 1),
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

    // Watch-domain descriptor pattern used to detect complex queries that need WatchFinder.
    // Logic: strip entity names → if ANY remaining token matches a watch attribute → complex.
    // Inverse of a filler-word whitelist: unknown words (enlighten, guide, introduce) are safe
    // defaults and correctly fall to SQL rather than triggering an unnecessary LLM search.
    private static readonly Regex _watchDescriptorPattern = new(
        @"\b(?:" +
        // Style / occasion
        "dress|dressy|sport|sporty|casual|elegant|formal|classic|modern|vintage|bold|slim|thin|minimalist|" +
        "everyday|office|business|dinner|party|event|travel|weekend|adventure|outdoor|" +
        // Case material
        "gold|rose.?gold|yellow.?gold|white.?gold|platinum|steel|titanium|ceramic|bronze|carbon|" +
        // Strap / bracelet
        "leather|rubber|nato|fabric|bracelet|integrated|" +
        // Complications / movement
        "chronograph|tourbillon|perpetual|annual|moonphase|moon.phase|gmt|world.?time|alarm|" +
        "minute.?repeater|flyback|rattrapante|skeleton|open.?heart|automatic|manual|quartz|solar|" +
        // Size / physical
        "small|large|big|compact|oversize|oversized|mm|diameter|thick|" +
        // Water resistance / activity
        "dive|diver|diving|swim|swimming|waterproof|water.?resist|depth|" +
        // Price signals
        @"under|below|above|budget|affordable|cheap|expensive|\$|usd|eur|gbp|" +
        // Colour
        "blue|black|white|green|grey|gray|silver|brown|red|orange|yellow|dial|" +
        // Generic attribute request words that imply filtering
        "best|top|popular|iconic|rare|limited|new|latest|cheapest|priciest" +
        @")\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Matches `[outer-before[inner](inner-url)outer-after](outer-url)` — nested markdown links
    // the prompt forbids but the LLM occasionally still emits. We unwrap by keeping the outer
    // link destination and inlining the inner link's label as plain text.
    private static readonly Regex _nestedMarkdownLinkPattern = new(
        @"\[([^\[\]]*?)\[([^\[\]]+)\]\(([^)]+)\)([^\[\]]*?)\]\(([^)]+)\)",
        RegexOptions.Compiled);

    // Safety net for nested markdown links that survive the prompt rule. Standard markdown
    // renderers break on link-inside-link syntax, so we collapse them before saving history
    // or returning to the client. Loops because one pass may reveal further nesting.
    private static readonly Regex _markdownLinkPattern = new(@"\[[^\]]*\]\([^)]*\)", RegexOptions.Compiled);

    // How many links one reply may carry, so a short answer does not read as a list of links.
    private const int MaxWatchLinks = 3;
    private const int MaxEntityLinks = 2;

    /// The wording layer names watches, brands and collections in plain words and the links are added
    /// here, from the slugs the backend already resolved. A markdown link costs the model around 40
    /// tokens on a URL the reader never sees, which is what pushed replies into their token ceiling.
    /// Only the first mention of each destination is linked, and never inside an existing link.
    internal static string LinkCatalogueNames(string message, List<ChatWatchCard> cards, List<string> context)
    {
        if (string.IsNullOrWhiteSpace(message)) return message;

        var linked = message;
        var watches = 0;
        var entities = 0;

        foreach (var (phrases, href, isWatch) in BuildCatalogueLinkTargets(cards, context))
        {
            if (isWatch ? watches >= MaxWatchLinks : entities >= MaxEntityLinks) continue;
            // The model may still have written this link itself; one destination is linked once.
            if (linked.Contains($"]({href})", StringComparison.OrdinalIgnoreCase)) continue;

            foreach (var phrase in phrases)
            {
                if (!TryLinkFirstMention(ref linked, phrase, href)) continue;
                if (isWatch) watches++; else entities++;
                break;
            }
        }

        return linked;
    }

    /// Link destinations for this reply, longest phrase first so "Omega Seamaster Diver 300M" is
    /// matched before "Omega". Watches come from the cards and from the context entries, because a
    /// reply can name a watch the backend did not surface as a card.
    private static List<(List<string> Phrases, string Href, bool IsWatch)> BuildCatalogueLinkTargets(
        List<ChatWatchCard> cards,
        List<string> context)
    {
        var targets = new List<(List<string> Phrases, string Href, bool IsWatch)>();
        var seenHrefs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddTarget(IEnumerable<string?> phrases, string href, bool isWatch)
        {
            if (string.IsNullOrWhiteSpace(href) || !seenHrefs.Add(href)) return;
            var usable = phrases
                .Where(phrase => !string.IsNullOrWhiteSpace(phrase))
                .Select(phrase => Regex.Replace(phrase!, @"\s+", " ").Trim())
                .Where(phrase => phrase.Length >= 4)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(phrase => phrase.Length)
                .ToList();
            if (usable.Count > 0)
                targets.Add((usable, href, isWatch));
        }

        foreach (var card in cards)
        {
            if (string.IsNullOrWhiteSpace(card.Slug)) continue;
            AddTarget(WatchPhrases(card.BrandName, card.CollectionName, card.Name, BuildWatchCardTitle(card)), $"/watches/{card.Slug}", true);
        }

        // Context entries carry their own slugs: "Watch "…" (Slug: …)".
        foreach (var item in context)
        {
            var watch = Regex.Match(item, "Watch \"([^\"]+)\" \\(Slug: ([\\w-]+)\\)");
            if (watch.Success)
                AddTarget([watch.Groups[1].Value], $"/watches/{watch.Groups[2].Value}", true);
        }

        foreach (var card in cards)
        {
            if (!string.IsNullOrWhiteSpace(card.CollectionSlug))
                AddTarget([card.CollectionName], $"/collections/{card.CollectionSlug}", false);
            if (!string.IsNullOrWhiteSpace(card.BrandSlug))
                AddTarget([card.BrandName], $"/brands/{card.BrandSlug}", false);
        }

        foreach (var item in context)
        {
            var collection = Regex.Match(item, "Collection \"([^\"]+)\" \\(Slug: ([\\w-]+)\\)");
            if (collection.Success)
                AddTarget([collection.Groups[1].Value], $"/collections/{collection.Groups[2].Value}", false);

            var brand = Regex.Match(item, "Brand \"([^\"]+)\" \\(Slug: ([\\w-]+)\\)");
            if (brand.Success)
                AddTarget([brand.Groups[1].Value], $"/brands/{brand.Groups[2].Value}", false);
        }

        return targets;
    }

    /// The ways a reply is likely to name one watch: the full title, and the same without the
    /// reference number, which is how a person says it ("the Omega Seamaster Diver 300M").
    private static IEnumerable<string?> WatchPhrases(string? brand, string? collection, string name, string cardTitle)
    {
        var tail = Regex.Replace(name, @"^\S*\d\S*\s+", "").Trim();
        yield return cardTitle;
        yield return $"{brand} {collection} {name}";
        yield return $"{collection} {name}";
        yield return $"{brand} {name}";
        if (!string.IsNullOrWhiteSpace(tail) && !string.Equals(tail, name, StringComparison.OrdinalIgnoreCase))
        {
            yield return $"{brand} {collection} {tail}";
            yield return $"{collection} {tail}";
        }

        // A catalogue name can carry a model word after the reference — "4200H/222A-B934 222" — and a
        // reply names the reference alone. Without these the whole watch went unlinked and the brand
        // and collection were linked separately instead, which reads as two chips for one watch.
        var reference = Regex.Match(name, @"^\S*\d\S*").Value;
        if (!string.IsNullOrWhiteSpace(reference) && !string.Equals(reference, name, StringComparison.OrdinalIgnoreCase))
        {
            yield return $"{brand} {collection} {reference}";
            yield return $"{collection} {reference}";
            yield return $"{brand} {reference}";
        }

        yield return name;
    }

    /// "[Rolex](/brands/rolex) [Datejust](/collections/rolex-datejust)" reads as two chips for one
    /// thing. When the collection belongs to the brand beside it, the pair becomes a single link to
    /// the collection, which is where a reader who clicks either half wants to land.
    internal static string MergeBrandIntoCollectionLink(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return message;

        return Regex.Replace(
            message,
            @"\[(?<brand>[^\]]+)\]\(/brands/(?<brandSlug>[\w-]+)\)\s+\[(?<collection>[^\]]+)\]\(/collections/(?<collectionSlug>[\w-]+)\)",
            match => match.Groups["collectionSlug"].Value.StartsWith(
                         match.Groups["brandSlug"].Value + "-", StringComparison.OrdinalIgnoreCase)
                ? $"[{match.Groups["brand"].Value} {match.Groups["collection"].Value}](/collections/{match.Groups["collectionSlug"].Value})"
                : match.Value);
    }

    /// Wraps the first mention of a phrase that is not already inside a link. Returns false when the
    /// reply never names it, which is the normal case for most of the shortlist.
    private static bool TryLinkFirstMention(ref string message, string phrase, string href)
    {
        // Emphasis may sit between the words: the model writes "**Omega De Ville** 435.13 Trésor", and
        // matching the words only would link the brand, the collection and the reference as three chips
        // in a row. The markers are dropped from the label, since a link is already styled.
        var words = phrase.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Regex.Escape);
        var pattern = new Regex($@"(?<![\w\-/])({string.Join(@"[\s*_]+", words)})(?![\w\-])", RegexOptions.IgnoreCase);
        var existing = _markdownLinkPattern.Matches(message);

        foreach (Match match in pattern.Matches(message))
        {
            if (existing.Any(link => match.Index >= link.Index && match.Index < link.Index + link.Length))
                continue;

            var label = Regex.Replace(match.Value, @"[*_]+", " ");
            label = Regex.Replace(label, @"\s+", " ").Trim();
            message = string.Concat(
                message.AsSpan(0, match.Index),
                $"[{label}]({href})",
                message.AsSpan(match.Index + match.Length));
            return true;
        }

        return false;
    }

    private static string UnwrapNestedMarkdownLinks(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return message;
        string previous;
        var current = message;
        do
        {
            previous = current;
            current = _nestedMarkdownLinkPattern.Replace(current, "[$1$2$4]($5)");
        } while (!ReferenceEquals(current, previous) && current != previous);
        return current;
    }

    // Structured response from the ai-service /route endpoint.
    private sealed record RouteResult(string Route, double Confidence, bool Fallback = false);

    // Returns true when the query names only a brand/collection with no descriptive attributes.
    // Primary path: calls POST /route on ai-service which uses embedding cosine similarity to
    // classify the query against example utterances (same concept as semantic-router by Aurelio AI).
    // Fallback: _watchDescriptorPattern regex blacklist when the route endpoint is unreachable.
    //
    // Examples: "suggest me some Patek Philippe"  → true  (SQL — pure brand browse)
    //           "enlighten me about Grand Seiko"  → true  (SQL — "enlighten" has no descriptor)
    //           "Patek Philippe dress watch"       → false (WatchFinder — "dress" is a descriptor)
    //           "something elegant from Vacheron"  → false (WatchFinder — "elegant" is a descriptor)
    private async Task<bool> IsSimpleBrandQueryAsync(string query, EntityMentions mentions)
    {
        // Must have at least one known entity to route to SQL.
        if (!mentions.Brands.Any() && !mentions.Collections.Any()) return false;

        try
        {
            var httpClient = _httpClientFactory.CreateClient("ai-service");
            var resp = await StageTimings.TimeAsync("route", () => httpClient.PostAsJsonAsync("/route", new { query }));
            if (resp.IsSuccessStatusCode)
            {
                var result = await resp.Content.ReadFromJsonAsync<RouteResult>(_jsonOptions);
                if (result != null)
                    return string.Equals(result.Route, "simple_brand", StringComparison.OrdinalIgnoreCase);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug("Route endpoint unavailable, using regex fallback: {Error}", ex.Message);
        }

        // Fallback: descriptor blacklist (handles cases where ai-service is not yet warm).
        return IsSimpleBrandQuery(query, mentions);
    }

    // Synchronous descriptor-blacklist check — used as fallback by IsSimpleBrandQueryAsync.
    private static bool IsSimpleBrandQuery(string query, EntityMentions mentions)
    {
        if (!mentions.Brands.Any() && !mentions.Collections.Any()) return false;

        var stripped = query;
        foreach (var b in mentions.Brands)
            stripped = Regex.Replace(stripped, Regex.Escape(b.Name), " ", RegexOptions.IgnoreCase);
        foreach (var c in mentions.Collections)
            stripped = Regex.Replace(stripped, Regex.Escape(c.Name), " ", RegexOptions.IgnoreCase);

        return !_watchDescriptorPattern.IsMatch(stripped);
    }

    // Pure SQL catalogue sample — no embeddings, no LLM, no Hangfire jobs.
    // Ordered by price descending so the most prominent/prestigious models surface first.
    private async Task<List<Watch>> GetCatalogueSampleAsync(
        int? brandId,
        int? collectionId,
        List<int> excludedBrandIds,
        int limit = 6)
    {
        var q = _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsQueryable();

        if (brandId.HasValue)            q = q.Where(w => w.BrandId == brandId.Value);
        if (collectionId.HasValue)       q = q.Where(w => w.CollectionId == collectionId.Value);
        if (excludedBrandIds.Count > 0)  q = q.Where(w => !excludedBrandIds.Contains(w.BrandId));

        return await q
            .OrderByDescending(w => w.CurrentPrice)
            .Take(limit)
            .AsNoTracking()
            .ToListAsync();
    }

    // True when the classifier (cached in _lastClassification from the current request)
    // resolved the message to the given intent at or above minConfidence. Returns false
    // when the classifier hasn't run yet — callers then fall back to their regex body.
    private bool ClassifierMatches(string intent, double minConfidence = 0.6)
    {
        var c = _lastClassification;
        return c is not null
            && string.Equals(c.Intent, intent, StringComparison.OrdinalIgnoreCase)
            && c.Confidence >= minConfidence;
    }

    private bool ClassifierMatchesAny(params string[] intents) =>
        intents.Any(intent => ClassifierMatches(intent));

    // Detects refinement queries that contain only price/budget signals — no watch vocabulary.
    // Used to keep pure price follow-ups ("under 10k", "what about 20,000?") in the discovery
    // flow when the user is already mid-session, rather than routing them to the AI with no context.
    private static bool LooksLikePriceFollowUp(string query) =>
        Regex.IsMatch(query,
            @"\b(?:under|below|above|over|around|budget|price|cost|between|cheap|affordable|expensive|luxury)\b"
            + @"|\b\d[\d,]*\s*(?:k|000)?\b",
            RegexOptions.IgnoreCase);

    // Detects style-shift follow-ups like "something dressier", "how about a dress watch",
    // "more formal". Used alongside LooksLikePriceFollowUp to keep mid-session style
    // queries in the discovery/revision flow instead of falling through to ai_fallback.
    private static bool LooksLikeStyleFollowUp(string query) =>
        Regex.IsMatch(query,
            @"\b(?:dressier|sportier|fancier|classier|simpler|bolder|slimmer|dressy|sporty|formal|casual|elegant|refined|classic|modern|artistic|luxurious)"
            + @"|(?:something|how about|what about)\s+(?:more\s+)?(?:dressy|sporty|formal|casual|elegant|refined|classic|modern|artistic|luxurious|simple|bold|slim)\b",
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

    // Validates planner output against the actual watch cards and primary actions.
    // Drops any chip whose slugs/hrefs were hallucinated, dedupes near-duplicates,
    // and caps the list at 3. Returns an empty list when nothing is usable — the
    // caller falls back to the deterministic rule tree so zero regression is guaranteed.
    private static List<ChatAction> MergeSuggestedActions(
        IReadOnlyList<PlannedAction>? plannedActions,
        List<ChatWatchCard> watchCards,
        List<ChatAction> primaryActions)
    {
        if (plannedActions == null || plannedActions.Count == 0)
            return [];

        var cardSlugs = new HashSet<string>(
            watchCards.Select(c => c.Slug ?? "").Where(s => !string.IsNullOrEmpty(s)),
            StringComparer.OrdinalIgnoreCase);
        var brandSlugs = new HashSet<string>(
            watchCards.Select(c => c.BrandSlug ?? "").Where(s => !string.IsNullOrEmpty(s)),
            StringComparer.OrdinalIgnoreCase);
        var collectionSlugs = new HashSet<string>(
            watchCards.Select(c => c.CollectionSlug ?? "").Where(s => !string.IsNullOrEmpty(s)),
            StringComparer.OrdinalIgnoreCase);

        var primaryFingerprints = new HashSet<string>(
            primaryActions.Select(ChipFingerprint),
            StringComparer.OrdinalIgnoreCase);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var merged = new List<ChatAction>();
        foreach (var planned in plannedActions)
        {
            if (merged.Count >= 3) break;

            var chip = ConvertPlannedAction(planned, cardSlugs, brandSlugs, collectionSlugs, watchCards);
            if (chip == null) continue;

            var fp = ChipFingerprint(chip);
            if (primaryFingerprints.Contains(fp)) continue;
            if (!seen.Add(fp)) continue;

            merged.Add(chip);
        }

        return merged;
    }

    private static ChatAction? ConvertPlannedAction(
        PlannedAction planned,
        HashSet<string> cardSlugs,
        HashSet<string> brandSlugs,
        HashSet<string> collectionSlugs,
        List<ChatWatchCard> watchCards)
    {
        var label = (planned.Label ?? "").Trim();
        switch ((planned.Type ?? "").Trim().ToLowerInvariant())
        {
            case "compare":
            {
                var slugs = (planned.Slugs ?? [])
                    .Where(s => !string.IsNullOrWhiteSpace(s) && cardSlugs.Contains(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(2)
                    .ToList();
                if (slugs.Count < 2) return null;

                var a = watchCards.First(c => string.Equals(c.Slug, slugs[0], StringComparison.OrdinalIgnoreCase));
                var b = watchCards.First(c => string.Equals(c.Slug, slugs[1], StringComparison.OrdinalIgnoreCase));
                label = BuildCompareChipLabel(a, b);
                return new ChatAction { Type = "compare", Label = label, Slugs = slugs };
            }
            // A planned "search" falls through to the default and is dropped. The concierge has already
            // answered the brief, so its follow-ups point at watches, brands and collections; whether a
            // Smart Search chip belongs is decided by the message alone (ReadsAsSmartSearchQuery).
            case "navigate":
            {
                var href = (planned.Href ?? "").Trim();
                if (string.IsNullOrEmpty(href)) return null;

                // Only accept navigate chips that target brand/collection slugs in the visible cards.
                // Anything else (arbitrary route) gets dropped as a safety measure.
                var parts = href.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
                var isBrand = parts.Length == 2 && parts[0] == "brands" && brandSlugs.Contains(parts[1]);
                var isCollection = parts.Length == 2 && parts[0] == "collections" && collectionSlugs.Contains(parts[1]);
                if (!isBrand && !isCollection) return null;

                if (string.IsNullOrEmpty(label))
                {
                    if (isBrand)
                    {
                        var brand = watchCards.First(c => string.Equals(c.BrandSlug, parts[1], StringComparison.OrdinalIgnoreCase));
                        label = $"Tell me more about {brand.BrandName}";
                    }
                    else
                    {
                        var coll = watchCards.First(c => string.Equals(c.CollectionSlug, parts[1], StringComparison.OrdinalIgnoreCase));
                        label = $"Explore the {FormatCollectionChipName(coll.CollectionName, coll.BrandName)} collection";
                    }
                }
                return new ChatAction { Type = "navigate", Label = label, Href = "/" + string.Join('/', parts) };
            }
            default:
                return null;
        }
    }

    // Stable dedup key across primary and planner chips so they do not collide.
    private static string ChipFingerprint(ChatAction action)
    {
        var type = (action.Type ?? "").Trim().ToLowerInvariant();
        return type switch
        {
            "compare" => "compare|" + string.Join(",", (action.Slugs ?? []).OrderBy(s => s, StringComparer.OrdinalIgnoreCase)),
            "search"  => "search|" + (action.Query ?? "").Trim().ToLowerInvariant(),
            "navigate" => "navigate|" + (action.Href ?? "").Trim().ToLowerInvariant(),
            "set_cursor" => "set_cursor|" + (action.Cursor ?? "").Trim().ToLowerInvariant(),
            _ => type + "|" + (action.Label ?? "").Trim().ToLowerInvariant(),
        };
    }

    // Assembles the planner payload: query + already-drafted intent + visible cards +
    // rejected brands (session-persisted) so the LLM can steer around them.
    private async Task<IReadOnlyList<PlannedAction>> PlanSuggestedActionsAsync(
        ChatResolution resolution,
        string message,
        List<ChatWatchCard> watchCards,
        List<ChatAction> primaryActions,
        ChatSessionState? sessionState)
    {
        try
        {
            var input = await BuildPlannerInputAsync(resolution, message, watchCards, primaryActions, sessionState);
            return await _planner.PlanAsync(input);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Planner suggestion build failed");
            return Array.Empty<PlannedAction>();
        }
    }

    private async Task<PlanActionsInput> BuildPlannerInputAsync(
        ChatResolution resolution,
        string message,
        List<ChatWatchCard> watchCards,
        List<ChatAction> primaryActions,
        ChatSessionState? sessionState)
    {
        var rejectedSlugs = Array.Empty<string>() as IReadOnlyList<string>;
        var excludedIds = sessionState?.ExcludedBrandIds;
        if (excludedIds != null && excludedIds.Count > 0)
        {
            var slugs = await _context.Brands
                .Where(b => excludedIds.Contains(b.Id) && b.Slug != null)
                .Select(b => b.Slug!)
                .ToListAsync();
            if (slugs.Count > 0) rejectedSlugs = slugs;
        }

        var primaryTypes = primaryActions
            .Select(a => (a.Type ?? "").Trim().ToLowerInvariant())
            .Where(t => t.Length > 0)
            .Distinct()
            .ToList();

        return new PlanActionsInput
        {
            Query = message,
            AssistantReply = resolution.Message ?? "",
            Intent = _lastClassification?.Intent ?? "unclear",
            PrimaryActionTypes = primaryTypes,
            WatchCards = watchCards,
            RejectedBrandSlugs = rejectedSlugs,
        };
    }

    private static bool IsExplicitCompareQuery(string query) =>
        Regex.IsMatch(query,
            @"\b(?:compare|versus|vs\.?|against|difference between|which should i buy|should i buy| or )\b",
            RegexOptions.IgnoreCase);

    // Detects decision-intent queries where the user mentions 2+ brands and is asking for a recommendation.
    // Used to route to BuildBrandDecisionResolutionAsync instead of WatchFinder discovery.
    private static bool LooksLikeBrandDecisionRequest(string query) =>
        Regex.IsMatch(query,
            @"\b(?:which should i (?:choose|get|buy|pick)|what should i (?:choose|get|buy|pick)|help me (?:choose|decide)|which is better|which one|recommend me|suggest me|for me|what do you (?:recommend|think|suggest))\b",
            RegexOptions.IgnoreCase);

    private static bool IsAbusiveQuery(string query) =>
        Regex.IsMatch(query,
            @"\b(?:fuck|shit|bitch|slut|cunt|retard|idiot|moron|stupid|nigger|faggot|kill yourself|rape)\b",
            RegexOptions.IgnoreCase);

    // Deterministic early-exit for obviously off-topic queries that would otherwise gain
    // spurious watch-domain signals (e.g. "watch" keyword, fuzzy collection name matches).
    private static bool IsObviouslyOffTopicQuery(string query) =>
        // Translation requests: "translate X into Japanese / French / ..."
        Regex.IsMatch(query,
            @"\b(?:translate|translation)\b.{0,80}\b(?:into|in|to)\b.{0,30}\b(?:japanese|french|spanish|german|chinese|korean|italian|portuguese|arabic|dutch|russian|hindi|latin)\b",
            RegexOptions.IgnoreCase | RegexOptions.Singleline)
        // Clear programming language keywords — never appear in watch copy
        || Regex.IsMatch(query,
            @"\b(?:python|javascript|typescript|golang|kotlin|perl|haskell|scala)\b",
            RegexOptions.IgnoreCase)
        // Explicit code/script creation in any language
        || Regex.IsMatch(query,
            @"\b(?:write|create|build|generate)\s+(?:a\s+|me\s+a\s+|me\s+)?(?:python|javascript|bash|shell|code)\s+(?:script|program|function|snippet)\b",
            RegexOptions.IgnoreCase);

    private static int CountWords(string query) =>
        Regex.Matches(query, @"\b[\w'-]+\b").Count;

    private static NormalizedUserQuery NormalizeUserQuery(string query)
    {
        var repairedQuery = QueryNormalizer.ExpandCompoundTerms(query);
        var repairNotes = new List<string>();

        if (!string.Equals(repairedQuery, query, StringComparison.Ordinal))
            repairNotes.Add("compound_watch_terms");

        var ordinalFixed = NormalizeOrdinalTypos(repairedQuery);
        if (!string.Equals(ordinalFixed, repairedQuery, StringComparison.Ordinal))
        {
            repairedQuery = ordinalFixed;
            repairNotes.Add("ordinal_typos");
        }

        return new NormalizedUserQuery
        {
            RawQuery = query,
            RepairedQuery = repairedQuery,
            RepairNotes = repairNotes,
        };
    }

    private static List<Brand> ResolveFuzzyBrands(string query, List<Brand> brands)
    {
        var normalizedQuery = QueryNormalizer.NormalizeText(query);
        if (string.IsNullOrWhiteSpace(normalizedQuery))
            return [];

        var queryTokens = normalizedQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (queryTokens.Length == 0)
            return [];

        var candidates = new List<(Brand Brand, int Distance, int TokenCount)>();
        foreach (var brand in brands)
        {
            var normalizedBrand = QueryNormalizer.NormalizeText(brand.Name);
            if (string.IsNullOrWhiteSpace(normalizedBrand) || normalizedQuery.Contains(normalizedBrand, StringComparison.OrdinalIgnoreCase))
                continue;

            var compactBrand = normalizedBrand.Replace(" ", "", StringComparison.Ordinal);
            if (compactBrand.Length < 5)
                continue;

            var bestDistance = int.MaxValue;
            var bestTokenCount = int.MaxValue;
            var brandTokenCount = normalizedBrand.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            var minWindowSize = Math.Max(1, brandTokenCount - 1);
            var maxWindowSize = Math.Min(queryTokens.Length, brandTokenCount + 1);
            var maxDistance = compactBrand.Length >= 14 ? 3 : 2;

            for (var size = minWindowSize; size <= maxWindowSize; size++)
            {
                for (var start = 0; start <= queryTokens.Length - size; start++)
                {
                    var window = string.Join(" ", queryTokens.Skip(start).Take(size));
                    var compactWindow = window.Replace(" ", "", StringComparison.Ordinal);
                    if (compactWindow.Length < 4 || Math.Abs(compactWindow.Length - compactBrand.Length) > maxDistance)
                        continue;

                    var distance = EditDistance(compactWindow.AsSpan(), compactBrand.AsSpan());
                    if (distance > maxDistance)
                        continue;

                    if (distance < bestDistance || (distance == bestDistance && size < bestTokenCount))
                    {
                        bestDistance = distance;
                        bestTokenCount = size;
                    }
                }
            }

            if (bestDistance != int.MaxValue)
                candidates.Add((brand, bestDistance, bestTokenCount));
        }

        return candidates
            .OrderBy(candidate => candidate.Distance)
            .ThenBy(candidate => candidate.TokenCount)
            .ThenByDescending(candidate => candidate.Brand.Name.Length)
            .Take(2)
            .Select(candidate => candidate.Brand)
            .ToList();
    }

    private static string CanonicalizeQueryForRouting(string query, EntityMentions mentions)
    {
        if (string.IsNullOrWhiteSpace(query))
            return query;

        var canonicalQuery = QueryNormalizer.ExpandCompoundTerms(NormalizeOrdinalTypos(query));
        foreach (var brand in mentions.Brands.OrderByDescending(brand => brand.Name.Length))
        {
            var aliases = QueryNormalizer.BrandAliases
                .Where(alias =>
                    LooksLikeBrandAcronymAlias(alias.Key)
                    && string.Equals(
                        QueryNormalizer.NormalizeText(alias.Value),
                        QueryNormalizer.NormalizeText(brand.Name),
                        StringComparison.OrdinalIgnoreCase))
                .Select(alias => alias.Key)
                .Where(alias => !string.Equals(alias, brand.Name, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(alias => alias.Length);

            foreach (var alias in aliases)
                canonicalQuery = Regex.Replace(canonicalQuery, $@"\b{Regex.Escape(alias)}\b", brand.Name, RegexOptions.IgnoreCase);
        }

        var normalizedCanonicalQuery = QueryNormalizer.NormalizeText(canonicalQuery);
        foreach (var brand in mentions.Brands.OrderByDescending(brand => brand.Name.Length))
        {
            var normalizedBrandName = QueryNormalizer.NormalizeText(brand.Name);
            if (string.IsNullOrWhiteSpace(normalizedBrandName)
                || normalizedCanonicalQuery.Contains(normalizedBrandName, StringComparison.OrdinalIgnoreCase))
                continue;

            canonicalQuery = $"{canonicalQuery.Trim()} {brand.Name}".Trim();
            normalizedCanonicalQuery = QueryNormalizer.NormalizeText(canonicalQuery);
        }

        foreach (var collection in mentions.Collections.OrderByDescending(collection => collection.Name.Length))
        {
            var normalizedCollectionName = QueryNormalizer.NormalizeText(collection.Name);
            if (string.IsNullOrWhiteSpace(normalizedCollectionName)
                || normalizedCanonicalQuery.Contains(normalizedCollectionName, StringComparison.OrdinalIgnoreCase))
                continue;

            canonicalQuery = $"{canonicalQuery.Trim()} {collection.Name}".Trim();
            normalizedCanonicalQuery = QueryNormalizer.NormalizeText(canonicalQuery);
        }

        return canonicalQuery;
    }

    private static bool LooksLikeBrandAcronymAlias(string alias)
    {
        var lettersOnly = new string(alias.Where(char.IsLetter).ToArray());
        return lettersOnly.Length is >= 2 and <= 4
            && lettersOnly.All(char.IsUpper);
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
        var brandSlug = watch.Brand?.Slug ?? "";
        var collectionName = watch.Collection?.Name ?? "";
        var collectionSlug = watch.Collection?.Slug ?? "";
        // Include brand and collection slugs so the AI can generate pill links
        // in the format [Name](/brands/{slug}) and [Name](/collections/{slug}).
        var brandRef = string.IsNullOrWhiteSpace(brandSlug) ? brandName : $"{brandName} (Slug: {brandSlug})";
        var collectionRef = string.IsNullOrWhiteSpace(collectionSlug) ? collectionName : $"{collectionName} (Slug: {collectionSlug})";
        return $"Watch \"{BuildWatchTitle(watch)}\" (Slug: {watch.Slug}): Brand {brandRef}; Collection {collectionRef}; Price {FormatPrice(watch.CurrentPrice)}; Description {Summarise(watch.Description)}; Specs {BuildChatSpecs(watch.Specs)}";
    }

    // Roughly the length of two sentences. The model's job here is wording, not reproducing
    // the catalogue, and the editorial copy runs to ~370 characters per watch — sent for ten
    // cards on every turn, that is a large share of the request for prose nobody quotes back.
    private const int ChatDescriptionLimit = 180;

    /// Trims editorial copy to its opening sentences, cutting on a sentence boundary so the
    /// model never sees a fragment that ends mid-clause.
    internal static string Summarise(string? description)
    {
        if (string.IsNullOrWhiteSpace(description)) return "";
        var text = description.Trim();
        if (text.Length <= ChatDescriptionLimit) return text;

        var cut = text.LastIndexOfAny(['.', '!', '?'], Math.Min(ChatDescriptionLimit, text.Length - 1));
        return cut > 40 ? text[..(cut + 1)] : text[..ChatDescriptionLimit].TrimEnd() + "…";
    }

    /// The specification fields a buyer actually asks about, as a short phrase instead of the
    /// stored JSON. The raw blob averages 758 characters per watch and carries caliber names,
    /// beat rates, jewel counts and clasp types that never appear in an answer; keeping the
    /// fields that do appear preserves what the model can be asked while cutting the rest.
    internal static string BuildChatSpecs(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return "";
        WatchSpecs? specs;
        try { specs = System.Text.Json.JsonSerializer.Deserialize<WatchSpecs>(specsJson); }
        catch (System.Text.Json.JsonException) { return ""; }
        if (specs == null) return "";

        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(specs.Case?.Material))        parts.Add(specs.Case.Material!);
        if (!string.IsNullOrWhiteSpace(specs.Case?.Diameter))        parts.Add(specs.Case.Diameter!);
        if (!string.IsNullOrWhiteSpace(specs.Case?.WaterResistance)) parts.Add($"water resistance {specs.Case.WaterResistance}");
        if (!string.IsNullOrWhiteSpace(specs.Dial?.Color))           parts.Add($"{specs.Dial.Color} dial");
        if (!string.IsNullOrWhiteSpace(specs.Movement?.Type))        parts.Add(specs.Movement.Type!);
        if (!string.IsNullOrWhiteSpace(specs.Movement?.PowerReserve)) parts.Add($"power reserve {specs.Movement.PowerReserve}");
        if (specs.Movement?.Functions is { Count: > 0 } functions)   parts.Add(string.Join(", ", functions.Take(6)));
        if (!string.IsNullOrWhiteSpace(specs.Strap?.Material))       parts.Add(specs.Strap.Material!);

        return string.Join("; ", parts);
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

    private static string BuildWatchCardTitle(ChatWatchCard card)
    {
        var prefix = !LooksLikeEditorialDescription(card.Description)
            ? card.Description!.Trim()
            : string.Join(" ", new[] { card.BrandName, card.CollectionName }.Where(value => !string.IsNullOrWhiteSpace(value)));
        if (string.IsNullOrWhiteSpace(prefix))
            return card.Name;

        return prefix.Contains(card.Name, StringComparison.OrdinalIgnoreCase)
            ? prefix
            : $"{prefix} {card.Name}".Trim();
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

    // Smart Search reads filters (brand, collection, price, size, material, movement, dial, style) and
    // answers a brief such as "what should I wear to my wedding" with an empty page. Whoever asks that
    // came to the concierge so as not to search, so the chip is offered only when Smart Search can read a
    // filter from the message itself. Same rules Smart Search parses with, and no model.
    internal static bool ReadsAsSmartSearchQuery(string message, bool namesBrandOrCollection)
    {
        if (namesBrandOrCollection) return true;
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(message, intent);
        return intent.HasAnyFilter();
    }

    private static string BuildSmartSearchQuery(string originalQuery, List<Watch> ordered, EntityMentions? mentions = null)
    {
        if (ordered.Count == 0)
            return CleanSmartSearchText(originalQuery);

        return BuildSmartSearchQuery(
            originalQuery,
            mentions?.Brands.Where(brand => !string.IsNullOrWhiteSpace(brand.Name)).Select(brand => brand.Name).ToList() ?? [],
            mentions?.Collections.Where(collection => !string.IsNullOrWhiteSpace(collection.Name)).Select(collection => collection.Name).ToList() ?? [],
            ordered.Where(w => !string.IsNullOrWhiteSpace(w.Brand?.Name)).Select(w => w.Brand!.Name).ToList(),
            ordered.Where(w => !string.IsNullOrWhiteSpace(w.Collection?.Name)).Select(w => w.Collection!.Name).ToList());
    }

    // The brief in the user's own words, with the ask stripped and the resolved brand and collection
    // names lifted to the front in their catalogue spelling. Requested names are the ones the user
    // wrote; resolved names are the ones the surfaced cards carry.
    internal static string BuildSmartSearchQuery(
        string originalQuery,
        IReadOnlyList<string> requestedBrandNames,
        IReadOnlyList<string> requestedCollectionNames,
        IReadOnlyList<string> resolvedBrandNames,
        IReadOnlyList<string> resolvedCollectionNames)
    {
        var cleaned = CleanSmartSearchText(originalQuery);
        var styleHint = ExtractSmartSearchStyleHint(originalQuery);

        var requestedBrands = requestedBrandNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var requestedCollections = requestedCollectionNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var distinctBrands = resolvedBrandNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var distinctCollections = resolvedCollectionNames.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var descriptor = cleaned;

        foreach (var brand in requestedBrands.Concat(distinctBrands).Distinct(StringComparer.OrdinalIgnoreCase))
            descriptor = RemoveSearchTerm(descriptor, brand);

        foreach (var collection in requestedCollections.Concat(distinctCollections).Distinct(StringComparer.OrdinalIgnoreCase))
            descriptor = RemoveSearchTerm(descriptor, collection, allowPlural: true);

        foreach (var alias in QueryNormalizer.BrandAliases.Where(alias =>
            requestedBrands.Concat(distinctBrands).Contains(alias.Value, StringComparer.OrdinalIgnoreCase)))
        {
            descriptor = RemoveSearchTerm(descriptor, alias.Key, allowPlural: true);
        }

        // Only what a catalogue search cannot use: the ask itself, generic nouns, and the vocabulary of a
        // history question. Ordinary words of the brief ("wear", "want", "and") stay, because the query
        // shows in the Smart Search box and "a watch I can wear running and swimming" cut down to
        // "watch I can running swimming" reads as though the concierge mangled the question.
        descriptor = Regex.Replace(
            descriptor,
            @"\b(?:recommend|suggest|find|show|give|bring|help|discover|please|pls|some|any|maybe|few|couple|options?|pieces?|models?)\b",
            " ",
            RegexOptions.IgnoreCase);
        descriptor = TidyDanglingConnectors(descriptor);

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

    // Removing "from Rolex" or "and Vacheron Constantin" leaves the connector behind; anything left
    // dangling at either end, or collapsed onto another connector, goes with it.
    private static string TidyDanglingConnectors(string text)
    {
        var tidy = Regex.Replace(text, @"\s+", " ").Trim();
        tidy = Regex.Replace(tidy, @"\b(?:and|or)\s+(?:and|or)\b", "and", RegexOptions.IgnoreCase);
        tidy = Regex.Replace(tidy, @"^(?:and|or|from|by|of|with|in|for)\b\s*", "", RegexOptions.IgnoreCase);
        tidy = Regex.Replace(tidy, @"\s*\b(?:and|or|from|by|of|with|in|for)$", "", RegexOptions.IgnoreCase);
        return tidy.Trim(' ', ',', '.', '?', '!');
    }

    private static string CleanSmartSearchText(string originalQuery)
    {
        var cleaned = QueryNormalizer.ExpandCompoundTerms(originalQuery.Trim());

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
        // "should i wear" is stripped above when it opens the brief; mid-sentence it is part of the
        // question ("what should I wear to a black tie gala") and cutting it leaves nonsense.
        cleaned = Regex.Replace(cleaned, @"\b(?:change the cursor to|set the cursor to|switch the cursor to)\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\b(?:browse the web|search the web|web|internet|history|heritage|background|founder|founded|origins?)\b", " ", RegexOptions.IgnoreCase);
        return Regex.Replace(cleaned, @"\s+", " ").Trim(' ', ',', '.', '?', '!');
    }

    private static string? ExtractSmartSearchStyleHint(string query)
    {
        var normalized = QueryNormalizer.ExpandCompoundTerms(query);
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
        var pattern = $@"(?:\b(?:from|by|of|at)\s+)?\b{Regex.Escape(term)}{suffix}\b";
        return Regex.Replace(input, pattern, " ", RegexOptions.IgnoreCase);
    }

    internal static string ResolveResponseLanguage(string query, string? preferredLanguage)
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

    // Letters only Vietnamese uses. French shares à â é è ê ô ù, and matching those first had the model
    // answer "une vraie montre de plongée" in Vietnamese.
    internal static bool LooksLikeVietnameseText(string query) =>
        Regex.IsMatch(query, @"[ăơưđáảãạấầẩẫậắằẳẵặẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúủũụứừửữựýỳỷỹỵ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:xin chao|xin chào|dong ho|đồng hồ|lich su|lịch sử|thuong hieu|thương hiệu|bo suu tap|bộ sưu tập)\b", RegexOptions.IgnoreCase);

    // French cues for choosing the reply language, limited to words that are French alone. "collection",
    // "heritage" and "maison" are everyday English in watch talk, and matching them had the model answer
    // "Tell me about the Reverso collection" in French. Common function words catch French typed without
    // accents ("quelque chose de discret pour le bureau"), which otherwise fell through to English.
    internal static bool LooksLikeFrenchText(string query) =>
        Regex.IsMatch(query, @"[àâçéèêëîïôûùüÿœæ]", RegexOptions.IgnoreCase)
        || Regex.IsMatch(query, @"\b(?:bonjour|montres?|histoire|parlez[- ]moi|raconte[- ]moi|suisse|quelque|quelles?|quels?|chose|pour|avec|une|je|vous|votre|mon|mes|porter|cadran|poignets?)\b", RegexOptions.IgnoreCase);

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
        var cleaned = QueryNormalizer.ExpandCompoundTerms(query);
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

        var brands = (await GetCachedBrandsAsync()).OrderBy(b => b.Name).ToList();
        var collections = (await GetCachedCollectionsAsync()).OrderBy(c => c.Name).ToList();
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

    private string BuildCardContinuationFallbackMessage(
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
    //
    // Order of preference: planner-suggested chips (validated against watchCards) first,
    // deterministic rule-tree below as fallback when the planner returned nothing usable.
    private static List<ChatAction> BuildSuggestionActions(
        List<ChatWatchCard> watchCards,
        List<ChatAction> primaryActions,
        IReadOnlyCollection<string>? suggestedCompareSlugs = null,
        bool suppressCompareSuggestion = false,
        IReadOnlyList<PlannedAction>? plannedActions = null)
    {
        if (watchCards.Count == 0)
        {
            // Greetings and cursor-only responses — show 3 example query chips so the user
            // always has a concrete next step regardless of why no cards were returned.
            if (!primaryActions.Any())
                return GetStaticSuggestions();
            return [];
        }

        // Planner path: validate every slug against the visible cards, dedupe against
        // primary actions, cap at 3. If the planner returned usable chips, it wins —
        // the rule tree below is the fallback.
        var merged = MergeSuggestedActions(plannedActions, watchCards, primaryActions);
        if (merged.Count >= 3)
            return merged;

        var suggestions = new List<ChatAction>(merged);
        var effectivePrimaryActions = primaryActions.Concat(merged).ToList();
        var primaryFingerprints = new HashSet<string>(
            primaryActions.Select(ChipFingerprint),
            StringComparer.OrdinalIgnoreCase);
        var hasCompareAction = effectivePrimaryActions.Any(a =>
            string.Equals(a.Type, "compare", StringComparison.OrdinalIgnoreCase));
        var compareCards = (suggestedCompareSlugs ?? [])
            .Select(slug => watchCards.FirstOrDefault(card => string.Equals(card.Slug, slug, StringComparison.OrdinalIgnoreCase)))
            .Where(card => card != null)
            .Cast<ChatWatchCard>()
            .Take(2)
            .ToList();
        if (compareCards.Count < 2)
            compareCards = watchCards.Take(2).ToList();

        // Suggest comparing first two when no compare action was already generated.
        if (!suppressCompareSuggestion && !hasCompareAction && compareCards.Count >= 2)
        {
            suggestions.Add(new ChatAction
            {
                Type = "compare",
                Label = BuildCompareChipLabel(compareCards[0], compareCards[1]),
                Slugs = [compareCards[0].Slug, compareCards[1].Slug]
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
                if (suggestions.Count >= 3) break;
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
            if (firstWithBrand != null && suggestions.Count < 3)
            {
                suggestions.Add(new ChatAction
                {
                    Type = "navigate",
                    Label = $"Tell me more about {firstWithBrand.BrandName}",
                    Href = $"/brands/{firstWithBrand.BrandSlug}"
                });
            }

            if (suggestions.Count < 3)
            {
                var firstWithCollection = watchCards.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.CollectionSlug));
                if (firstWithCollection != null)
                {
                    suggestions.Add(new ChatAction
                    {
                        Type = "navigate",
                        Label = $"Explore the {FormatCollectionChipName(firstWithCollection.CollectionName, firstWithCollection.BrandName)} collection",
                        Href = $"/collections/{firstWithCollection.CollectionSlug}"
                    });
                }
            }
        }

        var deduped = suggestions
            .Where(action => !primaryFingerprints.Contains(ChipFingerprint(action)))
            .GroupBy(ChipFingerprint, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

        return deduped.Take(3).ToList();
    }

    private static string BuildCompareChipLabel(ChatWatchCard first, ChatWatchCard second) =>
        $"Compare {CardShortLabel(first)} and {CardShortLabel(second)}";

    // Returns the collection name with any leading generic word stripped for use in chip labels, and a
    // trailing "Collection" dropped because every label adds its own.
    // e.g. "Collection Convexe" → "Convexe", "Elegance Collection" → "Elegance", "Aquanaut" → "Aquanaut"
    internal static string FormatCollectionChipName(string? collectionName, string? brandName = null)
    {
        if (string.IsNullOrWhiteSpace(collectionName)) return "this collection";
        // The trailing word goes first: "Sport Collection" read the other way round would lose "Sport" as
        // generic and leave "Collection".
        var words = collectionName.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (words.Count > 1 && string.Equals(words[^1], "Collection", StringComparison.OrdinalIgnoreCase))
            words.RemoveAt(words.Count - 1);
        if (words.Count > 1 && _genericCollectionWords.Contains(words[0]))
            words.RemoveAt(0);
        // Greubel Forsey names one collection just "Collection"; its chip reads as the brand's.
        if (words.Count == 1 && string.Equals(words[0], "Collection", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(brandName))
            return brandName;
        return string.Join(" ", words);
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

    private ChatWatchCard ToChatWatchCard(Watch watch) => new()
    {
        Id = watch.Id,
        Name = watch.Name,
        Slug = watch.Slug,
        Description = watch.Description,
        Image = watch.Image,
        ImageUrl = _storage.GetPublicUrl(watch.Image, watch.ImageVersion),
        CurrentPrice = watch.CurrentPrice,
        BrandId = watch.BrandId,
        BrandName = watch.Brand?.Name,
        BrandSlug = watch.Brand?.Slug,
        CollectionName = watch.Collection?.Name,
        CollectionSlug = watch.Collection?.Slug,
    };
}
