// Seed catalogue for the concierge harness.
// Deliberately small but shaped like the real one: brands that exercise the alias table,
// collections with styles the finder can match, a price-on-request entry, and a spread
// wide enough for compare, discovery, and budget queries to return something sensible.
using System.Text.Json;
using backend.Database;
using backend.Models;

namespace backend.Tests.Harness;

internal static class ConciergeCatalogue
{
    public static void Seed(TourbillonContext context)
    {
        var brands = new[]
        {
            Brand(1, "Patek Philippe", "patek-philippe",
                "Geneva maison founded in 1839, widely held as the benchmark for finishing and complications."),
            Brand(2, "Audemars Piguet", "audemars-piguet",
                "Le Brassus manufacture founded in 1875, defined by the 1972 Royal Oak and integrated-bracelet design."),
            Brand(3, "Vacheron Constantin", "vacheron-constantin",
                "The oldest continuously operating watch manufacturer, founded in Geneva in 1755."),
            Brand(4, "A. Lange & Söhne", "a-lange-sohne",
                "Glashütte manufacture revived in 1990, known for German silver plates and hand-engraved balance cocks."),
            Brand(5, "Jaeger-LeCoultre", "jaeger-lecoultre",
                "Vallée de Joux manufacture founded in 1833, supplier of movements across the industry."),
        };

        var collections = new[]
        {
            Collection(1, 1, "Nautilus", "nautilus", ["sport", "luxury sport"],
                "Gerald Genta's 1976 porthole-cased steel sports watch with a horizontally embossed dial."),
            Collection(2, 1, "Calatrava", "calatrava", ["dress", "formal"],
                "The reference round dress watch, in production since 1932."),
            Collection(3, 2, "Royal Oak", "royal-oak", ["sport", "luxury sport"],
                "The 1972 octagonal integrated-bracelet design that created the luxury steel sports category."),
            Collection(4, 3, "Overseas", "overseas", ["sport", "travel"],
                "Vacheron's interchangeable-strap travel sports line with an in-house automatic."),
            Collection(5, 3, "Patrimony", "patrimony", ["dress", "formal"],
                "Minimalist round dress line built around 1950s Vacheron proportions."),
            Collection(6, 4, "Lange 1", "lange-1", ["dress", "formal"],
                "Asymmetric dial with the outsize date, the model that relaunched the brand in 1994."),
            Collection(7, 5, "Reverso", "reverso", ["dress", "art deco"],
                "The 1931 reversible rectangular case originally made for polo players."),
            Collection(8, 5, "Polaris", "polaris", ["sport", "dive"],
                "Dive-derived sports line descended from the 1968 Memovox Polaris."),
        };

        var watches = new[]
        {
            Watch(101, 1, 1, "5711/1A-010", "patek-philippe-nautilus-5711-1a-010", 145_000m,
                "Patek Philippe Nautilus", 40, "steel", "automatic"),
            Watch(102, 1, 1, "5811/1G-001", "patek-philippe-nautilus-5811-1g-001", 0m,
                "Patek Philippe Nautilus", 41, "white gold", "automatic"),
            Watch(103, 1, 2, "6119G-001", "patek-philippe-calatrava-6119g-001", 38_500m,
                "Patek Philippe Calatrava", 39, "white gold", "manual"),
            Watch(201, 2, 3, "15500ST.OO.1220ST.01", "audemars-piguet-royal-oak-15500st", 42_000m,
                "Audemars Piguet Royal Oak", 41, "steel", "automatic"),
            Watch(202, 2, 3, "15202ST.OO.1240ST.01", "audemars-piguet-royal-oak-15202st", 98_000m,
                "Audemars Piguet Royal Oak Jumbo", 39, "steel", "automatic"),
            Watch(301, 3, 4, "4500V/110A-B128", "vacheron-constantin-overseas-4500v", 34_500m,
                "Vacheron Constantin Overseas", 41, "steel", "automatic"),
            Watch(302, 3, 5, "81180/000R-9159", "vacheron-constantin-patrimony-81180", 28_900m,
                "Vacheron Constantin Patrimony", 40, "rose gold", "manual"),
            Watch(401, 4, 6, "191.032", "a-lange-sohne-lange-1-191-032", 52_000m,
                "A. Lange & Söhne Lange 1", 39, "white gold", "manual"),
            Watch(402, 4, 6, "722.025", "a-lange-sohne-lange-1-722-025", 44_800m,
                "A. Lange & Söhne Little Lange 1", 36, "rose gold", "manual"),
            Watch(501, 5, 7, "Q3978480", "jaeger-lecoultre-reverso-q3978480", 12_400m,
                "Jaeger-LeCoultre Reverso Classic", 45, "steel", "manual"),
            Watch(502, 5, 7, "Q713252J", "jaeger-lecoultre-reverso-tribute-q713252j", 29_600m,
                "Jaeger-LeCoultre Reverso Tribute Duoface", 47, "rose gold", "manual"),
            Watch(503, 5, 8, "Q9068180", "jaeger-lecoultre-polaris-q9068180", 9_800m,
                "Jaeger-LeCoultre Polaris Date", 42, "steel", "automatic"),
        };

        context.Brands.AddRange(brands);
        context.Collections.AddRange(collections);
        context.Watches.AddRange(watches);
        context.SaveChanges();
    }

    private static Brand Brand(int id, string name, string slug, string description) =>
        new() { Id = id, Name = name, Slug = slug, Description = description, Image = $"brands/{slug}.png" };

    private static Collection Collection(int id, int brandId, string name, string slug, string[] styles, string description) =>
        new() { Id = id, BrandId = brandId, Name = name, Slug = slug, Styles = styles, Description = description, Image = $"collections/{slug}.png" };

    private static Watch Watch(
        int id, int brandId, int collectionId, string reference, string slug,
        decimal price, string description, int diameter, string material, string movement) =>
        new()
        {
            Id = id,
            BrandId = brandId,
            CollectionId = collectionId,
            Name = reference,
            Slug = slug,
            CurrentPrice = price,
            Description = description,
            Image = $"watches/{slug}.png",
            Specs = JsonSerializer.Serialize(new
            {
                dial = new { colour = "silvered" },
                @case = new { diameter = $"{diameter}mm", material },
                movement = new { type = movement },
                strap = new { material },
            }),
        };
}
