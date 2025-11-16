// Chrono24 web scraper service
// Scrapes watch data from Chrono24 luxury watch marketplace

using backend.DTOs;
using HtmlAgilityPack;
using Microsoft.Extensions.Configuration;
using System.Web;

namespace backend.Services;

public class Chrono24ScraperService : IChrono24ScraperService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<Chrono24ScraperService> _logger;
    private readonly IConfiguration _configuration;
    private readonly int _requestDelayMs;
    private readonly string _baseUrl;

    public Chrono24ScraperService(
        HttpClient httpClient,
        ILogger<Chrono24ScraperService> logger,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;

        // Configure HttpClient with realistic browser headers
        _httpClient.DefaultRequestHeaders.Add("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Add("Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        _httpClient.Timeout = TimeSpan.FromSeconds(30);

        // Load configuration
        _baseUrl = _configuration.GetValue<string>("Chrono24:BaseUrl") ?? "https://www.chrono24.com";
        _requestDelayMs = _configuration.GetValue<int>("Chrono24:RequestDelayMs", 3000);
    }

    public async Task<(bool success, string message)> TestConnectionAsync()
    {
        try
        {
            _logger.LogInformation("Testing connection to Chrono24...");

            var response = await _httpClient.GetAsync(_baseUrl);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully connected to Chrono24");
                return (true, $"Connection successful. Status: {response.StatusCode}");
            }

            _logger.LogWarning("Failed to connect to Chrono24. Status: {StatusCode}", response.StatusCode);
            return (false, $"Connection failed. Status: {response.StatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing connection to Chrono24");
            return (false, $"Connection error: {ex.Message}");
        }
    }

    public async Task<List<ScrapedWatchDto>> ScrapeWatchesByCollectionAsync(
        string brandName,
        string collectionName,
        int maxWatches = 40)
    {
        var scrapedWatches = new List<ScrapedWatchDto>();

        try
        {
            _logger.LogInformation("Scraping {Brand} {Collection} (max {Max} watches)",
                brandName, collectionName, maxWatches);

            // Construct Chrono24 search URL
            var searchQuery = $"{brandName} {collectionName}";
            var searchUrl = BuildSearchUrl(searchQuery);

            _logger.LogInformation("Search URL: {Url}", searchUrl);

            // Fetch the page
            var html = await FetchPageWithDelay(searchUrl);

            if (string.IsNullOrEmpty(html))
            {
                _logger.LogWarning("No HTML content received for {Brand} {Collection}",
                    brandName, collectionName);
                return scrapedWatches;
            }

            // Parse HTML and extract watch listings
            var watches = ParseWatchListings(html, brandName, collectionName, maxWatches);
            scrapedWatches.AddRange(watches);

            _logger.LogInformation("Successfully scraped {Count} watches for {Brand} {Collection}",
                scrapedWatches.Count, brandName, collectionName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping {Brand} {Collection}",
                brandName, collectionName);
        }

        return scrapedWatches;
    }

    public async Task<List<ScrapedWatchDto>> ScrapeWatchesByBrandAsync(
        string brandName,
        int maxWatchesPerCollection = 40)
    {
        var scrapedWatches = new List<ScrapedWatchDto>();

        try
        {
            _logger.LogInformation("Scraping all watches for brand: {Brand}", brandName);

            // Build URL for brand page
            var brandUrl = BuildBrandUrl(brandName);
            _logger.LogInformation("Brand URL: {Url}", brandUrl);

            // Fetch the brand page
            var html = await FetchPageWithDelay(brandUrl);

            if (string.IsNullOrEmpty(html))
            {
                _logger.LogWarning("No HTML content received for brand {Brand}", brandName);
                return scrapedWatches;
            }

            // Parse watch listings from brand page
            var watches = ParseWatchListings(html, brandName, string.Empty, maxWatchesPerCollection);
            scrapedWatches.AddRange(watches);

            _logger.LogInformation("Successfully scraped {Count} watches for brand {Brand}",
                scrapedWatches.Count, brandName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping brand {Brand}", brandName);
        }

        return scrapedWatches;
    }

    #region Private Helper Methods

    private string BuildSearchUrl(string searchQuery)
    {
        var encodedQuery = HttpUtility.UrlEncode(searchQuery);
        return $"{_baseUrl}/search/index.htm?query={encodedQuery}&dosearch=true&searchexplain=1&resultview=block";
    }

    private string BuildBrandUrl(string brandName)
    {
        // Normalize brand name for URL (lowercase, hyphens instead of spaces)
        var normalizedBrand = brandName.ToLower()
            .Replace(" ", "-")
            .Replace(".", "")
            .Replace("&", "and");

        return $"{_baseUrl}/{normalizedBrand}/index.htm";
    }

    private async Task<string> FetchPageWithDelay(string url)
    {
        try
        {
            // Polite scraping: wait before making request
            await Task.Delay(_requestDelayMs);

            _logger.LogDebug("Fetching: {Url}", url);
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("HTTP {StatusCode} for URL: {Url}",
                    response.StatusCode, url);
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching page: {Url}", url);
            return string.Empty;
        }
    }

    private List<ScrapedWatchDto> ParseWatchListings(
        string html,
        string brandName,
        string collectionName,
        int maxWatches)
    {
        var watches = new List<ScrapedWatchDto>();

        try
        {
            var htmlDoc = new HtmlDocument();
            htmlDoc.LoadHtml(html);

            // NOTE: These selectors are PLACEHOLDERS and will need to be updated
            // based on the actual Chrono24 HTML structure.
            // You'll need to inspect Chrono24's HTML to find the correct selectors.

            // Common patterns for watch listing sites:
            // - Article/div containers with class like "article-item", "watch-card", "listing-item"
            // - Price in elements with class like "price", "article-price"
            // - Image in img tags within the article
            // - Title/name in h2/h3 or link text

            var listingNodes = htmlDoc.DocumentNode.SelectNodes(
                "//article[contains(@class, 'article-item')] | " +
                "//div[contains(@class, 'article-item')] | " +
                "//div[contains(@class, 'js-article-item')]");

            if (listingNodes == null || !listingNodes.Any())
            {
                _logger.LogWarning("No watch listings found in HTML. Selectors may need updating.");
                return watches;
            }

            _logger.LogInformation("Found {Count} potential watch listings", listingNodes.Count);

            int count = 0;
            foreach (var node in listingNodes)
            {
                if (count >= maxWatches) break;

                try
                {
                    var watch = ExtractWatchData(node, brandName, collectionName);

                    if (watch != null && !string.IsNullOrEmpty(watch.Name))
                    {
                        watches.Add(watch);
                        count++;
                        _logger.LogDebug("Extracted: {Name} - {Price}", watch.Name, watch.CurrentPrice);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error extracting watch data from listing");
                }
            }

            _logger.LogInformation("Extracted {Count} complete watch entries", watches.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing watch listings HTML");
        }

        return watches;
    }

    private ScrapedWatchDto? ExtractWatchData(
        HtmlNode node,
        string brandName,
        string collectionName)
    {
        try
        {
            // NOTE: These selectors are PLACEHOLDERS
            // Update based on actual Chrono24 HTML structure

            // Extract watch name/title
            var nameNode = node.SelectSingleNode(".//h2 | .//h3 | .//a[contains(@class, 'article-name')]");
            var name = nameNode?.InnerText?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            // Extract price
            var priceNode = node.SelectSingleNode(".//*[contains(@class, 'price')]");
            var price = priceNode?.InnerText?.Trim()
                .Replace("$", "")
                .Replace(",", "")
                .Trim() ?? "Price on request";

            // Extract image URL
            var imageNode = node.SelectSingleNode(".//img");
            var imageUrl = imageNode?.GetAttributeValue("src", string.Empty)
                ?? imageNode?.GetAttributeValue("data-src", string.Empty)
                ?? string.Empty;

            // Extract reference number if available
            var refNode = node.SelectSingleNode(".//*[contains(@class, 'reference')]");
            var referenceNumber = refNode?.InnerText?.Trim();

            // Extract source URL
            var linkNode = node.SelectSingleNode(".//a[@href]");
            var sourceUrl = linkNode?.GetAttributeValue("href", string.Empty);
            if (!string.IsNullOrEmpty(sourceUrl) && !sourceUrl.StartsWith("http"))
            {
                sourceUrl = _baseUrl + sourceUrl;
            }

            // Create the DTO
            var watch = new ScrapedWatchDto
            {
                Name = CleanText(name),
                BrandName = brandName,
                CollectionName = collectionName,
                CurrentPrice = CleanText(price),
                ImageUrl = imageUrl,
                ReferenceNumber = referenceNumber,
                SourceUrl = sourceUrl,
                // Description and Specs will be enriched later or set to defaults
                Description = $"Luxury timepiece from {brandName}",
                Specs = "Movement: Automatic; Case: Stainless Steel; Water Resistance: 100m"
            };

            return watch;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extracting individual watch data");
            return null;
        }
    }

    private string CleanText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        // Decode HTML entities and clean up whitespace
        text = HttpUtility.HtmlDecode(text);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    #endregion
}
