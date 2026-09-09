// Two failures the labelled query set surfaced, both of which returned the opposite of what
// was asked rather than merely a weaker result:
//   - "automatic" matched only the literal spelling, so 97 of 228 automatic watches were
//     invisible because their brand writes "Self-winding".
//   - "nothing over twenty grand" matched the lower-bound pattern and became a floor of
//     20,000, returning only the watches the user had ruled out.
using backend.Services;

namespace backend.Tests.Services;

public class WatchFinderMovementAndBoundTests
{
    private static QueryIntent Parse(string query)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);
        return intent;
    }

    // -- Movement spellings ----------------------------------------------------

    [Theory]
    [InlineData("Automatic", "Automatic")]
    [InlineData("Self-winding", "Automatic")]
    [InlineData("self winding", "Automatic")]
    [InlineData("Automatic manufacture", "Automatic")]
    [InlineData("Spring Drive automatic", "Automatic")]
    [InlineData("perpetual, mechanical, self-winding, gmt", "Automatic")]
    public void AutomaticSpellingsCollapseToOneFamily(string stored, string expected)
    {
        Assert.Equal(expected, WatchFinderService.NormaliseMovementFamily(stored));
    }

    [Theory]
    [InlineData("Manual-winding", "Manual")]
    [InlineData("Manual winding", "Manual")]
    [InlineData("Hand-wound", "Manual")]
    [InlineData("Manual-winding hi-beat", "Manual")]
    public void ManualSpellingsCollapseToOneFamily(string stored, string expected)
    {
        Assert.Equal(expected, WatchFinderService.NormaliseMovementFamily(stored));
    }

    [Theory]
    [InlineData("Quartz", "Quartz")]
    [InlineData("Electromechanical", "Quartz")]
    public void QuartzSpellingsCollapseToOneFamily(string stored, string expected)
    {
        Assert.Equal(expected, WatchFinderService.NormaliseMovementFamily(stored));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("tourbillon regulator")]
    public void UnrecognisedMovementsReturnNull(string? stored)
    {
        Assert.Null(WatchFinderService.NormaliseMovementFamily(stored));
    }

    // A query saying "automatic" and a catalogue saying "Self-winding" have to meet.
    [Fact]
    public void AQueryAndTheCatalogueMeetOnTheFamily()
    {
        var intent = Parse("steel automatic under 40mm with a date window");

        Assert.Equal(
            WatchFinderService.NormaliseMovementFamily(intent.MovementType),
            WatchFinderService.NormaliseMovementFamily("Self-winding"));
    }

    // -- Negated price bounds --------------------------------------------------

    [Theory]
    [InlineData("nothing over twenty grand please", 20000)]
    [InlineData("nothing over 20k", 20000)]
    [InlineData("no more than 30000", 30000)]
    [InlineData("not more than fifty thousand", 50000)]
    public void NothingOverXIsACeiling(string query, int expectedMax)
    {
        var intent = Parse(query);

        Assert.Equal(expectedMax, intent.MaxPrice);
        Assert.Null(intent.MinPrice);
    }

    // The plain form still has to read as a floor — the fix must not invert it in turn.
    [Theory]
    [InlineData("watches over 20k", 20000)]
    [InlineData("something above fifty thousand", 50000)]
    public void PlainOverXIsStillAFloor(string query, int expectedMin)
    {
        var intent = Parse(query);

        Assert.Equal(expectedMin, intent.MinPrice);
        Assert.Null(intent.MaxPrice);
    }

    [Fact]
    public void ARangeIsUnaffected()
    {
        var intent = Parse("watch between 10k and 30k");

        Assert.Equal(10000, intent.MinPrice);
        Assert.Equal(30000, intent.MaxPrice);
    }

    // -- Diameter bounds -------------------------------------------------------
    // "under 40mm" used to fall through to the bare-figure pattern and pin the diameter to
    // exactly 40.0, dropping every smaller watch the user asked for. Worse, the price pattern
    // backtracked past its own guard and read "40mm" as a $4,000 ceiling, so the query filtered
    // on a budget nobody mentioned and returned nothing at all.

    [Theory]
    [InlineData("steel automatic under 40mm with a date window", 40)]
    [InlineData("dress watch below 38mm", 38)]
    [InlineData("something 36mm or smaller", 36)]
    [InlineData("up to 42mm", 42)]
    public void AnUpperDiameterBoundIsACeiling(string query, double expectedMax)
    {
        var intent = Parse(query);

        Assert.Equal(expectedMax, intent.MaxDiameterMm);
        Assert.Null(intent.MinDiameterMm);
    }

    [Theory]
    [InlineData("watches over 42mm", 42)]
    [InlineData("larger than 44mm", 44)]
    [InlineData("40mm or larger", 40)]
    public void ALowerDiameterBoundIsAFloor(string query, double expectedMin)
    {
        var intent = Parse(query);

        Assert.Equal(expectedMin, intent.MinDiameterMm);
        Assert.Null(intent.MaxDiameterMm);
    }

    [Fact]
    public void ABareFigureStillPinsTheDiameter()
    {
        var intent = Parse("40mm dress watch");

        Assert.Equal(40, intent.MinDiameterMm);
        Assert.Equal(40, intent.MaxDiameterMm);
    }

    [Fact]
    public void ADiameterRangeIsUnaffected()
    {
        var intent = Parse("39 to 40mm dress watch");

        Assert.Equal(39, intent.MinDiameterMm);
        Assert.Equal(40, intent.MaxDiameterMm);
    }

    // The price guard has to reject a millimetre figure outright rather than backtrack onto a
    // shorter prefix of it: "under 40mm" must set no price at all, not a $4,000 ceiling.
    [Theory]
    [InlineData("steel automatic under 40mm with a date window")]
    [InlineData("dress watch below 38mm")]
    public void AMillimetreFigureIsNeverReadAsAPrice(string query)
    {
        var intent = Parse(query);

        Assert.Null(intent.MaxPrice);
        Assert.Null(intent.MinPrice);
    }

    [Fact]
    public void APriceAndADiameterInTheSameQueryBothParse()
    {
        var intent = Parse("40mm dress watch under 50k");

        Assert.Equal(50000, intent.MaxPrice);
        Assert.Equal(40, intent.MaxDiameterMm);
    }
}
