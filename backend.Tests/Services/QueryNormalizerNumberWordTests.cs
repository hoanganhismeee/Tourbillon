// Unit tests for spelled-out number handling in QueryNormalizer.
// A price is structural, so extracting one must not need a model — these cover the phrasings
// that previously fell through to the LLM parse, and the brand names that must survive intact.
using backend.Services;

namespace backend.Tests.Services;

public class QueryNormalizerNumberWordTests
{
    [Theory]
    [InlineData("fifty thousand dollars", "50000 dollars")]
    [InlineData("under twenty grand", "under 20000")]
    [InlineData("about fifty k", "about 50000")]
    [InlineData("twenty five thousand", "25000")]
    [InlineData("a hundred thousand", "100000")]
    [InlineData("two million", "2000000")]
    [InlineData("between ten thousand and thirty thousand", "between 10000 and 30000")]
    public void NormalizeNumberWords_RewritesSpelledOutAmounts(string input, string expected)
    {
        Assert.Equal(expected, QueryNormalizer.NormalizeNumberWords(input));
    }

    // "Grand" and "K" are ordinary words in catalogue names. A scale word only counts when a
    // number precedes it, which is what keeps these from turning into figures.
    [Theory]
    [InlineData("Grand Seiko")]
    [InlineData("Grand Complications")]
    [InlineData("Grand Feu enamel dial")]
    public void NormalizeNumberWords_LeavesBrandAndCollectionNamesAlone(string input)
    {
        Assert.Equal(input, QueryNormalizer.NormalizeNumberWords(input));
    }

    // A bare number word is not unambiguously a price, so it is left for the existing patterns.
    [Theory]
    [InlineData("one of the best dress watches")]
    [InlineData("show me five options")]
    public void NormalizeNumberWords_LeavesUnscaledNumbersAlone(string input)
    {
        Assert.Equal(input, QueryNormalizer.NormalizeNumberWords(input));
    }

    [Fact]
    public void NormalizeNumberWords_HandlesEmptyInput()
    {
        Assert.Equal("", QueryNormalizer.NormalizeNumberWords(""));
    }

    // End to end through the regex filters: these are the queries the eval saw take the LLM
    // parse detour, and they must now resolve to a price without one.
    [Theory]
    [InlineData("my budget is around fifty thousand dollars", 37000, 63000)]
    [InlineData("nothing over twenty grand please", null, null)]
    public void ApplyRegexFilters_ExtractsSpelledOutBudget(string query, int? minPrice, int? maxPrice)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);

        if (minPrice.HasValue) Assert.Equal(minPrice.Value, intent.MinPrice);
        if (maxPrice.HasValue) Assert.Equal(maxPrice.Value, intent.MaxPrice);
    }

    [Fact]
    public void ApplyRegexFilters_ReadsSpelledOutUpperBound()
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("dress watches under twenty thousand", intent);

        Assert.Equal(20000m, intent.MaxPrice);
    }
}
