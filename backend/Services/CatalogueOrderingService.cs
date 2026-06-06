// Catalogue ordering for the watches page: the merchandising "featured" order and the
// taste-personalized re-rank. Ported from the frontend WatchOrderingService so the ranking
// logic lives in one authoritative place. Filtering, price sort, and pagination stay
// client-side. Personalized scoring reuses TasteProfileService.ScoreWatch (single source).
using System.Text.RegularExpressions;
using backend.DTOs;
using backend.Models;

namespace backend.Services;

public class CatalogueOrderingService
{
    private const string FeaturedSeed = "tourbillon-featured-v2";
    private const int PersonalizedWindowSize = 48;
    private const int PersonalizedMinScore = 1;

    // Brand merchandising weights: priority breaks ties, weight controls interleave cadence.
    private static readonly (string Key, int Priority, int Weight)[] FeaturedBrandRules =
    {
        ("patek philippe", 60, 5),
        ("vacheron constantin", 54, 4),
        ("audemars piguet", 50, 4),
        ("rolex", 46, 4),
        ("jaeger lecoultre", 40, 3),
        ("omega", 34, 3),
    };

    private static readonly (string Key, int Priority)[] FeaturedCollectionRules =
    {
        ("reverso", 8),
        ("speedmaster", 7),
    };

    // Diversity caps: at most N of one brand before the given result position.
    private static readonly (int UntilPositionExclusive, int Cap)[] BrandCapRules =
    {
        (12, 3),
        (24, 5),
    };

    private sealed class BrandQueue
    {
        public int Priority;
        public int Weight;
        public int Shown;
        public Queue<WatchDto> Queue = new();
        public uint TieBreaker;
    }

    private sealed class RankedWatch
    {
        public required WatchDto Watch;
        public int BaseIndex;
        public int Score;
    }

    // Stable merchandising order: weighted round-robin across brands, each brand's queue
    // built by interleaving its collections so no single collection clusters at the top.
    public List<WatchDto> BuildFeaturedOrder(List<WatchDto> watches, List<Brand> brands, List<Collection> collections)
    {
        var brandIdentityById = brands.ToDictionary(b => b.Id, b => NormalizeIdentity($"{b.Slug} {b.Name}"));
        var collectionIdentityById = collections.ToDictionary(c => c.Id, c => NormalizeIdentity($"{c.Slug} {c.Name}"));

        var brandBuckets = new Dictionary<int, List<WatchDto>>();
        foreach (var watch in watches)
        {
            if (!brandBuckets.TryGetValue(watch.BrandId, out var bucket))
            {
                bucket = new List<WatchDto>();
                brandBuckets[watch.BrandId] = bucket;
            }
            bucket.Add(watch);
        }

        var brandQueues = brandBuckets.Select(entry =>
        {
            var identity = brandIdentityById.GetValueOrDefault(entry.Key, "");
            return new BrandQueue
            {
                Priority = GetFeaturedBrandPriority(identity),
                Weight = GetFeaturedBrandWeight(identity),
                Shown = 0,
                Queue = new Queue<WatchDto>(InterleaveWithinBrand(entry.Value, collectionIdentityById, $"{FeaturedSeed}:{entry.Key}")),
                TieBreaker = StableHash($"{FeaturedSeed}:brand:{entry.Key}"),
            };
        }).ToList();

        var result = new List<WatchDto>();
        while (brandQueues.Any(q => q.Queue.Count > 0))
        {
            var selected = brandQueues
                .Where(q => q.Queue.Count > 0)
                .OrderBy(q => (double)q.Shown / q.Weight)
                .ThenByDescending(q => q.Priority)
                .ThenBy(q => q.TieBreaker)
                .First();

            result.Add(selected.Queue.Dequeue());
            selected.Shown += 1;
        }

        return result;
    }

    // Re-rank the featured head by taste score, keeping brand-diversity caps; the tail past
    // the scoring window is left untouched. Returns the base order if nothing scores.
    public List<WatchDto> BuildPersonalizedOrder(List<WatchDto> baseWatches, TasteProfileDto profile)
    {
        var ranked = baseWatches
            .Select((watch, baseIndex) => new RankedWatch
            {
                Watch = watch,
                BaseIndex = baseIndex,
                Score = TasteProfileService.ScoreWatch(watch, profile),
            })
            .ToList();

        var head = ranked.Take(PersonalizedWindowSize).ToList();
        var tail = ranked.Skip(PersonalizedWindowSize).ToList();

        var promoted = head
            .Where(item => item.Score >= PersonalizedMinScore)
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.BaseIndex)
            .ToList();

        if (promoted.Count == 0) return baseWatches;

        var headByBaseOrder = head.OrderBy(item => item.BaseIndex).ToList();
        var result = new List<RankedWatch>();
        var usedIds = new HashSet<int>();
        var deferred = new List<RankedWatch>();
        var brandCounts = new Dictionary<int, int>();

        foreach (var candidate in promoted)
        {
            var count = brandCounts.GetValueOrDefault(candidate.Watch.BrandId);
            if (count >= BrandCapForPosition(result.Count))
            {
                deferred.Add(candidate);
                continue;
            }
            result.Add(candidate);
            usedIds.Add(candidate.Watch.Id);
            brandCounts[candidate.Watch.BrandId] = count + 1;
        }

        foreach (var candidate in headByBaseOrder)
        {
            if (usedIds.Contains(candidate.Watch.Id)) continue;

            var count = brandCounts.GetValueOrDefault(candidate.Watch.BrandId);
            if (count >= BrandCapForPosition(result.Count))
            {
                deferred.Add(candidate);
                continue;
            }
            result.Add(candidate);
            usedIds.Add(candidate.Watch.Id);
            brandCounts[candidate.Watch.BrandId] = count + 1;
        }

        foreach (var candidate in deferred.OrderBy(item => item.BaseIndex))
        {
            if (usedIds.Add(candidate.Watch.Id))
                result.Add(candidate);
        }

        return result.Concat(tail).Select(item => item.Watch).ToList();
    }

    // Round-robin across a brand's collections so its watches don't cluster by collection.
    private List<WatchDto> InterleaveWithinBrand(
        List<WatchDto> watches,
        IReadOnlyDictionary<int, string> collectionIdentityById,
        string seed)
    {
        var byCollection = new Dictionary<string, List<WatchDto>>();
        foreach (var watch in watches)
        {
            var key = !string.IsNullOrEmpty(watch.CollectionSlug) ? watch.CollectionSlug! : $"watch:{watch.Id}";
            if (!byCollection.TryGetValue(key, out var group))
            {
                group = new List<WatchDto>();
                byCollection[key] = group;
            }
            group.Add(watch);
        }

        var groups = byCollection
            .OrderBy(entry => StableHash($"{seed}:collection:{entry.Key}"))
            .Select(entry => entry.Value
                .OrderByDescending(w => GetCollectionPriority(w, collectionIdentityById))
                .ThenBy(w => StableHash($"{seed}:watch:{entry.Key}:{w.Id}"))
                .ToList())
            .ToList();

        var result = new List<WatchDto>();
        var maxLength = groups.Count == 0 ? 0 : groups.Max(g => g.Count);
        for (var i = 0; i < maxLength; i++)
            foreach (var group in groups)
                if (i < group.Count) result.Add(group[i]);

        return result;
    }

    private static int GetCollectionPriority(WatchDto watch, IReadOnlyDictionary<int, string> collectionIdentityById)
    {
        var identity = watch.CollectionId.HasValue && collectionIdentityById.TryGetValue(watch.CollectionId.Value, out var id)
            ? id
            : NormalizeIdentity(watch.CollectionSlug);
        foreach (var rule in FeaturedCollectionRules)
            if (identity.Contains(rule.Key)) return rule.Priority;
        return 0;
    }

    private static int GetFeaturedBrandPriority(string identity)
    {
        foreach (var rule in FeaturedBrandRules)
            if (identity.Contains(rule.Key)) return rule.Priority;
        return 0;
    }

    private static int GetFeaturedBrandWeight(string identity)
    {
        foreach (var rule in FeaturedBrandRules)
            if (identity.Contains(rule.Key)) return rule.Weight;
        return 1;
    }

    private static int BrandCapForPosition(int position)
    {
        foreach (var rule in BrandCapRules)
            if (position < rule.UntilPositionExclusive) return rule.Cap;
        return int.MaxValue;
    }

    private static string NormalizeIdentity(string? value)
    {
        var normalized = (value ?? "").Trim().ToLowerInvariant();
        normalized = Regex.Replace(normalized, "[^a-z0-9]+", " ");
        normalized = Regex.Replace(normalized, "\\s+", " ");
        return normalized.Trim();
    }

    // FNV-1a 32-bit, matching the frontend's stableHash so featured order is identical.
    private static uint StableHash(string input)
    {
        uint hash = 2166136261;
        foreach (var c in input)
        {
            hash ^= c;
            hash *= 16777619;
        }
        return hash;
    }
}
