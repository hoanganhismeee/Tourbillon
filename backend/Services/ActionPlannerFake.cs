// Test double for the action planner - always returns an empty list so the
// deterministic ChatService fallback path can be exercised without ai-service.
namespace backend.Services;

public sealed class ActionPlannerFake : IActionPlanner
{
    public Task<IReadOnlyList<PlannedAction>> PlanAsync(PlanActionsInput input, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PlannedAction>>(Array.Empty<PlannedAction>());
}
