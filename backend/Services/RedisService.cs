// Redis service implementation using StackExchange.Redis.
// Wraps IConnectionMultiplexer for atomic counters, string KV, and hash operations.

using StackExchange.Redis;

namespace backend.Services;

public class RedisService : IRedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisService> _logger;

    public RedisService(IConnectionMultiplexer redis, ILogger<RedisService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    private IDatabase Db => _redis.GetDatabase();

    public async Task<long> IncrementAsync(string key, TimeSpan? ttlOnCreate = null)
    {
        var db = Db;
        var value = await db.StringIncrementAsync(key);

        // Set TTL only on the first increment (counter just created)
        if (value == 1 && ttlOnCreate.HasValue)
            await db.KeyExpireAsync(key, ttlOnCreate.Value);

        return value;
    }

    public async Task<long?> GetCounterAsync(string key)
    {
        var val = await Db.StringGetAsync(key);
        if (val.IsNullOrEmpty) return null;
        return (long)val;
    }

    public async Task<string?> GetStringAsync(string key)
    {
        var val = await Db.StringGetAsync(key);
        return val.IsNullOrEmpty ? null : val.ToString();
    }

    public async Task SetStringAsync(string key, string value, TimeSpan? expiry = null)
    {
        await Db.StringSetAsync(key, value, expiry);
    }

    public async Task<bool> RemoveAsync(string key)
    {
        return await Db.KeyDeleteAsync(key);
    }

    public async Task SetHashFieldAsync(string key, string field, string value, TimeSpan? expiry = null)
    {
        var db = Db;
        await db.HashSetAsync(key, field, value);
        if (expiry.HasValue)
            await db.KeyExpireAsync(key, expiry.Value);
    }

    public async Task<string?> GetHashFieldAsync(string key, string field)
    {
        var val = await Db.HashGetAsync(key, field);
        return val.IsNullOrEmpty ? null : val.ToString();
    }

    public async Task<bool> RemoveHashAsync(string key)
    {
        return await Db.KeyDeleteAsync(key);
    }

    public async Task RefreshExpiryAsync(string key, TimeSpan expiry)
    {
        await Db.KeyExpireAsync(key, expiry);
    }
}
