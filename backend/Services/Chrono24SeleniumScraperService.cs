// Chrono24 web scraper service using Selenium WebDriver
// Bypasses anti-bot protection by using a real Chrome browser

using backend.DTOs;
using HtmlAgilityPack;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using System.Web;

namespace backend.Services;

public class Chrono24SeleniumScraperService : IChrono24ScraperService, IDisposable
{
    private readonly ILogger<Chrono24SeleniumScraperService> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _baseUrl;
    private readonly int _requestDelayMs;
    private IWebDriver? _driver;

    public Chrono24SeleniumScraperService(
        ILogger<Chrono24SeleniumScraperService> logger,
        IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;

        _baseUrl = _configuration.GetValue<string>("Chrono24:BaseUrl") ?? "https://www.chrono24.com";
        _requestDelayMs = _configuration.GetValue<int>("Chrono24:RequestDelayMs", 3000);
    }

    private IWebDriver GetDriver()
    {
        if (_driver != null)
        {
            return _driver;
        }

        _logger.LogInformation("Initializing Chrome WebDriver with anti-detection settings");

        var options = new ChromeOptions();

        // Anti-detection settings
        options.AddArgument("--disable-blink-features=AutomationControlled");
        options.AddExcludedArgument("enable-automation");
        options.AddAdditionalOption("useAutomationExtension", false);

        // Headless mode (runs without visible browser window)
        options.AddArgument("--headless=new");
        options.AddArgument("--disable-gpu");

        // Realistic browser settings
        options.AddArgument("--window-size=1920,1080");
        options.AddArgument("--disable-dev-shm-usage");
        options.AddArgument("--no-sandbox");

        // User agent
        options.AddArgument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        // Performance optimizations
        options.AddArgument("--disable-images"); // Don't load images for faster scraping
        options.AddArgument("--blink-settings=imagesEnabled=false");

        // Additional preferences
        options.AddUserProfilePreference("profile.default_content_setting_values.images", 2);
        options.AddUserProfilePreference("profile.managed_default_content_settings.images", 2);

        try
        {
            _driver = new ChromeDriver(options);

            // Set page load timeout
            _driver.Manage().Timeouts().PageLoad = TimeSpan.FromSeconds(30);
            _driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(10);

            _logger.LogInformation("Chrome WebDriver initialized successfully");
            return _driver;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Chrome WebDriver");
            throw;
        }
    }

    public async Task<(bool success, string message)> TestConnectionAsync()
    {
        try
        {
            _logger.LogInformation("Testing connection to Chrono24 with Selenium...");

            var driver = GetDriver();
            driver.Navigate().GoToUrl(_baseUrl);

            // Wait a bit for page to load
            await Task.Delay(2000);

            var title = driver.Title;
            _logger.LogInformation("Successfully loaded Chrono24. Page title: {Title}", title);

            return (true, $"Connection successful. Page loaded: {title}");
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
            _logger.LogInformation("Scraping {Brand} {Collection} (max {Max} watches) with Selenium",
                brandName, collectionName, maxWatches);

            // Construct Chrono24 search URL
            var searchQuery = $"{brandName} {collectionName}";
            var searchUrl = BuildSearchUrl(searchQuery);

            _logger.LogInformation("Search URL: {Url}", searchUrl);

            // Fetch the page with Selenium
            var html = await FetchPageWithSelenium(searchUrl);

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
            _logger.LogInformation("Scraping all watches for brand: {Brand} with Selenium", brandName);

            // Build URL for brand page
            var brandUrl = BuildBrandUrl(brandName);
            _logger.LogInformation("Brand URL: {Url}", brandUrl);

            // Fetch the brand page
            var html = await FetchPageWithSelenium(brandUrl);

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

    public async Task<ScrapedWatchDto?> ScrapeWatchByExactNameAsync(
        string watchName,
        string brandName,
        string collectionName)
    {
        try
        {
            _logger.LogInformation("Scraping watch by exact name: {Name} ({Brand})", watchName, brandName);

            // Construct Chrono24 search URL with exact watch name
            var searchUrl = BuildSearchUrl(watchName);
            _logger.LogInformation("Search URL: {Url}", searchUrl);

            // Fetch the page with Selenium
            var html = await FetchPageWithSelenium(searchUrl);

            if (string.IsNullOrEmpty(html))
            {
                _logger.LogWarning("No HTML content received for watch {Name}", watchName);
                return null;
            }

            // Parse HTML and extract watch listings
            var watches = ParseWatchListings(html, brandName, collectionName, 5); // Get top 5 results

            if (!watches.Any())
            {
                _logger.LogWarning("No watches found for {Name}", watchName);
                return null;
            }

            // Return the first result (most relevant)
            var watch = watches.First();
            _logger.LogInformation("Found watch: {Name} - {Price}", watch.Name, watch.CurrentPrice);
            return watch;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping watch by exact name: {Name}", watchName);
            return null;
        }
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

    private async Task<string> FetchPageWithSelenium(string url)
    {
        try
        {
            // Polite scraping: wait before making request
            await Task.Delay(_requestDelayMs);

            _logger.LogDebug("Fetching with Selenium: {Url}", url);

            var driver = GetDriver();
            driver.Navigate().GoToUrl(url);

            // Wait for page to load (wait for watch listings to appear)
            await Task.Delay(3000); // Give extra time for JavaScript to render

            var html = driver.PageSource;

            _logger.LogDebug("Received {Length} characters of HTML", html.Length);
            return html;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching page with Selenium: {Url}", url);
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

            // Chrono24-specific selectors
            // Main watch listing container: div with class "js-listing-item"
            var listingNodes = htmlDoc.DocumentNode.SelectNodes(
                "//div[contains(@class, 'js-listing-item')]");

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
            // Extract watch model name (first bold paragraph)
            var modelNode = node.SelectSingleNode(".//p[contains(@class, 'text-bold') and contains(@class, 'text-ellipsis')]");
            var modelName = modelNode?.InnerText?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(modelName))
            {
                return null;
            }

            // Extract full description (second paragraph with text-md)
            var descriptionNode = node.SelectSingleNode(".//p[contains(@class, 'text-ellipsis') and contains(@class, 'text-md')]");
            var fullDescription = descriptionNode?.InnerText?.Trim() ?? string.Empty;

            // Combine model name and description for the watch name
            var name = !string.IsNullOrEmpty(fullDescription) ? fullDescription : modelName;

            // Extract price (in the div with align-content-end)
            var priceNode = node.SelectSingleNode(".//div[contains(@class, 'align-content-end')]//p[contains(@class, 'text-bold')]");
            var price = priceNode?.InnerText?.Trim() ?? "Price on request";

            // Extract image URL (first img tag with alt attribute)
            var imageNode = node.SelectSingleNode(".//img[@alt]");
            var imageUrl = imageNode?.GetAttributeValue("src", string.Empty) ?? string.Empty;

            // If src is not available, try srcset
            if (string.IsNullOrEmpty(imageUrl))
            {
                var srcset = imageNode?.GetAttributeValue("srcset", string.Empty);
                if (!string.IsNullOrEmpty(srcset))
                {
                    // Take the first URL from srcset
                    imageUrl = srcset.Split(',')[0].Trim().Split(' ')[0];
                }
            }

            // Extract reference number from the description
            string? referenceNumber = null;
            if (!string.IsNullOrEmpty(fullDescription))
            {
                var refMatch = System.Text.RegularExpressions.Regex.Match(
                    fullDescription, @"\b(\d{4,6}[A-Z]*)\b");
                if (refMatch.Success)
                {
                    referenceNumber = refMatch.Groups[1].Value;
                }
            }

            // Extract source URL (link to detail page)
            var linkNode = node.SelectSingleNode(".//a[contains(@class, 'wt-listing-item-link')]");
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
                Description = !string.IsNullOrEmpty(fullDescription)
                    ? CleanText(fullDescription)
                    : $"Luxury {modelName} timepiece from {brandName}",
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

    public void Dispose()
    {
        if (_driver != null)
        {
            try
            {
                _driver.Quit();
                _driver.Dispose();
                _logger.LogInformation("Chrome WebDriver disposed");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing Chrome WebDriver");
            }
            finally
            {
                _driver = null;
            }
        }
    }
}
