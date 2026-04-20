// Action planner interface — sources the follow-up chip suggestions that the
// chat concierge surfaces alongside each reply. The ai-service /plan-actions
// endpoint uses LLM tool calling to pick chips based on the resolved cards and
// conversation, replacing the hand-rolled rule tree that used to live in
// ChatService.BuildSuggestionActions.
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services;

// One planner-suggested chip. Every slug here is re-validated by ChatService
// before it reaches the frontend — treat these values as hints, never as trusted.
public sealed class PlannedAction
{
    [JsonPropertyName("type")]  public string Type  { get; set; } = ""; // "compare" | "navigate" | "search"
    [JsonPropertyName("label")] public string Label { get; set; } = "";

    [JsonPropertyName("slugs")] public List<string>? Slugs { get; set; }
    [JsonPropertyName("query")] public string? Query { get; set; }
    [JsonPropertyName("href")]  public string? Href  { get; set; }
    [JsonPropertyName("reason")] public string? Reason { get; set; }
}

public sealed class PlanActionsInput
{
    public string Query { get; set; } = "";
    public string AssistantReply { get; set; } = "";
    public string Intent { get; set; } = "unclear";
    public IReadOnlyList<string> PrimaryActionTypes { get; set; } = [];
    public IReadOnlyList<ChatWatchCard> WatchCards { get; set; } = [];
    public IReadOnlyList<string> RejectedBrandSlugs { get; set; } = [];
}

public interface IActionPlanner
{
    // Returns zero or more planner-suggested chips. Always completes — on failure,
    // returns an empty list so callers can fall back to the deterministic tree.
    Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default);
}

// Default: calls POST /plan-actions on ai-service. Any failure (network,
// timeout, malformed JSON, LLM didn't emit tool_calls) yields an empty list.
public sealed class ActionPlannerService : IActionPlanner
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ActionPlannerService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    // Planner is best-effort. If it is slow we fall back to the deterministic
    // rule tree rather than stall the user-visible reply.
    private static readonly TimeSpan PlannerTimeout = TimeSpan.FromSeconds(25);

    public ActionPlannerService(IHttpClientFactory httpClientFactory, ILogger<ActionPlannerService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Query) || input.WatchCards.Count == 0)
            return Array.Empty<PlannedAction>();

        try
        {
            var client = _httpClientFactory.CreateClient("ai-service");

            var payload = new
            {
                query = input.Query,
                assistantReply = input.AssistantReply,
                intent = input.Intent,
                primaryActionTypes = input.PrimaryActionTypes,
                watchCards = input.WatchCards.Select(c => new
                {
                    slug = c.Slug,
                    name = c.Name,
                    brandName = c.BrandName,
                    brandSlug = c.BrandSlug,
                    collectionName = c.CollectionName,
                    collectionSlug = c.CollectionSlug,
                    price = c.CurrentPrice,
                }).ToArray(),
                rejectedBrandSlugs = input.RejectedBrandSlugs,
            };

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(PlannerTimeout);

            using var resp = await client.PostAsJsonAsync("/plan-actions", payload, _jsonOptions, timeoutCts.Token);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogDebug("plan-actions non-success status {Status}", (int)resp.StatusCode);
                return Array.Empty<PlannedAction>();
            }

            var parsed = await resp.Content.ReadFromJsonAsync<PlanActionsResponse>(_jsonOptions, timeoutCts.Token);
            return parsed?.SuggestedActions ?? (IReadOnlyList<PlannedAction>)Array.Empty<PlannedAction>();
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("plan-actions call cancelled or timed out");
            return Array.Empty<PlannedAction>();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "plan-actions call failed");
            return Array.Empty<PlannedAction>();
        }
    }

    private sealed class PlanActionsResponse
    {
        [JsonPropertyName("suggestedActions")]
        public List<PlannedAction> SuggestedActions { get; set; } = [];
    }
}

// Test double: always returns an empty list so ChatService's deterministic
// fallback runs. Keeps every existing ChatService test passing unchanged.
public sealed class NoopActionPlanner : IActionPlanner
{
    public Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PlannedAction>>(Array.Empty<PlannedAction>());
}
