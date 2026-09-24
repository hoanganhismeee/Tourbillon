// The wording layer names watches in plain words and the backend adds the links, so the model stops
// spending a third of its token budget writing URLs. These hold the rules that makes that safe:
// first mention only, never inside an existing link, never a name the catalogue did not resolve.
using backend.Services;

namespace backend.Tests.Services;

public class CatalogueLinkingTests
{
    private static List<ChatWatchCard> Cards() =>
    [
        new()
        {
            Id = 1,
            Name = "210.30.42.20.01.001 Diver 300M",
            Slug = "omega-seamaster-210-30-42-20-01-001-diver-300m",
            BrandName = "Omega",
            BrandSlug = "omega",
            CollectionName = "Seamaster",
            CollectionSlug = "omega-seamaster",
            Description = "Omega Seamaster",
        },
        new()
        {
            Id = 2,
            Name = "SBGE255 Spring Drive GMT",
            Slug = "grand-seiko-sport-collection-sbge255-spring-drive-gmt",
            BrandName = "Grand Seiko",
            BrandSlug = "grand-seiko",
            CollectionName = "Sport Collection",
            CollectionSlug = "grand-seiko-sport-collection",
            Description = "Grand Seiko Sport Collection",
        },
    ];

    [Fact]
    public void AWatchNamedInProseBecomesALink()
    {
        var linked = ChatService.LinkCatalogueNames(
            "The Omega Seamaster 210.30.42.20.01.001 Diver 300M is the closest fit.", Cards(), []);

        Assert.Contains("[Omega Seamaster 210.30.42.20.01.001 Diver 300M](/watches/omega-seamaster-210-30-42-20-01-001-diver-300m)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void AWatchNamedWithoutItsReferenceStillLinks()
    {
        // How a person says it, and how the model writes it once it no longer pastes the reference.
        var linked = ChatService.LinkCatalogueNames("The Omega Seamaster Diver 300M suits a suit.", Cards(), []);

        Assert.Contains("[Omega Seamaster Diver 300M](/watches/omega-seamaster-210-30-42-20-01-001-diver-300m)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void OnlyTheFirstMentionIsLinked()
    {
        var linked = ChatService.LinkCatalogueNames(
            "The SBGE255 Spring Drive GMT travels well. The SBGE255 Spring Drive GMT is also steel.", Cards(), []);

        Assert.Equal(1, linked.Split("/watches/grand-seiko-sport-collection-sbge255-spring-drive-gmt").Length - 1);
    }

    [Fact]
    public void ALinkTheModelWroteItselfIsLeftAlone()
    {
        const string draft = "The [Omega Seamaster Diver 300M](/watches/omega-seamaster-210-30-42-20-01-001-diver-300m) is steel.";

        Assert.Equal(draft, ChatService.LinkCatalogueNames(draft, Cards(), []));
    }

    [Fact]
    public void NamesInsideAnExistingLinkAreNotLinkedAgain()
    {
        // The brand sits inside a watch link; linking it there would nest one link inside another.
        var linked = ChatService.LinkCatalogueNames(
            "The [Omega Seamaster Diver 300M](/watches/omega-seamaster-210-30-42-20-01-001-diver-300m) from the maison.",
            Cards(), []);

        Assert.DoesNotContain("[Omega](/brands/omega)](", linked, StringComparison.Ordinal);
        Assert.DoesNotContain("[[", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void AWatchWrittenInBoldIsOneLinkNotThree()
    {
        // The model bolds part of the name; matching word by word would link the brand, the collection
        // and the reference separately and leave three chips in a row.
        var linked = ChatService.LinkCatalogueNames(
            "The **Omega Seamaster** 210.30.42.20.01.001 Diver 300M at $10,525 is the pick.", Cards(), []);

        Assert.Contains("[Omega Seamaster 210.30.42.20.01.001 Diver 300M](/watches/omega-seamaster-210-30-42-20-01-001-diver-300m)", linked, StringComparison.Ordinal);
        Assert.DoesNotContain("(/brands/omega)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void AWatchTheCatalogueDidNotResolveStaysPlain()
    {
        var linked = ChatService.LinkCatalogueNames("The Rolex Submariner is the obvious one.", Cards(), []);

        Assert.Equal("The Rolex Submariner is the obvious one.", linked);
    }

    [Fact]
    public void BrandAndCollectionNamedOnTheirOwnAreLinked()
    {
        var linked = ChatService.LinkCatalogueNames("Omega built the Seamaster for divers.", Cards(), []);

        Assert.Contains("[Omega](/brands/omega)", linked, StringComparison.Ordinal);
        Assert.Contains("[Seamaster](/collections/omega-seamaster)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void AWatchFromContextRatherThanACardIsLinked()
    {
        // Entity replies supply watches as context lines without surfacing them as cards.
        List<string> context = ["Watch \"Patek Philippe Calatrava 6119G-001\" (Slug: patek-philippe-calatrava-6119g-001) Price 35000"];

        var linked = ChatService.LinkCatalogueNames(
            "The Patek Philippe Calatrava 6119G-001 is the purest of them.", [], context);

        Assert.Contains("[Patek Philippe Calatrava 6119G-001](/watches/patek-philippe-calatrava-6119g-001)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void ASlugInsideAUrlIsNeverMatched()
    {
        const string draft = "See /watches/omega-seamaster-210-30-42-20-01-001-diver-300m for the detail.";

        Assert.Equal(draft, ChatService.LinkCatalogueNames(draft, Cards(), []));
    }

    [Fact]
    public void ABrandBesideItsOwnCollectionBecomesOneLink()
    {
        // Two chips in a row for one thing: the reply read "Rolex Datejust" as a brand and a
        // collection side by side, and a reader clicking either half wants the same page.
        const string draft = "The [Rolex](/brands/rolex) [Datejust](/collections/rolex-datejust) 36 suits the evening.";

        var merged = ChatService.MergeBrandIntoCollectionLink(draft);

        Assert.Contains("[Rolex Datejust](/collections/rolex-datejust) 36", merged, StringComparison.Ordinal);
    }

    [Fact]
    public void ACollectionFromAnotherBrandIsLeftAlone()
    {
        const string draft = "[Rolex](/brands/rolex) and the [Seamaster](/collections/omega-seamaster) are different worlds.";

        Assert.Equal(draft, ChatService.MergeBrandIntoCollectionLink(draft));
    }

    [Fact]
    public void AWatchNamedByItsReferenceAloneStillLinks()
    {
        // The catalogue name carries a model word after the reference; the reply names the
        // reference only, and used to be left with a brand chip and a collection chip instead.
        var linked = ChatService.LinkCatalogueNames(
            "The Grand Seiko Sport Collection SBGE255 is the other side of that choice.", Cards(), []);

        Assert.Contains("(/watches/grand-seiko-sport-collection-sbge255-spring-drive-gmt)", linked, StringComparison.Ordinal);
    }

    [Fact]
    public void AtMostThreeWatchLinksAreAdded()
    {
        var cards = Cards();
        cards.Add(new ChatWatchCard { Id = 3, Name = "5711/1A-010", Slug = "patek-philippe-nautilus-5711-1a-010", BrandName = "Patek Philippe", BrandSlug = "patek-philippe", CollectionName = "Nautilus", CollectionSlug = "patek-philippe-nautilus", Description = "Patek Philippe Nautilus" });
        cards.Add(new ChatWatchCard { Id = 4, Name = "15500ST.OO.1220ST.01", Slug = "audemars-piguet-royal-oak-15500st", BrandName = "Audemars Piguet", BrandSlug = "audemars-piguet", CollectionName = "Royal Oak", CollectionSlug = "audemars-piguet-royal-oak", Description = "Audemars Piguet Royal Oak" });

        var linked = ChatService.LinkCatalogueNames(
            "Consider the 210.30.42.20.01.001 Diver 300M, the SBGE255 Spring Drive GMT, the 5711/1A-010 and the 15500ST.OO.1220ST.01.",
            cards, []);

        Assert.Equal(3, linked.Split("(/watches/").Length - 1);
    }
}
