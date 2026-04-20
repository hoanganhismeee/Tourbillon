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

            using var response = await client.PostAsJsonAsync("/plan-actions", payload, _jsonOptions, timeoutCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogDebug("plan-actions non-success status {Status}", (int)response.StatusCode);
                return Array.Empty<PlannedAction>();
            }

            var parsed = await response.Content.ReadFromJsonAsync<PlanActionsResponse>(_jsonOptions, timeoutCts.Token);
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
