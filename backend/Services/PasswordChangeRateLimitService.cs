// Rate limiting for password change attempts to prevent brute force attacks.
// Tracks per-user attempt counts in Redis with a rolling time window.
using Microsoft.Extensions.Logging;

namespace backend.Services;

public interface IPasswordChangeRateLimitService
{
    Task<bool> IsRateLimitedAsync(string userId);
    Task RecordAttemptAsync(string userId);
}

// Uses Redis atomic INCR so counts are accurate across restarts and multiple instances.
public class PasswordChangeRateLimitService : IPasswordChangeRateLimitService
{
    private readonly IRedisService _redis;
    private readonly ILogger<PasswordChangeRateLimitService> _logger;
    private const int MaxAttempts = 5;
    private const int TimeWindowMinutes = 15;

    public PasswordChangeRateLimitService(IRedisService redis, ILogger<PasswordChangeRateLimitService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    // Checks if a user is currently rate limited based on their recent password change attempts
    public async Task<bool> IsRateLimitedAsync(string userId)
    {
        var count = await _redis.GetCounterAsync($"pwd_change_rl:{userId}");
        if (count >= MaxAttempts)
        {
            _logger.LogWarning("Password change rate limited for user: {UserId} - {Attempts} attempts in {TimeWindow} minutes",
                userId, count, TimeWindowMinutes);
            return true;
        }
        return false;
    }

    // Records an attempt using atomic INCR; TTL is set only on the first increment.
    public async Task RecordAttemptAsync(string userId)
    {
        var attempts = await _redis.IncrementAsync(
            $"pwd_change_rl:{userId}",
            TimeSpan.FromMinutes(TimeWindowMinutes));

        _logger.LogInformation("Password change attempt recorded for user: {UserId} - Attempt {Attempts}/{MaxAttempts}",
            userId, attempts, MaxAttempts);
    }
} 