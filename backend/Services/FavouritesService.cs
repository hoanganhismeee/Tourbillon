// Service for managing user favourites and named collections.
// Handles all CRUD operations with EF Core; no AI involved.
using backend.Database;
using backend.DTOs;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public interface IFavouritesService
{
    Task<FavouritesStateDto> GetStateAsync(int userId);
    Task AddFavouriteAsync(int userId, int watchId);
    Task RemoveFavouriteAsync(int userId, int watchId);
    Task<FavouriteWatchesResponseDto> GetFavouriteWatchesAsync(int userId, FavouriteWatchesQueryDto query);
    Task<UserCollectionDto> CreateCollectionAsync(int userId, string name);
    Task<UserCollectionDto> RenameCollectionAsync(int userId, int collectionId, string newName);
    Task DeleteCollectionAsync(int userId, int collectionId);
    Task AddToCollectionAsync(int userId, int collectionId, int watchId);
    Task RemoveFromCollectionAsync(int userId, int collectionId, int watchId);
}

public class FavouritesService : IFavouritesService
{
    private readonly TourbillonContext _context;
    private readonly IStorageService _storage;

    public FavouritesService(TourbillonContext context, IStorageService storage)
    {
        _context = context;
        _storage = storage;
    }

    // Returns the full favourites state: all favourite watch IDs + all collection summaries.
    public async Task<FavouritesStateDto> GetStateAsync(int userId)
    {
        var favouriteIds = await _context.UserFavourites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .Select(f => f.WatchId)
            .ToArrayAsync();

        var collections = await _context.UserCollections
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .Include(c => c.Watches)
                .ThenInclude(cw => cw.Watch)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return new FavouritesStateDto
        {
            FavouriteWatchIds = favouriteIds,
            Collections = collections.Select(c => new UserCollectionDto
            {
                Id = c.Id,
                Name = c.Name,
                WatchIds = c.Watches.Select(w => w.WatchId).ToArray(),
                PreviewImages = c.Watches
                    .OrderByDescending(w => w.AddedAt)
                    .Where(w => !string.IsNullOrEmpty(w.Watch?.Image))
                    .Take(4)
                    .Select(w => w.Watch!.Image!)
                    .ToArray(),
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
            }).ToList(),
        };
    }

    // Adds a watch to the user's Favourites; idempotent — does nothing if already present.
    public async Task AddFavouriteAsync(int userId, int watchId)
    {
        var exists = await _context.UserFavourites
            .AnyAsync(f => f.UserId == userId && f.WatchId == watchId);

        if (!exists)
        {
            _context.UserFavourites.Add(new UserFavourite
            {
                UserId = userId,
                WatchId = watchId,
                CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
        }
    }

    // Removes a watch from Favourites; no-op if not present.
    public async Task RemoveFavouriteAsync(int userId, int watchId)
    {
        var row = await _context.UserFavourites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.WatchId == watchId);

        if (row != null)
        {
            _context.UserFavourites.Remove(row);
            await _context.SaveChangesAsync();
        }
    }

    // Returns paginated watches that are in the user's Favourites or matching collections.
    // Also returns a WatchCollectionMembership map for label pills on the /favourites page.
    public async Task<FavouriteWatchesResponseDto> GetFavouriteWatchesAsync(int userId, FavouriteWatchesQueryDto query)
    {
        // Gather all watch IDs the user has saved (in Favourites)
        var favouriteIds = await _context.UserFavourites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .Select(f => new { f.WatchId, f.CreatedAt })
            .ToListAsync();

        var favouriteIdSet = favouriteIds.ToDictionary(f => f.WatchId, f => f.CreatedAt);

        // Gather all collection membership for the user
        var userCollectionIds = await _context.UserCollections
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => c.Id)
            .ToListAsync();

        var allMembership = await _context.UserCollectionWatches
            .AsNoTracking()
            .Where(cw => userCollectionIds.Contains(cw.UserCollectionId))
            .ToListAsync();

        // Build the deduplicated watch ID set (favourites + collection members if filter applied)
        IEnumerable<int> watchIdPool;
        if (query.CollectionIds != null && query.CollectionIds.Length > 0)
        {
            var collectionWatchIds = allMembership
                .Where(cw => query.CollectionIds.Contains(cw.UserCollectionId))
                .Select(cw => cw.WatchId)
                .Distinct();
            watchIdPool = collectionWatchIds;
        }
        else
        {
            var collectionWatchIds = allMembership.Select(cw => cw.WatchId);
            watchIdPool = favouriteIdSet.Keys.Union(collectionWatchIds).Distinct();
        }

        var watchIdList = watchIdPool.ToList();
        var totalCount = watchIdList.Count;

        // Fetch watch entities
        var watchesQuery = _context.Watches
            .AsNoTracking()
            .Where(w => watchIdList.Contains(w.Id));

        // Apply sort
        watchesQuery = (query.SortBy ?? "recent") switch
        {
            "brand"      => watchesQuery.OrderBy(w => w.BrandId).ThenBy(w => w.Name),
            // PoR (price = 0) is treated as highest — appears first on price_desc, last on price_asc.
            "price_desc" => watchesQuery.OrderByDescending(w => w.CurrentPrice == 0).ThenByDescending(w => w.CurrentPrice),
            "price_asc"  => watchesQuery.OrderBy(w => w.CurrentPrice == 0).ThenBy(w => w.CurrentPrice),
            _            => watchesQuery, // "recent": sort in memory by CreatedAt below
        };

        var watches = await watchesQuery.ToListAsync();

        // For "recent" sort, order by the earliest save date (favourites or collection)
        if ((query.SortBy ?? "recent") == "recent")
        {
            var collectionAddedAt = allMembership
                .GroupBy(cw => cw.WatchId)
                .ToDictionary(g => g.Key, g => g.Min(cw => cw.AddedAt));

            watches = watches
                .OrderByDescending(w =>
                {
                    var favDate = favouriteIdSet.TryGetValue(w.Id, out var fd) ? fd : DateTime.MinValue;
                    var colDate = collectionAddedAt.TryGetValue(w.Id, out var cd) ? cd : DateTime.MinValue;
                    return favDate > colDate ? favDate : colDate;
                })
                .ToList();
        }

        // Paginate
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var paged = watches.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        // Build membership map for returned watches only
        var pagedIds = paged.Select(w => w.Id).ToHashSet();
        var membership = allMembership
            .Where(cw => pagedIds.Contains(cw.WatchId))
            .GroupBy(cw => cw.WatchId)
            .ToDictionary(g => g.Key, g => g.Select(cw => cw.UserCollectionId).ToArray());

        return new FavouriteWatchesResponseDto
        {
            Watches = paged.Select(w => WatchDto.FromWatch(w, _storage)).ToList(),
            WatchCollectionMembership = membership,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    // Creates a new named collection; rejects empty names and duplicates (case-insensitive).
    public async Task<UserCollectionDto> CreateCollectionAsync(int userId, string name)
    {
        name = name.Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Collection name cannot be empty.");

        var duplicate = await _context.UserCollections
            .AnyAsync(c => c.UserId == userId && c.Name.ToLower() == name.ToLower());

        if (duplicate)
            throw new InvalidOperationException($"A collection named \"{name}\" already exists.");

        var collection = new UserCollection
        {
            UserId = userId,
            Name = name,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _context.UserCollections.Add(collection);
        await _context.SaveChangesAsync();

        return new UserCollectionDto
        {
            Id = collection.Id,
            Name = collection.Name,
            WatchIds = Array.Empty<int>(),
            CreatedAt = collection.CreatedAt,
            UpdatedAt = collection.UpdatedAt,
        };
    }

    // Renames a collection; rejects empty names and case-insensitive duplicates (excluding the current collection).
    public async Task<UserCollectionDto> RenameCollectionAsync(int userId, int collectionId, string newName)
    {
        newName = newName.Trim();
        if (string.IsNullOrEmpty(newName))
            throw new InvalidOperationException("Collection name cannot be empty.");

        var collection = await _context.UserCollections
            .Include(c => c.Watches)
                .ThenInclude(cw => cw.Watch)
            .FirstOrDefaultAsync(c => c.Id == collectionId);

        if (collection == null)
            throw new InvalidOperationException("Collection not found.");

        if (collection.UserId != userId)
            throw new UnauthorizedAccessException("Not authorised to rename this collection.");

        var duplicate = await _context.UserCollections
            .AnyAsync(c => c.UserId == userId && c.Id != collectionId && c.Name.ToLower() == newName.ToLower());

        if (duplicate)
            throw new InvalidOperationException($"A collection named \"{newName}\" already exists.");

        collection.Name = newName;
        collection.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new UserCollectionDto
        {
            Id = collection.Id,
            Name = collection.Name,
            WatchIds = collection.Watches.Select(w => w.WatchId).ToArray(),
            PreviewImages = collection.Watches
                .OrderByDescending(w => w.AddedAt)
                .Where(w => !string.IsNullOrEmpty(w.Watch?.Image))
                .Take(4)
                .Select(w => w.Watch!.Image!)
                .ToArray(),
            CreatedAt = collection.CreatedAt,
            UpdatedAt = collection.UpdatedAt,
        };
    }

    // Deletes a collection; only the owning user may delete their own collection.
    public async Task DeleteCollectionAsync(int userId, int collectionId)
    {
        var collection = await _context.UserCollections
            .FirstOrDefaultAsync(c => c.Id == collectionId);

        if (collection == null)
            throw new InvalidOperationException("Collection not found.");

        if (collection.UserId != userId)
            throw new UnauthorizedAccessException("Not authorised to delete this collection.");

        _context.UserCollections.Remove(collection);
        await _context.SaveChangesAsync();
    }

    // Adds a watch to a collection; idempotent. Updates collection's UpdatedAt timestamp.
    public async Task AddToCollectionAsync(int userId, int collectionId, int watchId)
    {
        var collection = await _context.UserCollections
            .Include(c => c.Watches)
            .FirstOrDefaultAsync(c => c.Id == collectionId);

        if (collection == null)
            throw new InvalidOperationException("Collection not found.");

        if (collection.UserId != userId)
            throw new UnauthorizedAccessException("Not authorised to modify this collection.");

        var alreadyIn = collection.Watches.Any(w => w.WatchId == watchId);
        if (!alreadyIn)
        {
            collection.Watches.Add(new UserCollectionWatch
            {
                UserCollectionId = collectionId,
                WatchId = watchId,
                AddedAt = DateTime.UtcNow,
            });
            collection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    // Removes a watch from a collection. Updates UpdatedAt on change.
    public async Task RemoveFromCollectionAsync(int userId, int collectionId, int watchId)
    {
        var collection = await _context.UserCollections
            .Include(c => c.Watches)
            .FirstOrDefaultAsync(c => c.Id == collectionId);

        if (collection == null)
            throw new InvalidOperationException("Collection not found.");

        if (collection.UserId != userId)
            throw new UnauthorizedAccessException("Not authorised to modify this collection.");

        var entry = collection.Watches.FirstOrDefault(w => w.WatchId == watchId);
        if (entry != null)
        {
            collection.Watches.Remove(entry);
            collection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
