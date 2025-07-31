// This service implements rate limiting for password change attempts to prevent brute force attacks
// It tracks password change attempts per user and enforces limits to protect against
// automated attacks while maintaining anonymous tracking without password data.
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace backend.Services;

public interface IPasswordChangeRateLimitService
{
    Task<bool> IsRateLimitedAsync(string userId);
    Task RecordAttemptAsync(string userId);
}

// Implements rate limiting for password change attempts to prevent brute force attacks
// by tracking attempts per user within configurable time windows using in-memory caching.
public class PasswordChangeRateLimitService : IPasswordChangeRateLimitService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<PasswordChangeRateLimitService> _logger;
    private const int MaxAttempts = 5; // Maximum attempts per time window
    private const int TimeWindowMinutes = 15; // Time window in minutes

    public PasswordChangeRateLimitService(IMemoryCache cache, ILogger<PasswordChangeRateLimitService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    // Checks if a user is currently rate limited based on their recent password change attempts
    public async Task<bool> IsRateLimitedAsync(string userId)
    {
        var cacheKey = $"password_change_attempts_{userId}";
        
        if (_cache.TryGetValue(cacheKey, out int attempts))
        {
            if (attempts >= MaxAttempts)
            {
                _logger.LogWarning("Password change rate limited for user: {UserId} - {Attempts} attempts in {TimeWindow} minutes", 
                    userId, attempts, TimeWindowMinutes);
                return true;
            }
        }

        return false;
    }

    // Records a password change attempt and updates the rate limiting cache with automatic expiration
    public async Task RecordAttemptAsync(string userId)
    {
        var cacheKey = $"password_change_attempts_{userId}";
        
        // Increment attempt counter or initialize to 1 if not exists
        if (_cache.TryGetValue(cacheKey, out int attempts))
        {
            attempts++;
        }
        else
        {
            attempts = 1;
        }

        // Set cache entry with automatic expiration after the time window
        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(TimeWindowMinutes)
        };

        _cache.Set(cacheKey, attempts, cacheOptions);
        
        // Log attempt for security monitoring (anonymous, no password data)
        _logger.LogInformation("Password change attempt recorded for user: {UserId} - Attempt {Attempts}/{MaxAttempts}", 
            userId, attempts, MaxAttempts);
    }
} 