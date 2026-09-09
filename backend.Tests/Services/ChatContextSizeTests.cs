// Tests for the catalogue context sent to the wording model.
// The model's job on this call is prose, not reproducing the catalogue, so the context carries
// the fields a buyer asks about and drops the ones that never reach an answer. The size
// assertions are part of the contract: this text is sent for every card on every turn, and a
// regression that puts the raw JSON back would not fail any behavioural test.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class ChatContextSizeTests
{
    private const string RealSpecs = """
    {"productionStatus":"Current production",
     "dial":{"color":"Blue","finish":"Sunburst","indices":"Applied baton","hands":"Dauphine"},
     "case":{"material":"Stainless steel","diameter":"40 mm","thickness":"9.24 mm",
             "waterResistance":"100 m / 10 bar","crystal":"Sapphire with anti-reflective coating",
             "caseBack":"Transparent sapphire crystal"},
     "movement":{"caliber":"Calibre 26-330 S C","type":"Automatic","powerReserve":"45 hours",
                 "frequency":"28,800 vph (4 Hz)","jewels":30,
                 "functions":["Hours","Minutes","Central seconds","Date"]},
     "strap":{"material":"Alligator leather","color":"Blue","buckle":"Fold clasp"}}
    """;

    // -- What has to survive ---------------------------------------------------

    [Theory]
    [InlineData("Stainless steel")]
    [InlineData("40 mm")]
    [InlineData("100 m / 10 bar")]
    [InlineData("Blue dial")]
    [InlineData("Automatic")]
    [InlineData("45 hours")]
    [InlineData("Date")]
    [InlineData("Alligator leather")]
    public void FieldsBuyersAskAboutAreKept(string expected)
    {
        Assert.Contains(expected, ChatService.BuildChatSpecs(RealSpecs), StringComparison.OrdinalIgnoreCase);
    }

    // -- What is dropped -------------------------------------------------------

    [Theory]
    [InlineData("Calibre 26-330")]   // caliber name
    [InlineData("28,800 vph")]       // beat rate
    [InlineData("Fold clasp")]       // buckle type
    [InlineData("anti-reflective")]  // crystal coating
    [InlineData("Dauphine")]         // hand style
    public void DetailThatNeverReachesAnAnswerIsDropped(string absent)
    {
        Assert.DoesNotContain(absent, ChatService.BuildChatSpecs(RealSpecs), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TheSummaryIsAFractionOfTheRawJson()
    {
        var summary = ChatService.BuildChatSpecs(RealSpecs);

        Assert.True(summary.Length < RealSpecs.Length / 3,
            $"expected under a third of {RealSpecs.Length} chars, got {summary.Length}");
    }

    // -- Malformed input must not take the chat down ---------------------------

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json at all")]
    [InlineData("{\"case\":")]
    public void BadSpecsYieldAnEmptySummary(string? specs)
    {
        Assert.Equal("", ChatService.BuildChatSpecs(specs));
    }

    [Fact]
    public void MissingSectionsAreSkippedWithoutBlanks()
    {
        var summary = ChatService.BuildChatSpecs("""{"case":{"material":"Titanium"}}""");

        Assert.Equal("Titanium", summary);
    }

    // -- Description trimming --------------------------------------------------

    [Fact]
    public void ShortDescriptionsArePassedThroughUntouched()
    {
        const string text = "A slim dress watch in white gold.";
        Assert.Equal(text, ChatService.Summarise(text));
    }

    [Fact]
    public void LongDescriptionsAreCutOnASentenceBoundary()
    {
        var text = string.Join(" ", Enumerable.Repeat("This is a sentence about the watch.", 12));
        var summary = ChatService.Summarise(text);

        Assert.True(summary.Length < text.Length);
        Assert.EndsWith(".", summary);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyDescriptionsSummariseToEmpty(string? text)
    {
        Assert.Equal("", ChatService.Summarise(text));
    }
}
