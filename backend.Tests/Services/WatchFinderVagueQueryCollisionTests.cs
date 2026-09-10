// Vague, occasion-shaped queries were being claimed by the deterministic SQL tier because a
// single ordinary English word matched a collection name. "small enough for a thin wrist" hit
// Master Ultra Thin; "first serious watch for someone starting a collection" hit the Greubel
// Forsey collection literally named "Collection". Each match then inferred a brand, which made
// ShouldUseDeterministicCataloguePath true and returned a handful of arbitrary watches instead
// of falling through to the semantic tier the query actually needed.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class WatchFinderVagueQueryCollisionTests
{
    private static readonly List<Collection> Collections =
    [
        new() { Id = 1, Name = "Master Ultra Thin", Slug = "master-ultra-thin", BrandId = 4 },
        new() { Id = 2, Name = "Collection", Slug = "collection", BrandId = 8 },
        new() { Id = 3, Name = "Royal Oak Offshore", Slug = "royal-oak-offshore", BrandId = 2 },
        new() { Id = 4, Name = "Nautilus", Slug = "nautilus", BrandId = 1 },
    ];

    private static List<Collection> Resolve(string query) =>
        WatchFinderService.ResolveFuzzyCollections(query, Collections, []);

    // Scoped to a brand the user actually named — the pool is that brand's shelf.
    private static List<Collection> ResolveWithinBrand(string query, int brandId) =>
        WatchFinderService.ResolveFuzzyCollections(query, Collections, [brandId]);

    // -- The collision -----------------------------------------------------------

    [Theory]
    [InlineData("small enough for a thin wrist")]
    [InlineData("first serious watch for someone starting a collection")]
    [InlineData("what should I wear to a formal dinner")]
    [InlineData("something with presence on the wrist")]
    public void VagueQueriesResolveNoCollection(string query)
    {
        Assert.Empty(Resolve(query));
    }

    // -- Names still have to resolve ---------------------------------------------

    [Theory]
    [InlineData("Master Ultra Thin")]
    [InlineData("show me the master ultra thin")]
    [InlineData("nautilus")]
    [InlineData("royal oak offshore chronograph")]
    public void NamingACollectionStillResolvesIt(string query)
    {
        Assert.NotEmpty(Resolve(query));
    }

    // -- A pinned brand restores partial matching --------------------------------

    // Inside one brand's collections a partial token is meaningful again, and the brand it
    // implies is one the user already stated, so nothing is inferred that was not said.
    [Fact]
    public void APartialTokenCountsOnceTheBrandIsPinned()
    {
        Assert.Contains(ResolveWithinBrand("jaeger-lecoultre ultra thin", 4), c => c.Id == 1);
    }

    // The generic name stays unmatchable even in scope: nothing distinguishes it from the word.
    [Fact]
    public void AGenericCollectionNameNeverMatchesOnTheWordAlone()
    {
        Assert.Empty(Resolve("starting a collection"));
        Assert.Empty(Resolve("a collection of watches"));
    }

    // -- The same guard on the exact-name path -----------------------------------

    // ParseQueryIntentAsync matches names by containment before fuzzy scoring ever runs, so the
    // guard has to hold there too — that path, not the fuzzy one, is what actually resolved
    // "Collection" in production.
    private static bool Names(int collectionId, string query) =>
        WatchFinderService.QueryNamesCollection(
            Collections.First(c => c.Id == collectionId),
            query,
            QueryNormalizer.CompactText(query));

    [Theory]
    [InlineData("first serious watch for someone starting a collection")]
    [InlineData("help me build a collection")]
    public void ContainmentIgnoresACollectionNamedAfterAnOrdinaryWord(string query)
    {
        Assert.False(Names(2, query));
    }

    [Theory]
    [InlineData("master ultra thin")]
    [InlineData("the Master Ultra Thin in rose gold")]
    public void ContainmentStillFindsARealName(string query)
    {
        Assert.True(Names(1, query));
    }

    [Fact]
    public void ContainmentIgnoresSpacingTheWayItAlwaysDid()
    {
        Assert.True(Names(3, "royaloak offshore please"));
    }
}
