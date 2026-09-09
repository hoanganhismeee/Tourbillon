// Tests for dial colour as a deterministic filter dimension.
// The catalogue stores dial colour as scraped free text with 112 distinct spellings, so
// "argenté", "silver-toned" and "silvered grey" all have to reach the same bucket. Before
// this, dial queries had no filter to match on and fell through to the vector pipeline,
// where they scored worse than the plain keyword index while costing 200x the latency.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class WatchFinderDialColourTests
{
    // -- Normalising the catalogue's spellings ---------------------------------

    [Theory]
    [InlineData("Silver", "Silver")]
    [InlineData("silver-toned", "Silver")]
    [InlineData("Argenté", "Silver")]
    [InlineData("argente", "Silver")]
    [InlineData("Silver guilloché", "Silver")]
    [InlineData("silvered grey", "Silver")]
    public void SilverSpellingsCollapseToOneBucket(string stored, string expected)
    {
        Assert.Equal(expected, WatchFinderService.NormaliseDialColour(stored));
    }

    [Theory]
    [InlineData("Blue", "Blue")]
    [InlineData("Deep blue sunburst", "Blue")]
    [InlineData("Black", "Black")]
    [InlineData("Openworked", "Skeleton")]
    [InlineData("White mother-of-pearl", "White")]
    [InlineData("Anthracite", "Grey")]
    public void OtherColoursMapToTheirBucket(string stored, string expected)
    {
        Assert.Equal(expected, WatchFinderService.NormaliseDialColour(stored));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("relief sculpture dial")]
    public void UnrecognisedDialsReturnNull(string? stored)
    {
        Assert.Null(WatchFinderService.NormaliseDialColour(stored));
    }

    // -- Reading a colour out of a query ---------------------------------------

    [Theory]
    [InlineData("blue dial", "Blue")]
    [InlineData("argenté dial", "Silver")]
    [InlineData("silver-toned dial", "Silver")]
    [InlineData("a deep blue face", "Blue")]
    [InlineData("green dial sports watch on a bracelet", "Green")]
    public void DialQueriesExtractTheColour(string query, string expected)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);
        Assert.Equal(expected, intent.DialColour);
    }

    // A colour with no dial word usually describes the case or the strap. Treating it as a
    // dial filter would drop every rose gold watch from a rose gold case query.
    [Theory]
    [InlineData("rose gold watch")]
    [InlineData("steel sports watch")]
    [InlineData("black leather strap")]
    public void ColoursNotAttachedToTheDialAreIgnored(string query)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);
        Assert.Null(intent.DialColour);
    }

    [Fact]
    public void MaterialAndDialColourAreReadIndependently()
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("steel watch with a blue dial", intent);

        Assert.Equal("Steel", intent.CaseMaterial);
        Assert.Equal("Blue", intent.DialColour);
    }

    // A dial colour on its own is enough to serve the query from SQL rather than the vector
    // pipeline — that routing change is the whole point of the dimension existing.
    [Fact]
    public void ADialColourAloneCountsAsADeterministicFilter()
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("argenté dial", intent);

        Assert.NotNull(intent.DialColour);
    }

    // -- The user's own wording -------------------------------------------------
    // Matching is done on the bucket so nothing in the colour family is missed, but the
    // spelling the user typed has to rank first. Asking for "argenté" and getting fifteen
    // silver watches with no argenté among them reads as a miss, however defensible the
    // grouping is.

    [Theory]
    [InlineData("argenté dial", "argenté")]
    [InlineData("silver-toned dial", "silver-toned")]
    [InlineData("blue dial", "blue")]
    public void TheTypedSpellingIsKeptAlongsideTheBucket(string query, string phrase)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);

        Assert.NotNull(intent.DialColour);
        Assert.Equal(phrase, intent.DialColourPhrase, ignoreCase: true);
    }

    [Fact]
    public void NoPhraseIsKeptWhenNoColourWasRecognised()
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("relief sculpture dial", intent);

        Assert.Null(intent.DialColour);
        Assert.Null(intent.DialColourPhrase);
    }

    [Fact]
    public void AWatchMatchingTheTypedSpellingOutranksOneMatchingOnlyTheBucket()
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("argenté dial", intent);

        var exact = WatchWithDial("Argenté guilloché");
        var bucketOnly = WatchWithDial("Silver sunburst");

        var exactScore = WatchFinderService.DeterministicMatchScore(exact, intent, []);
        var bucketScore = WatchFinderService.DeterministicMatchScore(bucketOnly, intent, []);

        Assert.True(exactScore > bucketScore,
            $"expected the typed spelling to rank higher, got {exactScore} vs {bucketScore}");
    }

    private static Watch WatchWithDial(string colour) => new()
    {
        Id = 1,
        Name = "TEST-1",
        Specs = "{\"dial\":{\"color\":\"" + colour + "\"}}",
    };
}
