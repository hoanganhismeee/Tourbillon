// Redis-backed daily quota service for paid AI-backed features.
// Feature callers decide when a request is chargeable; this service only stores counters.

namespace backend.Services;

public record AiQuotaStatus(bool RateLimited, int DailyUsed, int DailyLimit);

public interface IAiUsageQuotaService
{
    Task<AiQuotaStatus> CheckAsync(string feature, string subjectKey, int dailyLimit, bool disabled, bool isAdmin);
    Task<AiQuotaStatus> ChargeAsync(string feature, string subjectKey, int dailyLimit, bool disabled, bool isAdmin);
}

public class AiUsageQuotaService : IAiUsageQuotaService
{
    private readonly IRedisService _redis;

    public AiUsageQuotaService(IRedisService redis)
    {
        _redis = redis;
    }

    public async Task<AiQuotaStatus> CheckAsync(string feature, string subjectKey, int dailyLimit, bool disabled, bool isAdmin)
    {
        if (disabled || isAdmin)
            return new AiQuotaStatus(false, 0, dailyLimit);

        var used = (int)(await _redis.GetCounterAsync(BuildKey(feature, subjectKey)) ?? 0);
        return new AiQuotaStatus(used >= dailyLimit, used, dailyLimit);
    }

    public async Task<AiQuotaStatus> ChargeAsync(string feature, string subjectKey, int dailyLimit, bool disabled, bool isAdmin)
    {
        if (disabled || isAdmin)
            return new AiQuotaStatus(false, 0, dailyLimit);

        var key = BuildKey(feature, subjectKey);
        var used = (int)(await _redis.GetCounterAsync(key) ?? 0);
        if (used >= dailyLimit)
            return new AiQuotaStatus(true, used, dailyLimit);

        var ttlUntilMidnight = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
        var newUsed = (int)await _redis.IncrementAsync(key, ttlUntilMidnight);
        return new AiQuotaStatus(newUsed > dailyLimit, newUsed, dailyLimit);
    }

    private static string BuildKey(string feature, string subjectKey) =>
        $"ai_quota:{feature}:{subjectKey}";
}
