// Tests for reading water resistance from a stated use. The phrasings here are deliberately not the
// ones in the evaluation set, so a pass says the rule generalises rather than that it was fitted.
using backend.Services;

namespace backend.Tests.Services;

public class WaterResistancePhraseTests
{
    private static QueryIntent Parse(string query)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);
        return intent;
    }

    [Theory]
    [InlineData("a professional diver for wreck trips", "300")]
    [InlineData("something for deep diving", "300")]
    [InlineData("a watch for scuba holidays", "200")]
    [InlineData("I want to take it diving on holiday", "200")]
    [InlineData("something to wear while swimming laps", "100")]
    [InlineData("good for snorkelling", "100")]
    public void A_stated_use_sets_a_water_resistance_floor(string query, string expectedMetres)
    {
        Assert.Equal(expectedMetres, Parse(query).WaterResistance);
    }

    [Fact]
    public void A_stated_rating_wins_over_the_use()
    {
        var intent = Parse("a 500m diver");

        Assert.Equal("500", intent.WaterResistance);
        Assert.Equal(new[] { "600m+" }, intent.WaterResistanceBuckets);
    }

    [Fact]
    public void The_floor_ticks_every_bucket_at_or_above_it()
    {
        Assert.Equal(
            new[] { "50m – 120m", "150m – 300m", "600m+" },
            Parse("something to wear while swimming").WaterResistanceBuckets);
    }

    [Theory]
    [InlineData("a dress watch for the office")]
    [InlineData("something for a beach holiday")]
    // A category noun is a style, not a use: the buckets filter client-side, and a floor here
    // would hide divers rated at the 100m minimum.
    [InlineData("dive watch")]
    [InlineData("Rolex divers under 20k")]
    [InlineData("a diving watch")]
    public void Queries_with_no_water_use_set_no_floor(string query)
    {
        var intent = Parse(query);

        Assert.Null(intent.WaterResistance);
        Assert.Empty(intent.WaterResistanceBuckets);
    }
}
