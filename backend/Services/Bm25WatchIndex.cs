// BM25F lexical ranking over the watch catalogue, held entirely in memory.
// A few hundred documents fit an inverted index in process, so a query ranks in microseconds with
// no search engine or database extension. Pure and deterministic, which is what makes it testable.
using System.Text.Json;
using backend.Models;

namespace backend.Services;

public enum Bm25Field { Name, Brand, Collection, Description, Specs }

public sealed record Bm25Document(int Id, IReadOnlyDictionary<Bm25Field, string> Fields);

public sealed record Bm25Hit(int Id, double Score);

/// Inverted index scored with BM25F: per-field term frequencies are weighted and length-normalised,
/// summed, and only then saturated, so a term that appears in several fields still saturates once.
public sealed class Bm25WatchIndex
{
    /// How quickly repeated occurrences stop adding score. 1.2 is the conventional default.
    public const double K1 = 1.2;

    // Weight is what a match in the field is worth; B is how strongly a long field is discounted
    // against that field's average length. Set from what each field is, not tuned on the eval set:
    // a brand or collection names the product line outright, a reference is nearly as specific,
    // and prose fields carry many incidental words. Brand text barely varies in length, so no b.
    internal static readonly IReadOnlyDictionary<Bm25Field, (double Weight, double B)> FieldParameters =
        new Dictionary<Bm25Field, (double Weight, double B)>
        {
            [Bm25Field.Name] = (2.0, 0.3),
            [Bm25Field.Brand] = (3.0, 0.0),
            [Bm25Field.Collection] = (3.0, 0.3),
            [Bm25Field.Description] = (1.0, 0.75),
            [Bm25Field.Specs] = (1.0, 0.75),
        };

    // Function words and request filler, removed on both sides so they neither match nor dilute.
    // "go" is here because it is also the alias for Glashütte Original and would otherwise pull
    // that brand into every "something to go with a suit".
    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "a", "an", "the", "and", "or", "but", "of", "for", "with", "without", "to", "in", "on", "at",
        "by", "from", "as", "is", "are", "was", "be", "it", "its", "this", "that", "these", "those",
        "im", "me", "my", "you", "your", "we", "our", "he", "his", "she", "her", "they", "their",
        "can", "could", "would", "should", "will", "just", "some", "something", "anything", "any",
        "want", "looking", "look", "show", "please", "what", "which", "who", "have", "has", "do",
        "does", "get", "go", "very", "really", "also", "than", "so", "not", "no", "nothing",
        "under", "over", "about", "around", "most", "more", "one", "all", "only",
    };

    private readonly Dictionary<string, List<(int DocId, Bm25Field Field, int Frequency)>> _postings = new();
    private readonly Dictionary<(int DocId, Bm25Field Field), int> _fieldLengths = new();
    private readonly Dictionary<Bm25Field, double> _averageLengths = new();
    private readonly Dictionary<string, int> _documentFrequency = new();

    public int DocumentCount { get; }

    public Bm25WatchIndex(IEnumerable<Bm25Document> documents)
    {
        var lengthTotals = new Dictionary<Bm25Field, long>();
        var count = 0;
        foreach (var document in documents)
        {
            count++;
            var termsInDocument = new HashSet<string>(StringComparer.Ordinal);
            foreach (var field in FieldParameters.Keys)
            {
                var tokens = document.Fields.TryGetValue(field, out var text) ? Tokenize(text) : [];
                _fieldLengths[(document.Id, field)] = tokens.Count;
                lengthTotals[field] = lengthTotals.GetValueOrDefault(field) + tokens.Count;

                foreach (var group in tokens.GroupBy(token => token, StringComparer.Ordinal))
                {
                    if (!_postings.TryGetValue(group.Key, out var postings))
                        _postings[group.Key] = postings = [];
                    postings.Add((document.Id, field, group.Count()));
                    termsInDocument.Add(group.Key);
                }
            }

            foreach (var term in termsInDocument)
                _documentFrequency[term] = _documentFrequency.GetValueOrDefault(term) + 1;
        }

        DocumentCount = count;
        foreach (var field in FieldParameters.Keys)
            _averageLengths[field] = count == 0 ? 0 : (double)lengthTotals.GetValueOrDefault(field) / count;
    }

    /// Ranked documents for a query, best first. Query terms are counted once each: repeating a
    /// word in the query is not a request to weight it more.
    public IReadOnlyList<Bm25Hit> Search(string query, int limit)
    {
        if (limit <= 0 || DocumentCount == 0)
            return [];

        var scores = new Dictionary<int, double>();
        foreach (var term in Tokenize(query).Distinct(StringComparer.Ordinal))
        {
            if (!_postings.TryGetValue(term, out var postings))
                continue;

            // Field frequencies are combined per document before saturating, which is what makes
            // this BM25F rather than a sum of per-field BM25 scores.
            var combined = new Dictionary<int, double>();
            foreach (var (docId, field, frequency) in postings)
            {
                var (weight, b) = FieldParameters[field];
                var average = _averageLengths[field];
                var normaliser = average > 0 ? (1 - b) + b * _fieldLengths[(docId, field)] / average : 1;
                combined[docId] = combined.GetValueOrDefault(docId) + weight * frequency / normaliser;
            }

            var idf = InverseDocumentFrequency(term);
            foreach (var (docId, frequency) in combined)
                scores[docId] = scores.GetValueOrDefault(docId) + idf * frequency * (K1 + 1) / (K1 + frequency);
        }

        // Ties break on id so the same query always returns the same order.
        return scores
            .OrderByDescending(score => score.Value)
            .ThenBy(score => score.Key)
            .Take(limit)
            .Select(score => new Bm25Hit(score.Key, score.Value))
            .ToList();
    }

    /// Rarity of a term across the catalogue. The +1 inside the log keeps a term that appears in
    /// every document at a small positive weight instead of a negative one.
    public double InverseDocumentFrequency(string term)
    {
        var df = _documentFrequency.GetValueOrDefault(term);
        return Math.Log(1 + (DocumentCount - df + 0.5) / (df + 0.5));
    }

    /// Lowercased, diacritic-free terms with stop words removed and plurals folded. The same
    /// function runs at index and query time, so the two sides always agree on what a term is.
    public static IReadOnlyList<string> Tokenize(string? text)
    {
        var normalised = QueryNormalizer.NormalizeText(text);
        if (normalised.Length == 0)
            return [];

        var tokens = new List<string>();
        foreach (var raw in normalised.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (StopWords.Contains(raw))
                continue;
            // A lone letter carries nothing, but a lone digit can: "Lange 1" is a collection.
            if (raw.Length == 1 && !char.IsDigit(raw[0]))
                continue;
            tokens.Add(Stem(raw));
        }
        return tokens;
    }

    /// Plural folding only. A full stemmer would also fold "winding" into "wound", but a wrong fold
    /// on a brand or collection name costs more than the recall it would add.
    internal static string Stem(string token)
    {
        if (token.Length <= 3 || token.Any(char.IsDigit))
            return token;
        if (token.EndsWith("ches") || token.EndsWith("shes") || token.EndsWith("xes") || token.EndsWith("sses"))
            return token[..^2];
        if (token.EndsWith("ies") && token.Length > 4)
            return token[..^3] + "y";
        if (token.EndsWith('s') && !token.EndsWith("ss") && !token.EndsWith("us") && !token.EndsWith("is"))
            return token[..^1];
        return token;
    }
}

/// Turns a catalogue watch into the fields the index ranks on.
public static class Bm25WatchDocuments
{
    public static Bm25Document FromWatch(Watch watch)
    {
        var brandName = watch.Brand?.Name ?? "";
        var brandKey = QueryNormalizer.CompactText(brandName);
        // Aliases are added at index time, the way a search engine applies a synonym list, so "JLC"
        // reaches Jaeger-LeCoultre without the query side needing to know the table exists.
        var aliases = brandKey.Length == 0
            ? Enumerable.Empty<string>()
            : QueryNormalizer.BrandAliases
                .Where(alias => QueryNormalizer.CompactText(alias.Value) == brandKey)
                .Select(alias => alias.Key);
        var collection = watch.Collection;

        return new Bm25Document(watch.Id, new Dictionary<Bm25Field, string>
        {
            [Bm25Field.Name] = watch.Name,
            [Bm25Field.Brand] = string.Join(' ', aliases.Prepend(brandName)),
            // Styles ride with the collection name so "sports" reaches a brand's sports lines.
            [Bm25Field.Collection] = collection == null
                ? ""
                : string.Join(' ', collection.Styles.Prepend(collection.Name)),
            [Bm25Field.Description] = watch.Description ?? "",
            [Bm25Field.Specs] = FlattenSpecs(watch.Specs),
        });
    }

    /// Every value in the specs JSON as plain text. Keys are structure, not content, so indexing
    /// them would make "material" match every watch.
    internal static string FlattenSpecs(string? specs)
    {
        if (string.IsNullOrWhiteSpace(specs))
            return "";
        try
        {
            using var document = JsonDocument.Parse(specs);
            var parts = new List<string>();
            CollectValues(document.RootElement, parts);
            return string.Join(' ', parts);
        }
        catch (JsonException)
        {
            // Unparseable specs are still text a buyer might search for.
            return specs;
        }
    }

    private static void CollectValues(JsonElement element, List<string> parts)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                    CollectValues(property.Value, parts);
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    CollectValues(item, parts);
                break;
            case JsonValueKind.String:
                parts.Add(element.GetString() ?? "");
                break;
            case JsonValueKind.Number:
                parts.Add(element.GetRawText());
                break;
        }
    }
}
