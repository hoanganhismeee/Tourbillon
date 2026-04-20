// Action planner interface - sources the follow-up chip suggestions that the
// chat concierge surfaces alongside each reply. The ai-service /plan-actions
// endpoint uses LLM tool calling to pick chips based on the resolved cards and
// conversation, replacing the hand-rolled rule tree that used to live in
// ChatService.BuildSuggestionActions.
using System.Text.Json.Serialization;

namespace backend.Services;

// One planner-suggested chip. Every slug here is re-validated by ChatService
// before it reaches the frontend - treat these values as hints, never as trusted.
public sealed class PlannedAction
{
    [JsonPropertyName("type")] public string Type { get; set; } = "";
    [JsonPropertyName("label")] public string Label { get; set; } = "";

    [JsonPropertyName("slugs")] public List<string>? Slugs { get; set; }
    [JsonPropertyName("query")] public string? Query { get; set; }
    [JsonPropertyName("href")] public string? Href { get; set; }
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
    // Returns zero or more planner-suggested chips. Always completes - on failure,
    // returns an empty list so callers can fall back to the deterministic tree.
    Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default);
}
