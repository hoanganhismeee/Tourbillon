// What a query states has to survive into the results.
//
// Both rules here were written after a benchmark run found them broken. A stated budget admitted
// Price on Request, so "under five thousand" answered with a tourbillon whose price is on request;
// and dial colour, diameter and complications lived in the Specs JSON, which SQL never filtered on,
// so "a green dial, nothing else matters" came back with five non-green dials.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class StatedConstraintTests
{
    private static Watch Watch(int id, decimal price, string specs = "{}") => new()
    {
        Id = id,
        Name = $"ref-{id}",
        CurrentPrice = price,
        Specs = specs,
    };

    private static string Specs(string? dial = null, string? diameter = null, string? water = null, params string[] functions)
    {
        var parts = new List<string>();
        if (diameter != null || water != null)
            parts.Add($"\"case\":{{{string.Join(",", new[] {
                diameter != null ? $"\"diameter\":\"{diameter}\"" : null,
                water != null ? $"\"waterResistance\":\"{water}\"" : null }.Where(p => p != null))}}}");
        if (dial != null) parts.Add($"\"dial\":{{\"color\":\"{dial}\"}}");
        if (functions.Length > 0)
            parts.Add($"\"movement\":{{\"functions\":[{string.Join(",", functions.Select(f => $"\"{f}\""))}]}}");
        return $"{{{string.Join(",", parts)}}}";
    }

    [Fact]
    public void ADialColourTheQueryStatedFiltersTheCandidates()
    {
        var candidates = new List<Watch>
        {
            Watch(1, 5000, Specs(dial: "intense green")),
            Watch(2, 5000, Specs(dial: "blue")),
            Watch(3, 5000, Specs(dial: "black")),
        };

        var kept = StatedConstraintFilter.Apply(candidates, new QueryIntent { DialColour = "green" }, out var applied, out _);

        Assert.True(applied);
        Assert.Equal([1], kept.Select(w => w.Id));
    }

    [Fact]
    public void TheCatalogueSpellingOfAColourStillCounts()
    {
        // "argenté" and "frosted silver" are silver to a buyer; matching the raw string alone would
        // drop them and leave the brief answered with nothing.
        var candidates = new List<Watch>
        {
            Watch(1, 5000, Specs(dial: "argenté")),
            Watch(2, 5000, Specs(dial: "frosted silver")),
            Watch(3, 5000, Specs(dial: "black")),
        };

        var kept = StatedConstraintFilter.Apply(candidates, new QueryIntent { DialColour = "silver" }, out _, out _);

        Assert.Equal([1, 2], kept.Select(w => w.Id));
    }

    [Fact]
    public void ASizeCapAndAnExcludedComplicationBothApply()
    {
        var candidates = new List<Watch>
        {
            Watch(1, 5000, Specs(diameter: "38 mm")),
            Watch(2, 5000, Specs(diameter: "44 mm")),
            Watch(3, 5000, Specs(diameter: "36 mm", functions: "date")),
        };

        var size = StatedConstraintFilter.Apply(candidates, new QueryIntent { MaxDiameterMm = 40 }, out _, out _);
        Assert.Equal([1, 3], size.Select(w => w.Id));

        var noDate = StatedConstraintFilter.Apply(candidates, new QueryIntent { ExcludedComplications = ["date"] }, out _, out _);
        Assert.Equal([1, 2], noDate.Select(w => w.Id));
    }

    [Fact]
    public void TheModelNameCountsAsEvidenceOfAComplication()
    {
        // The catalogue records functions unevenly: this Audemars Piguet lists a chronograph and a
        // GMT and no date at all, though its name says Large Date.
        var largeDate = Watch(1, 5000, Specs(functions: ["Hours", "Split-seconds chronograph"]));
        largeDate.Name = "26650FO.OO.D353CA.01 Split-Seconds Chronograph GMT Large Date";
        var moonwatch = Watch(2, 5000, Specs(functions: ["Hours", "Chronograph"]));
        moonwatch.Name = "310.30.42.50.01.001 Moonwatch Professional";

        var noDate = StatedConstraintFilter.Apply([largeDate, moonwatch], new QueryIntent { ExcludedComplications = ["date"] }, out _, out _);
        Assert.Equal([2], noDate.Select(w => w.Id));

        // A Moonwatch has no moon phase, so that one term is read from the functions only.
        var noMoon = StatedConstraintFilter.Apply([largeDate, moonwatch], new QueryIntent { ExcludedComplications = ["moon"] }, out var applied, out _);
        Assert.False(applied);
        Assert.Equal(2, noMoon.Count);
    }

    [Fact]
    public void AStatedStrapIsReadAndEnforced()
    {
        // The last violation the held-out set still showed: "a bracelet, not a strap, I sweat
        // through leather" returned four leather straps out of ten.
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("a bracelet, not a strap, I sweat through leather", intent);
        Assert.Equal("bracelet", intent.StrapType);
        Assert.Contains("leather", intent.ExcludedStrapTypes);

        var candidates = new List<Watch>
        {
            Watch(1, 5000, "{\"strap\":{\"material\":\"Stainless steel bracelet\"}}"),
            Watch(2, 5000, "{\"strap\":{\"material\":\"Alligator leather\"}}"),
            Watch(3, 5000, "{\"strap\":{\"material\":\"Rubber\"}}"),
        };

        var kept = StatedConstraintFilter.Apply(candidates, intent, out var applied, out _);
        Assert.True(applied);
        Assert.Equal([1], kept.Select(w => w.Id));
    }

    [Fact]
    public void AComplaintAboutLeatherDoesNotReadAsARequestForIt()
    {
        // The trap in reading straps: the word the user is complaining about is the word they would
        // have used to ask for it, so the exclusion has to be cut from the string first.
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("I sweat through leather", intent);

        Assert.Null(intent.StrapType);
        Assert.Equal(["leather"], intent.ExcludedStrapTypes);
    }

    [Fact]
    public void AWatchMissingTheSpecIsNotEvidenceAgainstTheBrief()
    {
        // The catalogue does not record every field for every watch. Dropping those would punish the
        // data rather than the match.
        var candidates = new List<Watch> { Watch(1, 5000), Watch(2, 5000, Specs(diameter: "44 mm")) };

        var kept = StatedConstraintFilter.Apply(candidates, new QueryIntent { MaxDiameterMm = 40 }, out _, out _);

        Assert.Equal([1], kept.Select(w => w.Id));
    }

    [Fact]
    public void FilteringNeverEmptiesTheResult()
    {
        // A brief answered loosely beats a brief answered with nothing; the widening notice explains
        // the looseness to the reader.
        var candidates = new List<Watch> { Watch(1, 5000, Specs(dial: "blue")), Watch(2, 5000, Specs(dial: "black")) };

        var kept = StatedConstraintFilter.Apply(candidates, new QueryIntent { DialColour = "green" }, out var applied, out var emptied);

        // The caller is told the pool answered none of it, and a path that can decline does.
        Assert.False(applied);
        Assert.True(emptied);
        Assert.Equal(2, kept.Count);
    }

    [Theory]
    // Both phrasings come from briefs the benchmark scored as violations: the exclusion vocabulary
    // only read "no date", and "over 40mm" was read as a floor even when the sentence complained.
    [InlineData("I hate date windows", "date")]
    [InlineData("nothing with a chronograph", "chronograph")]
    [InlineData("I don't want a moon phase", "moon")]
    public void AComplaintStatesAnExclusion(string query, string expected)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);

        Assert.Contains(expected, intent.ExcludedComplications);
    }

    [Fact]
    public void OverFortyIsACeilingWhenTheSentenceComplains()
    {
        var complaint = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("anything over 40mm looks silly on me", complaint);
        Assert.Equal(40, complaint.MaxDiameterMm);
        Assert.Null(complaint.MinDiameterMm);

        // The same words as a wish still mean a floor.
        var wish = new QueryIntent();
        WatchFinderService.ApplyRegexFilters("I want something over 42mm", wish);
        Assert.Equal(42, wish.MinDiameterMm);
        Assert.Null(wish.MaxDiameterMm);
    }

    [Theory]
    // "nothing over 40mm" is a ceiling stated plainly, with no complaint attached for the
    // complaint reader to catch. It was being read as a floor, so the brief was answered with
    // exactly the sizes it ruled out.
    [InlineData("a blue dial, nothing over 40mm")]
    [InlineData("no more than 40mm please")]
    [InlineData("nothing bigger than 40mm")]
    public void APlainCeilingIsReadAsACeiling(string query)
    {
        var intent = new QueryIntent();
        WatchFinderService.ApplyRegexFilters(query, intent);

        Assert.Equal(40, intent.MaxDiameterMm);
        Assert.Null(intent.MinDiameterMm);
    }

    [Fact]
    public void AnIntentWithNoSpecConstraintIsLeftAlone()
    {
        var candidates = new List<Watch> { Watch(1, 5000), Watch(2, 9000) };

        var kept = StatedConstraintFilter.Apply(candidates, new QueryIntent { MaxPrice = 6000 }, out var applied, out _);

        Assert.False(applied);
        Assert.Equal(2, kept.Count);
        Assert.False(StatedConstraintFilter.HasSpecConstraints(new QueryIntent { MaxPrice = 6000 }));
    }
}
