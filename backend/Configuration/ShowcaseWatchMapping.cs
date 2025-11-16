// Showcase watch mapping configuration
// Maps watch name patterns to curated image filenames for the 9 Holy Trinity showcase watches

namespace backend.Configuration;

public class ShowcaseWatchMapping
{
    // Mapping of showcase watch patterns to their curated image filenames
    private readonly List<ShowcaseWatchPattern> _patterns = new()
    {
        // Patek Philippe (3 watches)
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Patek Philippe", "Calatrava", "Automatic Date" },
            CuratedImage = "PP5227G.png",
            Brand = "Patek Philippe",
            Collection = "Calatrava"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Patek Philippe", "Nautilus", "5811", "Blue" },
            CuratedImage = "PP58111G.png",
            Brand = "Patek Philippe",
            Collection = "Nautilus"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Patek Philippe", "Minute Repeater", "Tourbillon" },
            CuratedImage = "PP5303R.png",
            Brand = "Patek Philippe",
            Collection = "Grand Complications"
        },

        // Vacheron Constantin (3 watches)
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Vacheron Constantin", "Patrimony", "Perpetual Calendar" },
            CuratedImage = "VC43175.webp",
            Brand = "Vacheron Constantin",
            Collection = "Patrimony"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Vacheron Constantin", "Overseas", "Tourbillon" },
            CuratedImage = "VC6000V.webp",
            Brand = "Vacheron Constantin",
            Collection = "Overseas"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Vacheron Constantin", "Métiers d'Art", "Scorpio" },
            AlternativeKeywords = new[] { "Vacheron Constantin", "Metiers d'Art", "Scorpio" },
            CuratedImage = "VC6007A.jpg",
            Brand = "Vacheron Constantin",
            Collection = "Métiers d'Art"
        },

        // Audemars Piguet (3 watches)
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Audemars Piguet", "Royal Oak", "Jumbo", "16202" },
            AlternativeKeywords = new[] { "Audemars Piguet", "Royal Oak", "Extra-Thin", "16202" },
            CuratedImage = "AP16202ST.webp",
            Brand = "Audemars Piguet",
            Collection = "Royal Oak"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Audemars Piguet", "Royal Oak", "Perpetual Calendar" },
            CuratedImage = "APRO26574.png",
            Brand = "Audemars Piguet",
            Collection = "Royal Oak"
        },
        new ShowcaseWatchPattern
        {
            Keywords = new[] { "Audemars Piguet", "Royal Oak Concept", "Flying Tourbillon", "GMT" },
            AlternativeKeywords = new[] { "Audemars Piguet", "Royal Oak Concept", "Tourbillon" },
            CuratedImage = "APROCONCEPTGMT.png",
            Brand = "Audemars Piguet",
            Collection = "Royal Oak Concept"
        }
    };

    /// <summary>
    /// Checks if a watch name matches any showcase watch pattern
    /// </summary>
    public bool IsShowcaseWatch(string watchName, out string curatedImage)
    {
        curatedImage = string.Empty;

        if (string.IsNullOrEmpty(watchName))
            return false;

        // Normalize watch name for comparison
        var normalizedName = watchName.ToLower().Replace("é", "e");

        foreach (var pattern in _patterns)
        {
            // Check primary keywords
            if (MatchesAllKeywords(normalizedName, pattern.Keywords))
            {
                curatedImage = pattern.CuratedImage;
                return true;
            }

            // Check alternative keywords if available
            if (pattern.AlternativeKeywords != null && 
                MatchesAllKeywords(normalizedName, pattern.AlternativeKeywords))
            {
                curatedImage = pattern.CuratedImage;
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Checks if the watch name contains all required keywords
    /// </summary>
    private bool MatchesAllKeywords(string watchName, string[] keywords)
    {
        foreach (var keyword in keywords)
        {
            var normalizedKeyword = keyword.ToLower().Replace("é", "e");
            if (!watchName.Contains(normalizedKeyword))
            {
                return false;
            }
        }
        return true;
    }

    /// <summary>
    /// Gets all showcase watch patterns for reference
    /// </summary>
    public IReadOnlyList<ShowcaseWatchPattern> GetAllPatterns() => _patterns.AsReadOnly();
}

public class ShowcaseWatchPattern
{
    public string[] Keywords { get; set; } = Array.Empty<string>();
    public string[]? AlternativeKeywords { get; set; }
    public string CuratedImage { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Collection { get; set; } = string.Empty;
}

