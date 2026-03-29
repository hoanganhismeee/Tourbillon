// Abstraction over Redis operations used across the application.
// Centralizes key naming and provides testable atomic operations (increment, hash, TTL).

namespace backend.Services;

public interface IRedisService
{
    /// Atomically increments a counter. Sets TTL only on the first increment (when key is new).
    Task<long> IncrementAsync(string key, TimeSpan? ttlOnCreate = null);

    /// Returns the counter value, or null if the key does not exist.
    Task<long?> GetCounterAsync(string key);

    /// Gets a string value by key.
    Task<string?> GetStringAsync(string key);

    /// Sets a string value with optional expiry.
    Task SetStringAsync(string key, string value, TimeSpan? expiry = null);

    /// Removes a key. Returns true if the key existed.
    Task<bool> RemoveAsync(string key);

    /// Sets a field in a Redis hash and optionally refreshes the key's TTL.
    Task SetHashFieldAsync(string key, string field, string value, TimeSpan? expiry = null);

    /// Gets a field from a Redis hash.
    Task<string?> GetHashFieldAsync(string key, string field);

    /// Deletes an entire hash key.
    Task<bool> RemoveHashAsync(string key);

    /// Refreshes the TTL on an existing key.
    Task RefreshExpiryAsync(string key, TimeSpan expiry);
}
