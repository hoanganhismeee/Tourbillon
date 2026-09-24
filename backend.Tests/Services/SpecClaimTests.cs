// A reply may only state figures the watches it names can defend.
//
// Grading 36 held-out replies found six claiming a spec the cards do not carry: "65+ hours power
// reserve" for a movement with 45, an integrated bracelet on a watch sold on leather. Every other
// check in the concierge asks whether a name was allowed; this one asks whether the sentence about
// it is true. The risk runs the other way too — a check that fires on ordinary advice would push
// every reply down to deterministic wording, so most of these tests are about what it leaves alone.
using backend.Services;

namespace backend.Tests.Services;

public class SpecClaimTests
{
    private static List<string> Context() =>
    [
        "Watch \"Omega Seamaster 210.30.42.20.01.001 Diver 300M\" (Slug: omega-seamaster-210): Brand Omega (Slug: omega); "
        + "Collection Seamaster (Slug: omega-seamaster); Price $10,525; Description A diver; "
        + "Specs Stainless steel; 42 mm; water resistance 300 m; Black dial; Automatic; power reserve 55 hours; Hours, Minutes, Date; Steel bracelet",
        "Watch \"Patek Philippe Calatrava 6119R-001\" (Slug: patek-calatrava-6119r): Brand Patek Philippe (Slug: patek-philippe); "
        + "Collection Calatrava (Slug: patek-philippe-calatrava); Price $38,900; Description A dress watch; "
        + "Specs Rose gold; 39 mm; water resistance 30 m; Silver dial; Manual-winding; power reserve 65 hours; Hours, Minutes, Small seconds; Alligator leather",
    ];

    [Fact]
    public void APowerReserveTheMovementDoesNotHaveIsRejected()
    {
        // The exact shape the reply judge caught: a real watch, a figure from nowhere.
        var claim = ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 runs 80 hours on a single wind.", Context());

        Assert.Equal("80 hours", claim);
    }

    [Fact]
    public void AFigureTheRecordCarriesPasses()
    {
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The Seamaster 210.30.42.20.01.001 is 42 mm with 300 m of water resistance and 55 hours of reserve.",
            Context()));
    }

    [Fact]
    public void APriceIsCheckedExactly()
    {
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 is $38,900.", Context()));
        Assert.Equal("$12,000", ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 is $12,000.", Context()));
    }

    [Fact]
    public void AdviceWithNoWatchNamedIsLeftAlone()
    {
        // The advisor persona exists to say things like this, and none of it is a claim about a
        // catalogue record.
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "For a dress watch I would stay under 40 mm, and 100 m of water resistance is plenty for daily wear.",
            Context()));
    }

    [Fact]
    public void AHedgedFigureBesideAWatchIsAJudgementNotAClaim()
    {
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 sits under 40 mm, which is why it disappears under a cuff.",
            Context()));
    }

    [Fact]
    public void ARoundedMillimetreIsStillTheSameCase()
    {
        // 39 mm written as 40 mm in passing is prose, not a wrong number worth failing a draft for.
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 is a 40 mm dress watch.", Context()));
    }

    [Fact]
    public void AFigureIsCheckedAgainstTheWatchTheSentenceNames()
    {
        // 55 hours belongs to the Seamaster; saying it of the Calatrava is still wrong.
        Assert.Equal("55 hours", ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 holds 55 hours.", Context()));
    }

    [Fact]
    public void OrdinaryNumbersInProseAreNotClaims()
    {
        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The Calatrava 6119R-001 draws on a shape Patek Philippe has built since the 1930s, and two of its hands are blued.",
            Context()));
    }

    [Fact]
    public void AFigureInsideTheWatchesOwnNameIsNotAClaim()
    {
        // Some names carry the size: quoting the name back is not a statement about the record.
        var context = new List<string>
        {
            "Watch \"F.P.Journe lineSport elegante 40mm Titalyt\" (Slug: fp-journe-elegante-40mm): Brand F.P.Journe; "
            + "Collection lineSport; Price $22,000; Description A sports watch; Specs Titalyt; Quartz",
        };

        Assert.Null(ChatService.UnsupportedSpecClaim(
            "The lineSport elegante 40mm Titalyt is the one to wear daily.", context));
    }

    [Fact]
    public void AReferenceIsNotASourceOfFigures()
    {
        // "210.30.42.20.01.001" is not evidence that the watch is 30 m water resistant.
        var context = new List<string>
        {
            "Watch \"Omega Seamaster 210.30.42.20.01.001 Diver 300M\" (Slug: omega-seamaster-210): Brand Omega; "
            + "Collection Seamaster; Price $10,525; Description A diver; Specs Stainless steel; 42 mm; water resistance 300 m",
        };

        Assert.Equal("20 hours", ChatService.UnsupportedSpecClaim(
            "The Seamaster 210.30.42.20.01.001 holds 20 hours of reserve.", context));
    }

    [Fact]
    public void NoContextMeansNothingToCheck()
    {
        Assert.Null(ChatService.UnsupportedSpecClaim("Anything at all, 99 mm wide.", []));
    }
}
