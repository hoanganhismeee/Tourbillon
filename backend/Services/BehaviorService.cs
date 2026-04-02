// Service for storing and managing user browsing events used to generate Watch DNA profiles.
using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface IBehaviorService
{
    Task FlushEventsAsync(int? userId, string? anonymousId, List<BrowsingEventItemDto> events);
    Task MergeAnonymousAsync(int userId, string anonymousId);
    Task<List<UserBrowsingEvent>> GetRecentEventsAsync(int userId, int limit = 100);
}

public class BehaviorService : IBehaviorService
{
    private readonly TourbillonContext _context;

    public BehaviorService(TourbillonContext context)
    {
        _context = context;
    }

    // Bulk-inserts incoming events, skipping duplicates (same anonymousId/userId + entityId + eventType + same UTC hour).
    public async Task FlushEventsAsync(int? userId, string? anonymousId, List<BrowsingEventItemDto> events)
    {
        if (events.Count == 0) return;

        var toInsert = new List<UserBrowsingEvent>();
        foreach (var e in events)
        {
            var hourWindow = new DateTime(e.Timestamp.Year, e.Timestamp.Month, e.Timestamp.Day, e.Timestamp.Hour, 0, 0, DateTimeKind.Utc);
            bool exists = await _context.UserBrowsingEvents.AnyAsync(x =>
                (userId != null ? x.UserId == userId : x.AnonymousId == anonymousId) &&
                x.EntityId == e.EntityId &&
                x.EventType == e.EventType &&
                x.Timestamp >= hourWindow &&
                x.Timestamp < hourWindow.AddHours(1));
            if (!exists)
                toInsert.Add(new UserBrowsingEvent
                {
                    UserId = userId,
                    AnonymousId = anonymousId,
                    EventType = e.EventType,
                    EntityId = e.EntityId,
                    EntityName = e.EntityName,
                    BrandId = e.BrandId,
                    Timestamp = e.Timestamp,
                });
        }
        if (toInsert.Count > 0)
        {
            _context.UserBrowsingEvents.AddRange(toInsert);
            await _context.SaveChangesAsync();
        }
    }

    // Reassigns all anonymous events to the authenticated user after login.
    public async Task MergeAnonymousAsync(int userId, string anonymousId)
    {
        await _context.UserBrowsingEvents
            .Where(e => e.AnonymousId == anonymousId && e.UserId == null)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.UserId, userId));
    }

    // Returns the most recent events for a user, for AI DNA generation.
    public async Task<List<UserBrowsingEvent>> GetRecentEventsAsync(int userId, int limit = 100)
    {
        return await _context.UserBrowsingEvents
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.Timestamp)
            .Take(limit)
            .ToListAsync();
    }
}
