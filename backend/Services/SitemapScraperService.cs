// Universal sitemap-driven scraper service for luxury watch brands
// Uses Selenium to bypass bot protection + Claude Haiku API to extract structured data
// No per-brand XPath configuration needed - just a sitemap URL and brand name

using backend.DTOs;
using HtmlAgilityPack;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace backend.Services;

public class SitemapScraperService
{
    private readonly ILogger<SitemapScraperService> _logger;
    private readonly ICloudinaryService _cloudinaryService;
    private readonly IClaudeApiService _claudeApiService;

    public SitemapScraperService(
        ILogger<SitemapScraperService> logger,
        ICloudinaryService cloudinaryService,
        IClaudeApiService claudeApiService)
    {
        _logger = logger;
        _cloudinaryService = cloudinaryService;
        _claudeApiService = claudeApiService;
    }

    /// Scrapes a single watch product page by URL
    /// The core "paste a URL, get everything" feature
    public async Task<ScrapedWatchDto?> ScrapeFromUrlAsync(
        string url, string brandName, CancellationToken ct = default)
    {
        IWebDriver? driver = null;
        try
        {
            driver = CreateDriver();
            return await ScrapeWatchPageAsync(driver, url, brandName, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping URL: {Url}", url);
            return null;
        }
        finally
        {
            driver?.Quit();
            driver?.Dispose();
        }
    }

    /// Scrapes watches from a brand using sitemap-driven discovery
    /// Fetches sitemap via Selenium, extracts URLs, then scrapes each page with Claude API
    public async Task<List<ScrapedWatchDto>> ScrapeFromSitemapAsync(
        string brandName,
        string sitemapUrl,
        string? filterCollection = null,
        int maxWatches = 50,
        int delayMs = 2000,
        CancellationToken ct = default)
    {
        _logger.LogInformation("Starting sitemap scrape for {Brand} from {Url} (collection: {Collection}, max: {Max})",
            brandName, sitemapUrl, filterCollection ?? "ALL", maxWatches);

        IWebDriver? driver = null;
        var watches = new List<ScrapedWatchDto>();

        try
        {
            driver = CreateDriver();

            // Step 1: Fetch and parse sitemap via Selenium
            var watchUrls = FetchWatchUrlsFromSitemap(driver, sitemapUrl);
            if (watchUrls.Count == 0)
            {
                _logger.LogWarning("No watch URLs found in sitemap for {Brand}", brandName);
                return watches;
            }

            _logger.LogInformation("Found {Count} watch URLs for {Brand}", watchUrls.Count, brandName);

            // Step 2: Pre-filter URLs by collection slug if filter is specified
            // This avoids wasting Claude API calls on watches from other collections
            var urlsToScrape = watchUrls;
            if (!string.IsNullOrEmpty(filterCollection))
            {
                urlsToScrape = PreFilterUrlsByCollection(watchUrls, filterCollection);
                _logger.LogInformation("Pre-filtered to {Count} URLs for collection {Collection}",
                    urlsToScrape.Count, filterCollection);
            }

            // Step 3: Scrape each watch page
            var count = 0;
            foreach (var url in urlsToScrape)
            {
                if (count >= maxWatches) break;
                ct.ThrowIfCancellationRequested();

                try
                {
                    var watch = await ScrapeWatchPageAsync(driver, url, brandName, ct);
                    if (watch != null)
                    {
                        // Post-filter by collection name (safety check)
                        if (!string.IsNullOrEmpty(filterCollection) &&
                            !watch.CollectionName.Equals(filterCollection, StringComparison.OrdinalIgnoreCase))
                        {
                            _logger.LogDebug("Skipping {Ref} - collection {Collection} doesn't match filter {Filter}",
                                watch.ReferenceNumber, watch.CollectionName, filterCollection);
                            continue;
                        }

                        watches.Add(watch);
                        count++;
                        _logger.LogInformation("Scraped {Count}/{Max}: {Ref} ({Collection})",
                            count, maxWatches, watch.ReferenceNumber ?? watch.Name, watch.CollectionName);
                    }

                    await Task.Delay(delayMs, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error scraping {Url}", url);
                }
            }

            _logger.LogInformation("Completed sitemap scrape for {Brand}: {Count} watches", brandName, watches.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in sitemap scrape for {Brand}", brandName);
        }
        finally
        {
            driver?.Quit();
            driver?.Dispose();
        }

        return watches;
    }

    /// Fetches sitemap XML via Selenium and extracts watch product URLs
    private List<string> FetchWatchUrlsFromSitemap(IWebDriver driver, string sitemapUrl)
    {
        var urls = new List<string>();

        try
        {
            driver.Navigate().GoToUrl(sitemapUrl);

            // Wait for content to load
            var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(15));
            wait.Until(d => d.PageSource.Length > 100);

            var pageSource = driver.PageSource;

            // Selenium wraps XML in HTML - extract the raw XML content
            // Try to get it from the page source directly
            var xmlContent = ExtractXmlFromPageSource(pageSource);

            if (string.IsNullOrEmpty(xmlContent))
            {
                _logger.LogWarning("Could not extract XML from sitemap page source. Page source length: {Length}, preview: {Preview}",
                    pageSource.Length, pageSource[..Math.Min(300, pageSource.Length)]);
                return urls;
            }

            _logger.LogInformation("Sitemap XML extracted ({Length} chars)", xmlContent.Length);

            // Try to decode HTML entities that Selenium may have added
            xmlContent = System.Net.WebUtility.HtmlDecode(xmlContent);
            // Strip any leading whitespace/BOM that might cause XML parse failure
            xmlContent = xmlContent.TrimStart('\uFEFF', '\u200B', ' ', '\t', '\n', '\r');

            XDocument doc;
            try
            {
                doc = XDocument.Parse(xmlContent);
            }
            catch (System.Xml.XmlException ex)
            {
                _logger.LogWarning("XML parse failed, falling back to URL regex extraction: {Error}", ex.Message);

                // Fallback: extract URLs directly from the raw text using regex
                // This handles cases where Chrome strips XML tags but keeps URL text
                var urlMatches = Regex.Matches(xmlContent, @"(https?://[^\s<>""']+\.html?)");
                var fallbackUrls = urlMatches.Select(m => m.Groups[1].Value)
                    .Where(u => IsProductUrl(u))
                    .Distinct()
                    .ToList();

                if (fallbackUrls.Count > 0)
                {
                    _logger.LogInformation("Regex fallback found {Count} product URLs", fallbackUrls.Count);
                    return fallbackUrls;
                }

                // Also try extracting URLs without .html extension
                urlMatches = Regex.Matches(xmlContent, @"(https?://[^\s<>""']+/[^\s<>""']+)");
                fallbackUrls = urlMatches.Select(m => m.Groups[1].Value)
                    .Where(u => IsProductUrl(u))
                    .Distinct()
                    .ToList();

                if (fallbackUrls.Count > 0)
                {
                    _logger.LogInformation("Regex fallback (no ext) found {Count} product URLs", fallbackUrls.Count);
                    return fallbackUrls;
                }

                return urls;
            }
            var ns = doc.Root?.GetDefaultNamespace() ?? XNamespace.None;

            // Check if this is a sitemap index (contains <sitemap> elements pointing to sub-sitemaps)
            var sitemapRefs = doc.Descendants(ns + "sitemap")
                .Select(s => s.Element(ns + "loc")?.Value)
                .Where(u => !string.IsNullOrEmpty(u))
                .ToList();

            if (sitemapRefs.Count > 0)
            {
                _logger.LogInformation("Sitemap index found with {Count} sub-sitemaps", sitemapRefs.Count);

                // Fetch each sub-sitemap and collect watch URLs
                foreach (var subSitemapUrl in sitemapRefs)
                {
                    if (subSitemapUrl == null) continue;

                    // Only process English sitemap (skip other languages)
                    if (subSitemapUrl.Contains("/en/") || !Regex.IsMatch(subSitemapUrl, @"/[a-z]{2}/sitemap\.xml$"))
                    {
                        var subUrls = FetchUrlsFromSingleSitemap(driver, subSitemapUrl);
                        urls.AddRange(subUrls);
                    }
                }
            }
            else
            {
                // This is a regular sitemap - extract URLs directly
                urls = ExtractWatchUrlsFromXml(doc, ns);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sitemap: {Url}", sitemapUrl);
        }

        return urls;
    }

    /// Fetches a single sitemap XML and returns watch URLs
    private List<string> FetchUrlsFromSingleSitemap(IWebDriver driver, string sitemapUrl)
    {
        try
        {
            driver.Navigate().GoToUrl(sitemapUrl);
            var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(15));
            wait.Until(d => d.PageSource.Length > 100);

            var xmlContent = ExtractXmlFromPageSource(driver.PageSource);
            if (string.IsNullOrEmpty(xmlContent)) return new List<string>();

            var doc = XDocument.Parse(xmlContent);
            var ns = doc.Root?.GetDefaultNamespace() ?? XNamespace.None;

            return ExtractWatchUrlsFromXml(doc, ns);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error fetching sub-sitemap: {Url}", sitemapUrl);
            return new List<string>();
        }
    }

    /// Extracts watch product URLs from a parsed sitemap XML document
    private List<string> ExtractWatchUrlsFromXml(XDocument doc, XNamespace ns)
    {
        // Filter for watch product URLs - common patterns across brands
        var watchPatterns = new[] { "/watches/", "/timepieces/", "/collection/", "/watch-collection/" };

        return doc.Descendants(ns + "url")
            .Select(u => u.Element(ns + "loc")?.Value)
            .Where(u => !string.IsNullOrEmpty(u) && watchPatterns.Any(p => u.Contains(p)))
            // Exclude collection listing pages (they usually have fewer path segments)
            .Where(u => IsProductUrl(u!))
            .Select(u => u!)
            .Distinct()
            .ToList();
    }

    /// Determines if a URL is a product page vs a collection listing page
    /// Product URLs typically have more path segments (e.g., /watches/senator/senator-excellence-1-36-01-02-05-61/)
    private bool IsProductUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

            // Watch product URLs usually have at least 3 segments: /en/watches/collection/model-ref/
            // Collection pages have fewer: /en/watches/collection/ or /en/collection/
            return segments.Length >= 4;
        }
        catch
        {
            return false;
        }
    }

    /// Extracts raw XML from Selenium's page source (which may wrap XML in HTML)
    private string? ExtractXmlFromPageSource(string pageSource)
    {
        // If Selenium returned the raw XML
        if (pageSource.TrimStart().StartsWith("<?xml") || pageSource.TrimStart().StartsWith("<urlset") || pageSource.TrimStart().StartsWith("<sitemapindex"))
        {
            return pageSource;
        }

        // Selenium often wraps XML in HTML - try to extract from body or pre tag
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(pageSource);

        // Chrome's XML viewer puts content in a special #document node
        // Try to get the raw XML from pre tag or body
        var preNode = htmlDoc.DocumentNode.SelectSingleNode("//pre");
        if (preNode != null)
        {
            var text = System.Net.WebUtility.HtmlDecode(preNode.InnerText);
            if (text.Contains("<urlset") || text.Contains("<sitemapindex"))
                return text;
        }

        // Try the full body text
        var bodyText = System.Net.WebUtility.HtmlDecode(htmlDoc.DocumentNode.InnerText);
        if (bodyText.Contains("<urlset") || bodyText.Contains("<sitemapindex"))
            return bodyText;

        // Last resort: regex extract the XML
        var xmlMatch = Regex.Match(pageSource, @"(<\?xml.*?</(?:urlset|sitemapindex)>)", RegexOptions.Singleline);
        if (xmlMatch.Success)
            return System.Net.WebUtility.HtmlDecode(xmlMatch.Groups[1].Value);

        // Try to reconstruct from visible URL elements (Chrome renders XML as clickable links)
        var links = htmlDoc.DocumentNode.SelectNodes("//a[@href]");
        if (links != null)
        {
            var locUrls = links
                .Select(a => a.GetAttributeValue("href", ""))
                .Where(h => !string.IsNullOrEmpty(h) && h.StartsWith("http"))
                .ToList();

            if (locUrls.Count > 0)
            {
                // Build a minimal sitemap XML from the extracted URLs
                var sb = new System.Text.StringBuilder();
                sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
                sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
                foreach (var locUrl in locUrls)
                {
                    sb.AppendLine($"  <url><loc>{System.Security.SecurityElement.Escape(locUrl)}</loc></url>");
                }
                sb.AppendLine("</urlset>");
                return sb.ToString();
            }
        }

        return null;
    }

    /// Scrapes a single watch page using Selenium + Claude API
    private async Task<ScrapedWatchDto?> ScrapeWatchPageAsync(
        IWebDriver driver, string url, string brandName, CancellationToken ct)
    {
        try
        {
            // Navigate and wait for page to load
            driver.Navigate().GoToUrl(url);
            var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(20));
            wait.Until(d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState")?.ToString() == "complete");

            // Small delay for dynamic content to render
            await Task.Delay(1500, ct);

            var html = driver.PageSource;
            if (string.IsNullOrEmpty(html) || html.Length < 500)
            {
                _logger.LogWarning("Empty or minimal page from {Url}", url);
                return null;
            }

            // Send to Claude API for extraction
            var watchData = await _claudeApiService.ExtractWatchPageDataAsync(html, url, ct);
            if (watchData == null)
            {
                _logger.LogWarning("Claude API returned null for {Url}", url);
                return null;
            }

            if (string.IsNullOrEmpty(watchData.ReferenceNumber) && string.IsNullOrEmpty(watchData.WatchName))
            {
                _logger.LogWarning("No reference number or name extracted for {Url}", url);
                return null;
            }

            // Upload image to Cloudinary
            var imageUrl = watchData.ImageUrl ?? string.Empty;
            if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith("http"))
            {
                var sanitizedRef = Regex.Replace(watchData.ReferenceNumber ?? "unknown", @"[^a-zA-Z0-9_\-]", "");
                var sanitizedBrand = Regex.Replace(brandName, @"[^a-zA-Z0-9_\-]", "");
                var publicId = $"{sanitizedBrand}_{sanitizedRef}";

                var cloudinaryId = await _cloudinaryService.UploadImageFromUrlAsync(imageUrl, publicId, "watches");
                if (!string.IsNullOrEmpty(cloudinaryId))
                {
                    imageUrl = cloudinaryId;
                    _logger.LogInformation("Uploaded to Cloudinary: {PublicId}", cloudinaryId);
                }
            }

            // Serialize specs to JSON
            var specsJson = watchData.Specs != null
                ? JsonSerializer.Serialize(watchData.Specs, new JsonSerializerOptions
                {
                    WriteIndented = false,
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                })
                : "{}";

            // Build name: "RefNumber Variant" (e.g., "1-36-01-02-05-61 Excellence")
            // Strip collection prefix from watchName since collection is displayed separately
            var collectionName = ExtractCollectionFromWatchName(watchData.WatchName) ?? "Unknown";
            var displayName = watchData.WatchName ?? watchData.ReferenceNumber ?? "Unknown";
            var variantName = StripCollectionPrefix(displayName, collectionName);
            var name = !string.IsNullOrEmpty(watchData.ReferenceNumber)
                ? string.IsNullOrWhiteSpace(variantName)
                    ? watchData.ReferenceNumber
                    : $"{watchData.ReferenceNumber} {variantName}"
                : displayName;

            return new ScrapedWatchDto
            {
                Name = name,
                BrandName = brandName,
                CollectionName = collectionName,
                CurrentPrice = watchData.Price ?? "Price on request",
                Description = brandName,
                Specs = specsJson,
                ImageUrl = imageUrl,
                ReferenceNumber = watchData.ReferenceNumber,
                SourceUrl = url
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping watch page: {Url}", url);
            return null;
        }
    }

    /// Extracts collection name from the watch name using StartsWith matching
    /// e.g., "Senator Excellence" -> "Senator", "PanoMaticLunar" -> "PanoMatic"
    /// Order matters: more specific patterns checked first to avoid false matches
    private string? ExtractCollectionFromWatchName(string? watchName)
    {
        if (string.IsNullOrEmpty(watchName)) return null;

        // Ordered list: check specific/longer prefixes before shorter ones
        // e.g., "Seventies" before "Pano" to avoid "Panorama" matching "Pano"
        var collectionPrefixes = new (string Prefix, string Collection)[]
        {
            // Glashütte Original
            ("Sixties", "Spezialist"),
            ("Seventies", "Spezialist"),
            ("SeaQ", "SeaQ"),
            ("Senator", "Senator"),
            ("PanoMatic", "PanoMatic"),
            ("PanoLunar", "PanoMatic"),
            ("PanoInverse", "PanoMatic"),
            ("PanoReserve", "PanoMatic"),
            ("PanoGraph", "PanoMatic"),
            ("Pano ", "PanoMatic"),       // "Pano " with space to avoid "Panorama"
            ("Alfred Helwig", "Senator"),  // Special GO model in Senator collection
            ("Serenade", "Ladies"),
            ("Pavonina", "Ladies"),
            // Audemars Piguet - check specific before generic "Royal Oak"
            ("Royal Oak Concept", "Royal Oak Concept"),
            ("Royal Oak Offshore", "Royal Oak Offshore"),
            ("Royal Oak", "Royal Oak"),
            // Patek Philippe
            ("Nautilus", "Nautilus"),
            ("Calatrava", "Calatrava"),
            ("Aquanaut", "Aquanaut"),
            ("Gondolo", "Gondolo"),
            // Vacheron Constantin
            ("Overseas", "Overseas"),
            ("Patrimony", "Patrimony"),
            ("Traditionnelle", "Traditionnelle"),
            ("Historiques", "Historiques"),
            // Jaeger-LeCoultre
            ("Reverso", "Reverso"),
            ("Master", "Master"),
            ("Polaris", "Polaris"),
            // A. Lange & Söhne
            ("Lange 1", "Lange 1"),
            ("Saxonia", "Saxonia"),
            ("Datograph", "Datograph"),
            ("1815", "1815"),
            ("Zeitwerk", "Zeitwerk"),
        };

        foreach (var (prefix, collection) in collectionPrefixes)
        {
            if (watchName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return collection;
            }
        }

        // Fallback: use the first word of the watch name
        var firstWord = watchName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return firstWord;
    }

    /// Strips the collection name prefix from a watch name to get the short variant
    /// e.g., "Senator Excellence" with collection "Senator" -> "Excellence"
    /// e.g., "PanoMaticLunar" with collection "PanoMatic" -> "Lunar"
    private string StripCollectionPrefix(string watchName, string collectionName)
    {
        if (string.IsNullOrEmpty(watchName) || string.IsNullOrEmpty(collectionName))
            return watchName;

        // Check all known prefixes that map to this collection and strip the matching one
        var collectionPrefixes = new (string Prefix, string Collection)[]
        {
            ("Sixties", "Spezialist"), ("Seventies", "Spezialist"),
            ("SeaQ", "SeaQ"),
            ("Senator", "Senator"),
            ("PanoMatic", "PanoMatic"), ("PanoLunar", "PanoMatic"), ("PanoInverse", "PanoMatic"),
            ("PanoReserve", "PanoMatic"), ("PanoGraph", "PanoMatic"), ("Pano ", "PanoMatic"),
            ("Alfred Helwig", "Senator"), ("Serenade", "Ladies"), ("Pavonina", "Ladies"),
            ("Royal Oak Concept", "Royal Oak Concept"), ("Royal Oak Offshore", "Royal Oak Offshore"),
            ("Royal Oak", "Royal Oak"), ("Nautilus", "Nautilus"), ("Calatrava", "Calatrava"),
            ("Aquanaut", "Aquanaut"), ("Gondolo", "Gondolo"),
            ("Overseas", "Overseas"), ("Patrimony", "Patrimony"),
            ("Traditionnelle", "Traditionnelle"), ("Historiques", "Historiques"),
            ("Reverso", "Reverso"), ("Master", "Master"), ("Polaris", "Polaris"),
            ("Lange 1", "Lange 1"), ("Saxonia", "Saxonia"), ("Datograph", "Datograph"),
            ("1815", "1815"), ("Zeitwerk", "Zeitwerk"),
        };

        foreach (var (prefix, collection) in collectionPrefixes)
        {
            if (collection.Equals(collectionName, StringComparison.OrdinalIgnoreCase) &&
                watchName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var stripped = watchName[prefix.Length..].TrimStart();
                return stripped;
            }
        }

        // Fallback: try stripping collection name directly
        if (watchName.StartsWith(collectionName, StringComparison.OrdinalIgnoreCase))
        {
            return watchName[collectionName.Length..].TrimStart();
        }

        return watchName;
    }

    /// Pre-filters sitemap URLs by collection, using URL slug patterns
    /// Handles special cases like SeaQ (under /spezialist/ but only "seaq" product slugs)
    private List<string> PreFilterUrlsByCollection(List<string> urls, string collectionName)
    {
        return collectionName.ToLowerInvariant() switch
        {
            // Glashütte Original
            "senator" => urls.Where(u => u.Contains("/watches/senator/", StringComparison.OrdinalIgnoreCase)).ToList(),
            "panomatic" => urls.Where(u => u.Contains("/watches/pano/", StringComparison.OrdinalIgnoreCase)).ToList(),
            "seaq" => urls.Where(u =>
                u.Contains("/watches/spezialist/", StringComparison.OrdinalIgnoreCase) &&
                u.Contains("seaq", StringComparison.OrdinalIgnoreCase)).ToList(),
            "spezialist" => urls.Where(u =>
                (u.Contains("/watches/spezialist/", StringComparison.OrdinalIgnoreCase) &&
                 !u.Contains("seaq", StringComparison.OrdinalIgnoreCase)) ||
                u.Contains("/watches/vintage/", StringComparison.OrdinalIgnoreCase)).ToList(),
            // Audemars Piguet - URL pattern: /watch-collection/{collection-slug}/{ref}.html
            "royal oak" => urls.Where(u =>
                u.Contains("/royal-oak/", StringComparison.OrdinalIgnoreCase) &&
                !u.Contains("/royal-oak-offshore/", StringComparison.OrdinalIgnoreCase) &&
                !u.Contains("/royal-oak-concept/", StringComparison.OrdinalIgnoreCase)).ToList(),
            "royal oak offshore" => urls.Where(u => u.Contains("/royal-oak-offshore/", StringComparison.OrdinalIgnoreCase)).ToList(),
            "royal oak concept" => urls.Where(u => u.Contains("/royal-oak-concept/", StringComparison.OrdinalIgnoreCase)).ToList(),
            _ => urls  // No pre-filtering for unknown collections
        };
    }

    /// Creates a headless Chrome WebDriver instance
    private IWebDriver CreateDriver()
    {
        try
        {
            var options = new ChromeOptions();
            options.AddArgument("--headless");
            options.AddArgument("--no-sandbox");
            options.AddArgument("--disable-dev-shm-usage");
            options.AddArgument("--disable-gpu");
            options.AddArgument("--window-size=1920,1080");
            options.AddArgument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

            var driver = new ChromeDriver(options);
            _logger.LogInformation("Selenium Chrome WebDriver initialized");
            return driver;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Chrome WebDriver");
            throw;
        }
    }
}
