// Default action planner - calls POST /plan-actions on ai-service. Any failure
// (network, timeout, malformed JSON, or empty planner output) yields an empty
// list so ChatService can fall back to the deterministic chip tree.
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services;

public sealed class ActionPlannerService : IActionPlanner
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ActionPlannerService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    // Planner runs concurrently with the wording draft (Task.WhenAll in ChatService),
    // so whichever is slower pins the user-visible reply latency. Keep this tight — the
    // fallback path is cheap and the user-visible impact of a missed planner call is
    // "slightly less clever chips," not correctness.
    private static readonly TimeSpan PlannerTimeout = TimeSpan.FromSeconds(4);

    public ActionPlannerService(IHttpClientFactory httpClientFactory, ILogger<ActionPlannerService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Query) || input.WatchCards.Count == 0)
        {
            LogOutcome("skipped", 0, input, null);
            return Array.Empty<PlannedAction>();
        }

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

            using var response = await client.PostAsJsonAsync("/plan-actions", payload, _jsonOptions, timeoutCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                LogOutcome("error_status", 0, input, $"http {(int)response.StatusCode}");
                return Array.Empty<PlannedAction>();
            }

            var parsed = await response.Content.ReadFromJsonAsync<PlanActionsResponse>(_jsonOptions, timeoutCts.Token);
            var suggestions = parsed?.SuggestedActions ?? [];
            LogOutcome(suggestions.Count > 0 ? "used" : "empty", suggestions.Count, input, null);
            return suggestions;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            LogOutcome("cancelled", 0, input, null);
            return Array.Empty<PlannedAction>();
        }
        catch (OperationCanceledException)
        {
            LogOutcome("timeout", 0, input, null);
            return Array.Empty<PlannedAction>();
        }
        catch (Exception ex)
        {
            LogOutcome("error", 0, input, ex.GetType().Name);
            return Array.Empty<PlannedAction>();
        }
    }

    // Single structured log line per planner call. Outcome is one of
    // skipped | used | empty | error_status | timeout | cancelled | error.
    // Emitted at Information so planner health shows up at default log level.
    private void LogOutcome(string outcome, int count, PlanActionsInput input, string? detail)
    {
        _logger.LogInformation(
            "plan-actions outcome={Outcome} count={Count} cards={CardCount} intent={Intent} detail={Detail}",
            outcome,
            count,
            input.WatchCards.Count,
            input.Intent,
            detail ?? "-");
    }

    private sealed class PlanActionsResponse
    {
        [JsonPropertyName("suggestedActions")]
        public List<PlannedAction> SuggestedActions { get; set; } = [];
    }
}
