// Health check for the ai-service Flask dependency.
// Returns Degraded on 503 (warmup in progress) so the backend stays in rotation during cold starts.
// Returns Unhealthy only on connection failure or an unexpected HTTP status code.

using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace backend.Infrastructure;

public class AiServiceHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory;

    public AiServiceHealthCheck(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // Reuse the named "ai-service" client (BaseAddress = AiService:BaseUrl config key).
            // Override its 6-minute timeout with a 5-second probe timeout.
            var client = _httpClientFactory.CreateClient("ai-service");
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(5));

            var response = await client.GetAsync("/ready", cts.Token);

            if (response.IsSuccessStatusCode)
                return HealthCheckResult.Healthy("ai-service ready");

            if ((int)response.StatusCode == 503)
                return HealthCheckResult.Degraded("ai-service warming up (503)");

            return HealthCheckResult.Unhealthy($"ai-service returned unexpected status {(int)response.StatusCode}");
        }
        catch (OperationCanceledException)
        {
            return HealthCheckResult.Degraded("ai-service health check timed out (5s)");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy($"ai-service unreachable: {ex.Message}");
        }
    }
}
