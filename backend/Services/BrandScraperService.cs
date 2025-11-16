// Universal scraper service for luxury watch brands' official websites
// Handles Patek Philippe, Vacheron Constantin, Audemars Piguet, and other brands
// Uses brand-specific configurations to extract product data and specifications

using backend.DTOs;
using backend.Models;
using HtmlAgilityPack;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace backend.Services;

public class BrandScraperService : IDisposable
{
    private readonly ILogger<BrandScraperService> _logger;
    private readonly CurrencyConverter _currencyConverter;
    private readonly Dictionary<string, BrandScraperConfig> _brandConfigs;
    private IWebDriver? _driver;

    public BrandScraperService(
        ILogger<BrandScraperService> logger,
        CurrencyConverter currencyConverter)
    {
        _logger = logger;
        _currencyConverter = currencyConverter;
        _brandConfigs = new Dictionary<string, BrandScraperConfig>();

        // Initialize brand configurations
        InitializeBrandConfigs();
    }

    /// <summary>
    /// Initialize configurations for all supported brands
    /// </summary>
    private void InitializeBrandConfigs()
    {
        // Patek Philippe configuration
        _brandConfigs["Patek Philippe"] = new BrandScraperConfig
        {
            BrandName = "Patek Philippe",
            BaseUrl = "https://www.patek.com",
            CollectionUrls = new Dictionary<string, string>
            {
                { "Calatrava", "/en/collection/calatrava/all-watches" },
                { "Nautilus", "/en/collection/nautilus/all-watches" },
                { "Aquanaut", "/en/collection/aquanaut/all-watches" },
                { "Complications", "/en/collection/complications/all-watches" },
                { "Grand Complications", "/en/collection/grand-complications/all-watches" }
            },
            ProductCard = new ProductCardSelectors
            {
                // XPath selectors
                CardContainer = "//a[contains(@class, 'editorial-card')]",
                ReferenceNumber = ".//h2", // Will be extracted from text
                CollectionName = ".//h3", // Collection name in card
                CaseMaterial = ".//p[position()=last()]", // Material text below reference
                Image = ".//img[contains(@class, 'editorial-card_image')]",
                DetailPageLink = "" // Card itself is a link
            },
            DetailPage = new DetailPageSelectors
            {
                // XPath selectors for Patek Philippe detail page (updated based on actual HTML structure)
                Price = "//div[contains(@class, 'product-price_product-price')]//p",
                ReferenceNumber = "//h2[contains(@class, 'product-technical-section_title')]",
                CollectionName = "//h3[contains(@class, 'product-technical-section_subtitle')]",
                DialSpecs = "//h3[contains(@class, 'accordion-title') and contains(text(), 'Dial')]/ancestor::div[contains(@class, 'accordion-item')]//div[contains(@class, 'accordion_content__')]",
                CaseSpecs = "//h3[contains(@class, 'accordion-title') and contains(text(), 'Case')]/ancestor::div[contains(@class, 'accordion-item')]//div[contains(@class, 'accordion_content__')]",
                StrapSpecs = "//h3[contains(@class, 'accordion-title') and contains(text(), 'Strap')]/ancestor::div[contains(@class, 'accordion-item')]//div[contains(@class, 'accordion_content__')]",
                MovementSpecs = "//h3[contains(@class, 'accordion-title') and contains(text(), 'Movement')]/ancestor::div[contains(@class, 'accordion-item')]//div[contains(@class, 'accordion_content__')]"
            },
            RequiresJavaScript = true, // Patek site uses React
            Currency = "AUD",
            RequestDelayMs = 2000
        };

        // Add more brands as needed (Vacheron Constantin, Audemars Piguet, etc.)
    }

    /// <summary>
    /// Scrapes watches for a specific brand and collection
    /// </summary>
    public async Task<List<ScrapedWatchDto>> ScrapeCollectionAsync(
        string brandName,
        string collectionName,
        int maxWatches = 50)
    {
        if (!_brandConfigs.ContainsKey(brandName))
        {
            _logger.LogError("Brand configuration not found: {BrandName}", brandName);
            return new List<ScrapedWatchDto>();
        }

        var config = _brandConfigs[brandName];
        if (!config.CollectionUrls.ContainsKey(collectionName))
        {
            _logger.LogError("Collection not found for {Brand}: {Collection}", brandName, collectionName);
            return new List<ScrapedWatchDto>();
        }

        var collectionUrl = config.BaseUrl + config.CollectionUrls[collectionName];
        _logger.LogInformation("Scraping {Brand} - {Collection} from {Url}",
            brandName, collectionName, collectionUrl);

        try
        {
            // Initialize Selenium if needed
            if (config.RequiresJavaScript && _driver == null)
            {
                InitializeSeleniumDriver();
            }

            // Fetch the listing page
            var htmlContent = config.RequiresJavaScript
                ? await FetchWithSeleniumAsync(collectionUrl)
                : await FetchWithHttpClientAsync(collectionUrl);

            if (string.IsNullOrEmpty(htmlContent))
            {
                _logger.LogError("Failed to fetch collection page");
                return new List<ScrapedWatchDto>();
            }

            // Parse product cards
            var productCards = ParseProductCards(htmlContent, config);
            _logger.LogInformation("Found {Count} product cards", productCards.Count);

            // Scrape details for each watch
            var scrapedWatches = new List<ScrapedWatchDto>();
            var count = 0;

            foreach (var card in productCards.Take(maxWatches))
            {
                try
                {
                    var watch = await ScrapeWatchDetailAsync(card, config);
                    if (watch != null)
                    {
                        scrapedWatches.Add(watch);
                        count++;
                        _logger.LogInformation("Scraped watch {Count}/{Max}: {Name}",
                            count, maxWatches, watch.Name);
                    }

                    // Rate limiting
                    await Task.Delay(config.RequestDelayMs);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error scraping watch detail");
                }
            }

            return scrapedWatches;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping collection {Collection}", collectionName);
            return new List<ScrapedWatchDto>();
        }
    }

    /// <summary>
    /// Parses product cards from listing page HTML
    /// Returns list of detail page URLs and basic info
    /// </summary>
    private List<ProductCardInfo> ParseProductCards(string html, BrandScraperConfig config)
    {
        var cards = new List<ProductCardInfo>();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // Find all product card containers (selector already includes // prefix)
        var cardNodes = doc.DocumentNode.SelectNodes(config.ProductCard.CardContainer);
        if (cardNodes == null || cardNodes.Count == 0)
        {
            _logger.LogWarning("No product cards found with selector: {Selector}",
                config.ProductCard.CardContainer);
            return cards;
        }

        foreach (var cardNode in cardNodes)
        {
            try
            {
                // Extract detail page URL
                var detailUrl = cardNode.GetAttributeValue("href", string.Empty);
                if (string.IsNullOrEmpty(detailUrl))
                {
                    continue;
                }

                if (!detailUrl.StartsWith("http"))
                {
                    detailUrl = config.BaseUrl + detailUrl;
                }

                // Extract reference number from card (if available)
                var refNode = cardNode.SelectSingleNode(config.ProductCard.ReferenceNumber);
                var referenceNumber = refNode?.InnerText?.Trim() ?? string.Empty;

                // Extract collection name from card
                var collectionNode = cardNode.SelectSingleNode(config.ProductCard.CollectionName);
                var collectionName = collectionNode?.InnerText?.Trim() ?? string.Empty;

                // Extract material from card
                var materialNode = cardNode.SelectSingleNode(config.ProductCard.CaseMaterial);
                var material = materialNode?.InnerText?.Trim() ?? string.Empty;

                // Extract image URL
                var imageNode = cardNode.SelectSingleNode(config.ProductCard.Image);
                var imageUrl = string.Empty;
                if (imageNode != null)
                {
                    // Get highest resolution from srcset
                    var srcset = imageNode.GetAttributeValue("srcset", string.Empty);
                    if (!string.IsNullOrEmpty(srcset))
                    {
                        // Take the last (highest resolution) URL from srcset
                        var urls = srcset.Split(',');
                        if (urls.Length > 0)
                        {
                            var lastUrl = urls[urls.Length - 1].Trim().Split(' ')[0];
                            imageUrl = lastUrl.StartsWith("http") ? lastUrl : config.BaseUrl + lastUrl;
                        }
                    }
                    else
                    {
                        imageUrl = imageNode.GetAttributeValue("src", string.Empty);
                        if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("http"))
                        {
                            imageUrl = config.BaseUrl + imageUrl;
                        }
                    }
                }

                cards.Add(new ProductCardInfo
                {
                    DetailUrl = detailUrl,
                    ReferenceNumber = CleanText(referenceNumber),
                    CollectionName = CleanText(collectionName),
                    CaseMaterial = CleanText(material),
                    ImageUrl = imageUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error parsing product card");
            }
        }

        return cards;
    }

    /// <summary>
    /// Scrapes detailed information from a watch's detail page
    /// </summary>
    private async Task<ScrapedWatchDto?> ScrapeWatchDetailAsync(
        ProductCardInfo cardInfo,
        BrandScraperConfig config)
    {
        try
        {
            // Fetch detail page (with accordion expansion for JS-rendered pages)
            var html = config.RequiresJavaScript
                ? await FetchWithSeleniumAsync(cardInfo.DetailUrl, expandAccordions: true)
                : await FetchWithHttpClientAsync(cardInfo.DetailUrl);

            if (string.IsNullOrEmpty(html))
            {
                _logger.LogWarning("Failed to fetch detail page: {Url}", cardInfo.DetailUrl);
                return null;
            }

            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // Extract reference number (use card info as fallback)
            var refNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.ReferenceNumber);
            var referenceNumber = refNode?.InnerText?.Trim() ?? cardInfo.ReferenceNumber;
            referenceNumber = CleanText(referenceNumber);

            // Extract collection name (use card info as fallback)
            var collectionNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.CollectionName);
            var collectionName = collectionNode?.InnerText?.Trim() ?? cardInfo.CollectionName;
            collectionName = CleanText(collectionName);

            // Extract price
            var priceNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.Price);
            var priceText = priceNode?.InnerText?.Trim() ?? "Price on request";
            var price = ParseAndConvertPrice(priceText, config.Currency);
            
            _logger.LogInformation("Extracted price for {Reference}: {Price}", referenceNumber, price);

            // Extract comprehensive specs
            var specs = ExtractSpecs(doc, config);
            var specsJson = JsonSerializer.Serialize(specs, new JsonSerializerOptions
            {
                WriteIndented = false,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            // Create DTO
            var watch = new ScrapedWatchDto
            {
                Name = referenceNumber, // Use reference number as name
                BrandName = config.BrandName,
                CollectionName = collectionName,
                CurrentPrice = price,
                Description = $"{config.BrandName} {collectionName} {referenceNumber}",
                Specs = specsJson,
                ImageUrl = cardInfo.ImageUrl,
                ReferenceNumber = referenceNumber,
                SourceUrl = cardInfo.DetailUrl
            };

            return watch;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping watch detail from {Url}", cardInfo.DetailUrl);
            return null;
        }
    }

    /// <summary>
    /// Extracts structured specs from detail page
    /// </summary>
    private WatchSpecs ExtractSpecs(HtmlDocument doc, BrandScraperConfig config)
    {
        var specs = new WatchSpecs();

        try
        {
            // Extract Dial specs (selectors already have // prefix)
            var dialNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.DialSpecs);
            if (dialNode != null)
            {
                specs.Dial = ParseDialSpecs(dialNode.InnerText);
                _logger.LogInformation("Extracted Dial specs");
            }

            // Extract Case specs
            var caseNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.CaseSpecs);
            if (caseNode != null)
            {
                specs.Case = ParseCaseSpecs(caseNode.InnerText);
                _logger.LogInformation("Extracted Case specs");
            }

            // Extract Strap specs
            var strapNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.StrapSpecs);
            if (strapNode != null)
            {
                specs.Strap = ParseStrapSpecs(strapNode.InnerText);
                _logger.LogInformation("Extracted Strap specs");
            }

            // Extract Movement specs
            var movementNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.MovementSpecs);
            if (movementNode != null)
            {
                specs.Movement = ParseMovementSpecs(movementNode.InnerText);
                _logger.LogInformation("Extracted Movement specs");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extracting specs");
        }

        return specs;
    }

    /// <summary>
    /// Parses dial specifications from text
    /// </summary>
    private DialSpecs ParseDialSpecs(string text)
    {
        var dial = new DialSpecs { Description = CleanText(text) };

        // Extract color (common patterns - expanded list)
        var colorMatch = Regex.Match(text, @"(sunburst\s+brown|black|white|blue|silver|grey|gray|champagne|salmon|brown|green|red)", RegexOptions.IgnoreCase);
        if (colorMatch.Success)
        {
            dial.Color = colorMatch.Groups[1].Value;
        }

        return dial;
    }

    /// <summary>
    /// Parses case specifications from text
    /// </summary>
    private CaseSpecs ParseCaseSpecs(string text)
    {
        var caseSpecs = new CaseSpecs();

        // Extract material
        var materialMatch = Regex.Match(text, @"(white gold|yellow gold|rose gold|platinum|stainless steel|titanium)", RegexOptions.IgnoreCase);
        if (materialMatch.Success)
        {
            caseSpecs.Material = materialMatch.Groups[1].Value;
        }

        // Extract diameter
        var diameterMatch = Regex.Match(text, @"Diameter[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        if (diameterMatch.Success)
        {
            caseSpecs.Diameter = diameterMatch.Groups[1].Value;
        }

        // Extract thickness
        var thicknessMatch = Regex.Match(text, @"Thickness[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        if (thicknessMatch.Success)
        {
            caseSpecs.Thickness = thicknessMatch.Groups[1].Value;
        }

        // Extract water resistance
        var waterMatch = Regex.Match(text, @"Water[- ]resistant[:\s]+to[:\s]+(\d+\s*m)", RegexOptions.IgnoreCase);
        if (waterMatch.Success)
        {
            caseSpecs.WaterResistance = waterMatch.Groups[1].Value;
        }

        // Extract crystal
        if (text.Contains("Sapphire", StringComparison.OrdinalIgnoreCase))
        {
            caseSpecs.Crystal = "Sapphire";
        }

        return caseSpecs;
    }

    /// <summary>
    /// Parses strap/bracelet specifications from text
    /// </summary>
    private StrapSpecs ParseStrapSpecs(string text)
    {
        var strap = new StrapSpecs();

        // Extract material
        var materialMatch = Regex.Match(text, @"(Alligator leather|Calfskin|Rubber|Stainless steel bracelet)", RegexOptions.IgnoreCase);
        if (materialMatch.Success)
        {
            strap.Material = materialMatch.Groups[1].Value;
        }

        // Extract color
        var colorMatch = Regex.Match(text, @"(black|brown|blue|navy|beige|tan)", RegexOptions.IgnoreCase);
        if (colorMatch.Success)
        {
            strap.Color = colorMatch.Groups[1].Value;
        }

        // Extract buckle
        var buckleMatch = Regex.Match(text, @"(white gold|yellow gold|rose gold|platinum|steel).*?(buckle|clasp|prong)", RegexOptions.IgnoreCase);
        if (buckleMatch.Success)
        {
            strap.Buckle = buckleMatch.Value;
        }

        return strap;
    }

    /// <summary>
    /// Parses movement specifications from text
    /// </summary>
    private MovementSpecs ParseMovementSpecs(string text)
    {
        var movement = new MovementSpecs();

        // Extract caliber (first line or pattern)
        var caliberMatch = Regex.Match(text, @"(\d+[-\s]*\w+[-\s]*\w*[-\s]*\w*)");
        if (caliberMatch.Success)
        {
            movement.Caliber = caliberMatch.Groups[1].Value.Trim();
        }

        // Extract type
        if (text.Contains("Self-winding", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("Automatic", StringComparison.OrdinalIgnoreCase))
        {
            movement.Type = "Automatic (Self-winding)";
        }
        else if (text.Contains("Manual", StringComparison.OrdinalIgnoreCase))
        {
            movement.Type = "Manual winding";
        }
        else if (text.Contains("Quartz", StringComparison.OrdinalIgnoreCase))
        {
            movement.Type = "Quartz";
        }

        // Extract diameter
        var diameterMatch = Regex.Match(text, @"Diameter[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        if (diameterMatch.Success)
        {
            movement.Diameter = diameterMatch.Groups[1].Value;
        }

        // Extract thickness
        var thicknessMatch = Regex.Match(text, @"Thickness[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        if (thicknessMatch.Success)
        {
            movement.Thickness = thicknessMatch.Groups[1].Value;
        }

        // Extract parts
        var partsMatch = Regex.Match(text, @"Number of parts[:\s]+(\d+)", RegexOptions.IgnoreCase);
        if (partsMatch.Success && int.TryParse(partsMatch.Groups[1].Value, out var parts))
        {
            movement.Parts = parts;
        }

        // Extract jewels
        var jewelsMatch = Regex.Match(text, @"Number of jewels[:\s]+(\d+)", RegexOptions.IgnoreCase);
        if (jewelsMatch.Success && int.TryParse(jewelsMatch.Groups[1].Value, out var jewels))
        {
            movement.Jewels = jewels;
        }

        // Extract power reserve
        var powerMatch = Regex.Match(text, @"Power reserve[:\s]+([^\n\.]+)", RegexOptions.IgnoreCase);
        if (powerMatch.Success)
        {
            movement.PowerReserve = powerMatch.Groups[1].Value.Trim();
        }

        // Extract frequency
        var frequencyMatch = Regex.Match(text, @"(\d+[,\d]+.*?(?:semi-oscillations|vibrations).*?(?:\d+\s*Hz))", RegexOptions.IgnoreCase);
        if (frequencyMatch.Success)
        {
            movement.Frequency = frequencyMatch.Groups[1].Value;
        }

        // Extract complications
        var complications = new List<string>();
        if (text.Contains("Date", StringComparison.OrdinalIgnoreCase))
            complications.Add("Date");
        if (text.Contains("Chronograph", StringComparison.OrdinalIgnoreCase))
            complications.Add("Chronograph");
        if (text.Contains("Power reserve", StringComparison.OrdinalIgnoreCase))
            complications.Add("Power reserve indicator");

        if (complications.Count > 0)
        {
            movement.Complications = complications;
        }

        return movement;
    }

    /// <summary>
    /// Parses price string and converts to AUD decimal
    /// Returns formatted string like "$73,200.00" or "Price on request"
    /// </summary>
    private string ParseAndConvertPrice(string priceText, string currency)
    {
        if (string.IsNullOrEmpty(priceText) ||
            priceText.Contains("request", StringComparison.OrdinalIgnoreCase) ||
            priceText.Contains("contact", StringComparison.OrdinalIgnoreCase))
        {
            return "Price on request";
        }

        try
        {
            // Remove currency symbols and extract numeric value
            var numericText = Regex.Replace(priceText, @"[^\d,.]", "");
            numericText = numericText.Replace(",", "");

            if (decimal.TryParse(numericText, out var price))
            {
                // Convert to AUD if needed
                if (currency != "AUD")
                {
                    price = _currencyConverter.ConvertToAUD(price, currency);
                }

                // Format with thousands separator and 2 decimals
                return $"${price:N2}";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error parsing price: {PriceText}", priceText);
        }

        return "Price on request";
    }

    /// <summary>
    /// Fetches page content using Selenium (for JavaScript-heavy sites)
    /// </summary>
    private async Task<string> FetchWithSeleniumAsync(string url, bool expandAccordions = false)
    {
        try
        {
            if (_driver == null)
            {
                InitializeSeleniumDriver();
            }

            _driver!.Navigate().GoToUrl(url);

            // Wait for page to load
            var wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
            wait.Until(d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState").Equals("complete"));

            // Additional wait for dynamic content
            await Task.Delay(3000);

            // For detail pages, expand all accordion sections if needed
            if (expandAccordions)
            {
                try
                {
                    // Find all closed accordion buttons and click them
                    var accordionButtons = _driver.FindElements(By.XPath("//button[contains(@class, 'accordion_trigger__') and @data-state='closed']"));
                    _logger.LogInformation("Found {Count} closed accordion sections", accordionButtons.Count);
                    
                    foreach (var button in accordionButtons)
                    {
                        try
                        {
                            button.Click();
                            await Task.Delay(500); // Wait for accordion to expand
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not click accordion button");
                        }
                    }
                    
                    if (accordionButtons.Count > 0)
                    {
                        _logger.LogInformation("Expanded {Count} accordion sections", accordionButtons.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error expanding accordion sections");
                }
            }

            return _driver.PageSource;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching page with Selenium: {Url}", url);
            return string.Empty;
        }
    }

    /// <summary>
    /// Fetches page content using HttpClient (for static sites)
    /// </summary>
    private async Task<string> FetchWithHttpClientAsync(string url)
    {
        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            return await client.GetStringAsync(url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching page with HttpClient: {Url}", url);
            return string.Empty;
        }
    }

    /// <summary>
    /// Initializes Selenium Chrome WebDriver
    /// </summary>
    private void InitializeSeleniumDriver()
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

            _driver = new ChromeDriver(options);
            _logger.LogInformation("Selenium Chrome WebDriver initialized");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing Selenium WebDriver");
            throw;
        }
    }

    /// <summary>
    /// Cleans and normalizes text
    /// </summary>
    private string CleanText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        text = System.Net.WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    public void Dispose()
    {
        if (_driver != null)
        {
            try
            {
                _driver.Quit();
                _driver.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing Selenium WebDriver");
            }
            finally
            {
                _driver = null;
            }
        }
    }
}

/// <summary>
/// Helper class for storing product card information
/// </summary>
internal class ProductCardInfo
{
    public string DetailUrl { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public string CollectionName { get; set; } = string.Empty;
    public string CaseMaterial { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}
