// "Grand" is both a money unit and the first word of two collections in this catalogue.
// Resolving it as a collection turned "nothing over twenty grand" into a search scoped to
// Grand Complications under a $20,000 ceiling, which matches nothing — the query returned
// zero results while the intent looked correct in every log line.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class WatchFinderMoneyWordCollisionTests
{
    private static readonly List<Collection> Collections =
    [
        new() { Id = 1, Name = "Grand Complications", Slug = "grand-complications", BrandId = 1 },
        new() { Id = 2, Name = "Nautilus", Slug = "nautilus", BrandId = 1 },
        new() { Id = 3, Name = "Calatrava", Slug = "calatrava", BrandId = 1 },
    ];

    private static List<Collection> Resolve(string query) =>
        WatchFinderService.ResolveFuzzyCollections(query, Collections, []);

    // -- The collision -----------------------------------------------------------

    [Theory]
    [InlineData("nothing over twenty grand please")]
    [InlineData("under fifty grand")]
    [InlineData("something around ten grand")]
    public void GrandAsAMoneyUnitResolvesNoCollection(string query)
    {
        Assert.Empty(Resolve(query));
    }

    // -- The name still has to resolve -------------------------------------------

    [Theory]
    [InlineData("Grand Complications")]
    [InlineData("show me the Grand Complications")]
    [InlineData("patek grand complications moon phase")]
    public void GrandAsPartOfANameStillResolves(string query)
    {
        Assert.Contains(Resolve(query), c => c.Id == 1);
    }

    // Both in one sentence: the name is wanted, the amount is not.
    [Fact]
    public void ANameAndAnAmountInTheSameQueryAreToldApart()
    {
        var matches = Resolve("Grand Complications under twenty grand");

        Assert.Contains(matches, c => c.Id == 1);
    }

    [Fact]
    public void OtherCollectionsAreUnaffected()
    {
        Assert.Contains(Resolve("nautilus"), c => c.Id == 2);
        Assert.Empty(Resolve("nothing over twenty grand please"));
    }
}
