// Tests for the in-memory BM25F index. The index decides the ranking the bm25 and hybrid modes
// return, so each property of the formula is pinned separately: IDF, saturation, length
// normalisation, field weighting, and the tokenizer that has to agree on both sides.
using backend.Models;
using backend.Services;

namespace backend.Tests.Services;

public class Bm25WatchIndexTests
{
    private static Bm25Document Doc(int id, string name = "", string brand = "", string collection = "",
        string description = "", string specs = "") =>
        new(id, new Dictionary<Bm25Field, string>
        {
            [Bm25Field.Name] = name,
            [Bm25Field.Brand] = brand,
            [Bm25Field.Collection] = collection,
            [Bm25Field.Description] = description,
            [Bm25Field.Specs] = specs,
        });

    [Fact]
    public void Tokenize_lowercases_strips_diacritics_and_splits_references()
    {
        Assert.Equal(
            new[] { "lange", "sohne", "5711", "1a", "010" },
            Bm25WatchIndex.Tokenize("A. Lange & Söhne 5711/1A-010"));
    }

    [Fact]
    public void Tokenize_keeps_single_digits_and_drops_single_letters()
    {
        // "Lange 1" is a collection name, so a lone digit is content; a lone letter is not.
        Assert.Equal(new[] { "lange", "1" }, Bm25WatchIndex.Tokenize("Lange 1 x"));
    }

    [Fact]
    public void Tokenize_removes_stop_words_and_folds_plurals()
    {
        Assert.Equal(
            new[] { "chronograph", "watch", "dial" },
            Bm25WatchIndex.Tokenize("Show me the chronographs, watches with dials"));
    }

    [Theory]
    [InlineData("nautilus", "nautilus")]
    [InlineData("stainless", "stainless")]
    [InlineData("watches", "watch")]
    [InlineData("sports", "sport")]
    [InlineData("5711s", "5711s")]
    public void Stem_folds_plurals_but_leaves_words_that_only_look_plural(string token, string expected)
    {
        Assert.Equal(expected, Bm25WatchIndex.Stem(token));
    }

    [Fact]
    public void A_rare_term_outweighs_a_common_one()
    {
        // "steel" is in every document and "tourbillon" in one, so the repeated common term in
        // document 2 must not beat the single rare term in document 1.
        var index = new Bm25WatchIndex([
            Doc(1, description: "tourbillon steel"),
            Doc(2, description: "steel steel"),
            Doc(3, description: "steel case"),
            Doc(4, description: "steel bracelet"),
        ]);

        Assert.Equal(1, index.Search("steel tourbillon", 10)[0].Id);
    }

    [Fact]
    public void Repeating_a_term_saturates_instead_of_scaling()
    {
        var index = new Bm25WatchIndex([
            Doc(1, description: "gold"),
            Doc(2, description: string.Join(' ', Enumerable.Repeat("gold", 10))),
            Doc(3, description: "steel"),
        ]);

        var hits = index.Search("gold", 10);
        var once = hits.Single(h => h.Id == 1).Score;
        var tenTimes = hits.Single(h => h.Id == 2).Score;

        Assert.True(tenTimes > once);
        Assert.True(tenTimes < once * 2.5, $"ten repetitions scored {tenTimes / once:F2}x one occurrence");
    }

    [Fact]
    public void A_shorter_field_ranks_above_a_longer_one_with_the_same_match()
    {
        var index = new Bm25WatchIndex([
            Doc(1, description: "blue dial"),
            Doc(2, description: "blue dial with applied indices and a long passage about hand finishing"),
            Doc(3, description: "white dial"),
        ]);

        Assert.Equal(1, index.Search("blue", 10)[0].Id);
    }

    [Fact]
    public void A_brand_match_outranks_the_same_word_in_prose()
    {
        var index = new Bm25WatchIndex([
            Doc(1, brand: "Omega"),
            Doc(2, description: "omega"),
            Doc(3, description: "other"),
        ]);

        Assert.Equal(new[] { 1, 2 }, index.Search("omega", 10).Select(h => h.Id));
    }

    [Fact]
    public void Brand_aliases_are_indexed_so_an_abbreviation_finds_the_brand()
    {
        var jlc = new Watch { Id = 7, Name = "Q3858420", Brand = new Brand { Name = "Jaeger-LeCoultre" } };
        var index = new Bm25WatchIndex([Bm25WatchDocuments.FromWatch(jlc), Doc(8, brand: "Omega")]);

        Assert.Equal(new[] { 7 }, index.Search("JLC watches", 10).Select(h => h.Id));
    }

    [Fact]
    public void The_go_alias_does_not_match_ordinary_speech()
    {
        // GO is an alias for Glashütte Original and also an everyday verb.
        var glashutte = new Watch { Id = 3, Name = "1-39-59-01", Brand = new Brand { Name = "Glashütte Original" } };
        var index = new Bm25WatchIndex([Bm25WatchDocuments.FromWatch(glashutte), Doc(4, brand: "Omega")]);

        Assert.Empty(index.Search("something to go with a suit", 10));
    }

    [Fact]
    public void Collection_styles_are_searchable()
    {
        var polaris = new Watch
        {
            Id = 9,
            Name = "Q9068681",
            Brand = new Brand { Name = "Jaeger-LeCoultre" },
            Collection = new Collection { Name = "Polaris", Styles = ["sport", "diver"] },
        };
        var index = new Bm25WatchIndex([Bm25WatchDocuments.FromWatch(polaris), Doc(10, collection: "Reverso dress")]);

        Assert.Equal(new[] { 9 }, index.Search("a diver", 10).Select(h => h.Id));
    }

    [Fact]
    public void Spec_values_are_indexed_but_keys_are_not()
    {
        var text = Bm25WatchDocuments.FlattenSpecs(
            """{"case":{"material":"Titanium","diameter":"42 mm"},"movement":{"functions":["Chronograph"],"powerReserve":70}}""");

        Assert.Contains("Titanium", text);
        Assert.Contains("42 mm", text);
        Assert.Contains("Chronograph", text);
        Assert.Contains("70", text);
        Assert.DoesNotContain("material", text);
    }

    [Fact]
    public void Unparseable_specs_are_kept_as_text()
    {
        Assert.Equal("not json at all", Bm25WatchDocuments.FlattenSpecs("not json at all"));
        Assert.Equal("", Bm25WatchDocuments.FlattenSpecs(null));
    }

    [Fact]
    public void Unknown_terms_and_empty_queries_return_nothing()
    {
        var index = new Bm25WatchIndex([Doc(1, description: "gold")]);

        Assert.Empty(index.Search("platinum", 10));
        Assert.Empty(index.Search("", 10));
        Assert.Empty(index.Search("the and of", 10));
    }

    [Fact]
    public void Equal_scores_break_ties_by_id()
    {
        var index = new Bm25WatchIndex([Doc(5, description: "gold"), Doc(2, description: "gold")]);

        Assert.Equal(new[] { 2, 5 }, index.Search("gold", 10).Select(h => h.Id));
    }

    [Fact]
    public void The_limit_caps_the_result_count()
    {
        var index = new Bm25WatchIndex(Enumerable.Range(1, 20).Select(i => Doc(i, description: "gold")));

        Assert.Equal(5, index.Search("gold", 5).Count);
        Assert.Empty(index.Search("gold", 0));
    }
}
