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
    private readonly ICloudinaryService _cloudinaryService;
    private readonly Dictionary<string, BrandScraperConfig> _brandConfigs;
    private IWebDriver? _driver;

    public BrandScraperService(
        ILogger<BrandScraperService> logger,
        CurrencyConverter currencyConverter,
        ICloudinaryService cloudinaryService)
    {
        _logger = logger;
        _currencyConverter = currencyConverter;
        _cloudinaryService = cloudinaryService;
        _brandConfigs = new Dictionary<string, BrandScraperConfig>();

        // Load brand configurations from JSON file
        LoadBrandConfigs();
    }

    /// Load configurations from JSON file
    private void LoadBrandConfigs()
    {
        try
        {
            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Configuration", "brand-configs.json");
            
            // Fallback to source directory if running in development and file not copied to output
            if (!File.Exists(configPath))
            {
                configPath = Path.Combine(Directory.GetCurrentDirectory(), "Configuration", "brand-configs.json");
            }

            if (!File.Exists(configPath))
            {
                _logger.LogError("Brand configuration file not found at {Path}", configPath);
                return;
            }

            var json = File.ReadAllText(configPath);
            var configs = JsonSerializer.Deserialize<List<BrandScraperConfig>>(json);

            if (configs != null)
            {
                foreach (var config in configs)
                {
                    _brandConfigs[config.BrandName] = config;
                }

                // ASCII-friendly aliases
                if (_brandConfigs.ContainsKey("Jaeger-LeCoultre"))
                {
                    _brandConfigs["Jaeger LeCoultre"] = _brandConfigs["Jaeger-LeCoultre"];
                }
                if (_brandConfigs.ContainsKey("A. Lange & Söhne"))
                {
                    _brandConfigs["A. Lange & Sohne"] = _brandConfigs["A. Lange & Söhne"];
                    _brandConfigs["A. Lange and Sohne"] = _brandConfigs["A. Lange & Söhne"];
                }

                _logger.LogInformation("Loaded {Count} brand configurations", configs.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading brand configurations");
        }
    }

    /// Scrapes watches for a specific brand and collection
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

            foreach (var card in productCards)
            {
                if (count >= maxWatches) break;

                // JLC Filter: strict filtering to avoid mismatched collections
                if (config.BrandName == "Jaeger-LeCoultre" && 
                    !string.IsNullOrEmpty(collectionName) && 
                    !string.IsNullOrEmpty(card.CollectionName))
                {
                    // Check both directions: "Master" matches "Master Ultra Thin" and vice versa
                    var cardMatch = card.CollectionName.IndexOf(collectionName, StringComparison.OrdinalIgnoreCase) >= 0;
                    var reqMatch = collectionName.IndexOf(card.CollectionName, StringComparison.OrdinalIgnoreCase) >= 0;
                    
                    if (!cardMatch && !reqMatch)
                    {
                        _logger.LogInformation("Skipping JLC watch {Ref}: Collection mismatch ('{CardColl}' vs '{ReqColl}')", 
                             card.ReferenceNumber, card.CollectionName, collectionName);
                        continue;
                    }
                }

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

    /// Parses product cards from listing page HTML
    /// Returns list of detail page URLs and basic info
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
                    detailUrl = ResolveDetailLink(cardNode, config.ProductCard.DetailPageLink);
                }
                if (string.IsNullOrEmpty(detailUrl))
                {
                    continue;
                }

                if (!detailUrl.StartsWith("http"))
                {
                    detailUrl = config.BaseUrl + detailUrl;
                }

                // Extract reference number from card (if available)
                var referenceNumber = string.Empty;
                if (!string.IsNullOrEmpty(config.ProductCard.ReferenceNumber))
                {
                    // Handle attribute selectors (e.g., @itemid for JLC)
                    if (config.ProductCard.ReferenceNumber.StartsWith("@"))
                    {
                        var attributeName = config.ProductCard.ReferenceNumber.TrimStart('@');
                        referenceNumber = cardNode.GetAttributeValue(attributeName, string.Empty);
                    }
                    else
                    {
                        var refNode = cardNode.SelectSingleNode(config.ProductCard.ReferenceNumber);
                        referenceNumber = refNode?.InnerText?.Trim() ?? string.Empty;
                    }
                }

                // Extract collection name from card
                var collectionName = string.Empty;
                if (!string.IsNullOrEmpty(config.ProductCard.CollectionName))
                {
                    // Handle attribute selectors (e.g., @collection for JLC)
                    if (config.ProductCard.CollectionName.StartsWith("@"))
                    {
                        var attributeName = config.ProductCard.CollectionName.TrimStart('@');
                        collectionName = cardNode.GetAttributeValue(attributeName, string.Empty);
                    }
                    else
                    {
                        var collectionNode = cardNode.SelectSingleNode(config.ProductCard.CollectionName);
                        collectionName = collectionNode?.InnerText?.Trim() ?? string.Empty;
                    }
                }
                
                // Parse collection name for JLC (e.g., "Reverso Tribute" -> "Reverso")
                if (config.BrandName == "Jaeger-LeCoultre" && !string.IsNullOrEmpty(collectionName))
                {
                    var parts = collectionName.Split(' ');
                    if (parts.Length > 0)
                    {
                        collectionName = parts[0];
                    }
                }

                // Extract material from card
                var material = string.Empty;
                if (!string.IsNullOrEmpty(config.ProductCard.CaseMaterial))
                {
                    var materialNode = cardNode.SelectSingleNode(config.ProductCard.CaseMaterial);
                    material = materialNode?.InnerText?.Trim() ?? string.Empty;
                }

                // Extract image URL
                var imageUrl = string.Empty;
                if (!string.IsNullOrEmpty(config.ProductCard.Image))
                {
                    var imageNode = cardNode.SelectSingleNode(config.ProductCard.Image);
                    if (imageNode != null)
                    {
                        imageUrl = ExtractImageUrl(imageNode, config.BaseUrl);
                    }
                }

                // Note: JLC watch cards don't have collection names in HTML - we extract from detail page
                // Only skip cards that are clearly not watches (straps, accessories)
                if (config.BrandName == "Jaeger-LeCoultre")
                {
                    // Skip straps/accessories (they have collection names like "Fagliano Collection", "Rubber", etc.)
                    if (!string.IsNullOrEmpty(collectionName) && 
                        (collectionName.Contains("Collection", StringComparison.OrdinalIgnoreCase) ||
                         collectionName.Contains("Leather", StringComparison.OrdinalIgnoreCase) ||
                         collectionName.Contains("Rubber", StringComparison.OrdinalIgnoreCase)))
                    {
                        _logger.LogInformation("Skipping JLC accessory: {Collection} - {Url}", collectionName, detailUrl);
                        continue;
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

    private string ResolveDetailLink(HtmlNode cardNode, string detailPageLinkSelector)
    {
        if (string.IsNullOrEmpty(detailPageLinkSelector))
        {
            return string.Empty;
        }

        try
        {
            if (detailPageLinkSelector.StartsWith("@"))
            {
                var attributeName = detailPageLinkSelector.TrimStart('@');
                return cardNode.GetAttributeValue(attributeName, string.Empty);
            }

            var detailNode = cardNode.SelectSingleNode(detailPageLinkSelector);
            if (detailNode == null)
            {
                return string.Empty;
            }

            var href = detailNode.GetAttributeValue("href", string.Empty);
            if (!string.IsNullOrEmpty(href))
            {
                return href.Trim();
            }

            var src = detailNode.GetAttributeValue("src", string.Empty);
            if (!string.IsNullOrEmpty(src))
            {
                return src.Trim();
            }

            return detailNode.InnerText.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve detail link for node");
            return string.Empty;
        }
    }

    /// Scrapes detailed information from a watch's detail page
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
            var referenceNumber = string.Empty;
            
            // Priority 1: Extract from URL for JLC (pattern: -q389848j -> Q389848J)
            if (config.BrandName == "Jaeger-LeCoultre" && !string.IsNullOrEmpty(cardInfo.DetailUrl))
            {
                var urlMatch = Regex.Match(cardInfo.DetailUrl, @"-(q[a-z0-9]+)", RegexOptions.IgnoreCase);
                if (urlMatch.Success)
                {
                    referenceNumber = urlMatch.Groups[1].Value.ToUpper();
                }
            }
            
            // Priority 2: Try XPath selector if URL extraction failed
            if (string.IsNullOrEmpty(referenceNumber) && !string.IsNullOrEmpty(config.DetailPage.ReferenceNumber))
            {
                HtmlNode? refNode = null;
                
                // Handle attribute selectors (e.g., /@data-product-reference for JLC)
                if (config.DetailPage.ReferenceNumber.Contains("/@"))
                {
                    var parts = config.DetailPage.ReferenceNumber.Split(new[] { "/@" }, StringSplitOptions.None);
                    if (parts.Length == 2)
                    {
                        var xpath = parts[0];
                        var attributeName = parts[1];
                        refNode = doc.DocumentNode.SelectSingleNode(xpath);
                        if (refNode != null)
                        {
                            referenceNumber = refNode.GetAttributeValue(attributeName, string.Empty);
                        }
                    }
                }
                else
                {
                    refNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.ReferenceNumber);
                    if (refNode != null)
                    {
                        referenceNumber = refNode.InnerText?.Trim() ?? string.Empty;
                    }
                }
            }
            
            referenceNumber = referenceNumber ?? cardInfo.ReferenceNumber;
            referenceNumber = CleanText(referenceNumber);
            // Extract just the reference part (before dimensions like "42.5 mm Titanium")
            referenceNumber = ExtractReferenceNumber(referenceNumber);

            // Extract collection name (use card info as fallback)
            HtmlNode? collectionNode = null;
            if (!string.IsNullOrEmpty(config.DetailPage.CollectionName))
            {
                collectionNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.CollectionName);
            }
            var collectionName = collectionNode?.InnerText?.Trim() ?? cardInfo.CollectionName;
            collectionName = CleanText(collectionName);
            
            // Parse collection name for JLC - match against known collections
            // Map variants (with/without accents) to canonical database names
            if (config.BrandName == "Jaeger-LeCoultre")
            {
                _logger.LogInformation("JLC Collection Parse - Detail: '{Detail}', Card: '{Card}'", collectionName, cardInfo.CollectionName);

                // Canonical names matching the database (collections.csv)
                var collectionMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Master Ultra Thin", "Master Ultra Thin" },
                    { "Master", "Master Ultra Thin" },  // Partial match fallback
                    { "Reverso", "Reverso" },
                    { "Polaris", "Polaris" },
                    { "Duomètre", "Duomètre" },  // With accent (database canonical)
                    { "Duometre", "Duomètre" },  // Without accent -> maps to accented version
                    { "Duometre Chronograph", "Duomètre" }
                };
                
                // Try to find a matching collection
                string? matchedCollection = null;
                var searchTexts = new[] { collectionName, cardInfo.CollectionName };
                
                foreach (var searchText in searchTexts)
                {
                    if (string.IsNullOrEmpty(searchText)) continue;
                    
                    // Try exact key match first
                    foreach (var mapping in collectionMappings)
                    {
                        if (searchText.IndexOf(mapping.Key, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            matchedCollection = mapping.Value;
                            _logger.LogInformation("JLC Collection matched: '{Search}' -> '{Canonical}'", searchText, matchedCollection);
                            break;
                        }
                    }
                    if (matchedCollection != null) break;
                }

                if (matchedCollection != null)
                {
                    collectionName = matchedCollection;
                }
                else if (!string.IsNullOrEmpty(collectionName))
                {
                    // Fallback: if no known collection matches, log warning
                    _logger.LogWarning("JLC Collection not matched: '{Collection}' - using as-is", collectionName);
                }
            }

            // Extract price
            HtmlNode? priceNode = null;
            if (!string.IsNullOrEmpty(config.DetailPage.Price))
            {
                priceNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.Price);
            }
            var priceText = priceNode?.InnerText?.Trim() ?? "Price on request";
            _logger.LogInformation("Raw price text extracted: '{PriceText}' for {Reference}", priceText, referenceNumber);
            var price = ParseAndConvertPrice(priceText, config.Currency);

            _logger.LogInformation("Extracted price for {Reference}: {Price}", referenceNumber, price);

            // Extract image URL from detail page (if available, otherwise use card image)
            var imageUrl = cardInfo.ImageUrl;
            if (!string.IsNullOrEmpty(config.DetailPage.Image))
            {
                var imageNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.Image);
                if (imageNode != null)
                {
                    var extractedUrl = ExtractImageUrl(imageNode, config.BaseUrl);
                    if (!string.IsNullOrEmpty(extractedUrl))
                    {
                        imageUrl = extractedUrl;
                        _logger.LogInformation("Using detail page image: {Url}", imageUrl);
                    }
                }
                else if (string.IsNullOrEmpty(cardInfo.ImageUrl))
                {
                    _logger.LogWarning("No image found on card or detail page for: {Url}", cardInfo.DetailUrl);
                }
            }

            // Download external images locally to avoid Cloudinary Fetch timeouts
            // Store just the filename in the database (like showcase watches do)
            if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith("http"))
            {
                var downloadedFilename = await DownloadImageLocallyAsync(imageUrl, config.BrandName, referenceNumber);
                if (!string.IsNullOrEmpty(downloadedFilename))
                {
                    imageUrl = downloadedFilename;
                    _logger.LogInformation("Downloaded image locally: {Filename}", downloadedFilename);
                }
            }

            // For JLC, images are REQUIRED - skip if both card and detail page failed
            if (config.BrandName == "Jaeger-LeCoultre" && string.IsNullOrEmpty(imageUrl))
            {
                _logger.LogWarning("Skipping JLC watch (no image after card + detail page): Ref={Ref}, URL={Url}", 
                    referenceNumber, cardInfo.DetailUrl);
                return null; // This will skip the watch
            }

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
                ImageUrl = imageUrl,
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

    /// Extracts structured specs from detail page with flexible additional specs capture
    private WatchSpecs ExtractSpecs(HtmlDocument doc, BrandScraperConfig config)
    {
        var specs = new WatchSpecs();

        try
        {
            // Extract standard specs using configured selectors
            // Extract Dial specs
            if (!string.IsNullOrEmpty(config.DetailPage.DialSpecs))
            {
                var dialNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.DialSpecs);
                if (dialNode != null)
                {
                    specs.Dial = ParseDialSpecs(dialNode.InnerText);
                    _logger.LogInformation("Extracted Dial specs");
                }
            }

            // Extract Case specs
            if (!string.IsNullOrEmpty(config.DetailPage.CaseSpecs))
            {
                var caseNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.CaseSpecs);
                if (caseNode != null)
                {
                    specs.Case = ParseCaseSpecs(caseNode.InnerText);
                    _logger.LogInformation("Extracted Case specs");
                }
            }

            // Extract Strap specs
            if (!string.IsNullOrEmpty(config.DetailPage.StrapSpecs))
            {
                var strapNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.StrapSpecs);
                if (strapNode != null)
                {
                    specs.Strap = ParseStrapSpecs(strapNode.InnerText);
                    _logger.LogInformation("Extracted Strap specs");
                }
            }

            // Extract Movement specs
            if (!string.IsNullOrEmpty(config.DetailPage.MovementSpecs))
            {
                var movementNode = doc.DocumentNode.SelectSingleNode(config.DetailPage.MovementSpecs);
                if (movementNode != null)
                {
                    specs.Movement = ParseMovementSpecs(movementNode.InnerText);
                    _logger.LogInformation("Extracted Movement specs");
                }
            }

            // Extract additional brand-specific specs (VC's recto/verso, brand-specific features, etc.)
            var additionalSpecs = ExtractAdditionalSpecs(doc, config);
            if (additionalSpecs != null && additionalSpecs.Count > 0)
            {
                specs.Additional = additionalSpecs;
                _logger.LogInformation("Extracted {Count} additional spec sections", additionalSpecs.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extracting specs");
        }

        return specs;
    }

    /// Extracts additional brand-specific specs not covered by standard categories
    private Dictionary<string, string>? ExtractAdditionalSpecs(HtmlDocument doc, BrandScraperConfig config)
    {
        var additional = new Dictionary<string, string>();

        try
        {
            // Look for common patterns: accordion sections, detail panels, feature sections
            // Pattern 1: VC/JLC style - sections with titles and content
            var sectionTitles = doc.DocumentNode.SelectNodes("//div[contains(@class, 'technical-details')]//div[contains(@class, 'block-title') or contains(@class, 'detail-title')]");
            if (sectionTitles != null)
            {
                foreach (var titleNode in sectionTitles)
                {
                    var title = CleanText(titleNode.InnerText);
                    
                    // Skip already captured standard sections
                    if (title.Contains("Dial", StringComparison.OrdinalIgnoreCase) ||
                        title.Contains("Case", StringComparison.OrdinalIgnoreCase) ||
                        title.Contains("Strap", StringComparison.OrdinalIgnoreCase) ||
                        title.Contains("Movement", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // Get content (typically in following sibling)
                    var contentNode = titleNode.SelectSingleNode("./following-sibling::*[1]");
                    if (contentNode != null)
                    {
                        var content = CleanText(contentNode.InnerText);
                        if (!string.IsNullOrEmpty(content) && content.Length > 3)
                        {
                            additional[title] = content;
                        }
                    }
                }
            }

            // Pattern 2: AP style - accordion tabs with IDs
            var accordionTabs = doc.DocumentNode.SelectNodes("//div[starts-with(@id, 'product-accordion-tab-')]");
            if (accordionTabs != null)
            {
                foreach (var tab in accordionTabs)
                {
                    var tabId = tab.GetAttributeValue("id", string.Empty);
                    
                    // Skip already processed standard sections
                    if (tabId.Contains("dial", StringComparison.OrdinalIgnoreCase) ||
                        tabId.Contains("case", StringComparison.OrdinalIgnoreCase) ||
                        tabId.Contains("strap", StringComparison.OrdinalIgnoreCase) ||
                        tabId.Contains("movement", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // Extract readable name from ID
                    var sectionName = tabId.Replace("product-accordion-tab-", "")
                        .Replace("-", " ")
                        .Replace("_", " ");
                    
                    // Capitalize first letter of each word
                    sectionName = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(sectionName);

                    var content = CleanText(tab.InnerText);
                    if (!string.IsNullOrEmpty(content) && content.Length > 3)
                    {
                        additional[sectionName] = content;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extracting additional specs");
        }

        return additional.Count > 0 ? additional : null;
    }

    /// Parses dial specifications from text
    private DialSpecs ParseDialSpecs(string text)
    {
        var dial = new DialSpecs { Description = CleanText(text) };

        // Extract color (common patterns - expanded list)
        var colorMatch = Regex.Match(text, @"(sunburst\s+brown|black|white|blue|silver|grey|gray|champagne|salmon|brown|green|red|charcoal|slate)", RegexOptions.IgnoreCase);
        if (colorMatch.Success)
        {
            dial.Color = colorMatch.Groups[1].Value;
        }

        // Extract markers
        var markersMatch = Regex.Match(text, @"(?:hour markers?|indices)[:\s]*([^\n]+)", RegexOptions.IgnoreCase);
        if (markersMatch.Success)
        {
            dial.Markers = markersMatch.Groups[1].Value.Trim();
        }

        // Extract hands
        var handsMatch = Regex.Match(text, @"(?:hands?)[:\s]*([^\n]+)", RegexOptions.IgnoreCase);
        if (handsMatch.Success)
        {
            dial.Hands = handsMatch.Groups[1].Value.Trim();
        }

        return dial;
    }

    /// Parses case specifications from text
    /// Handles both generic format and AP's detailed list format
    private CaseSpecs ParseCaseSpecs(string text)
    {
        var caseSpecs = new CaseSpecs();

        // Extract material (multiple patterns)
        var materialMatch = Regex.Match(text, @"(white gold|yellow gold|rose gold|platinum|stainless steel|titanium|ceramic|gold)", RegexOptions.IgnoreCase);
        if (materialMatch.Success)
        {
            caseSpecs.Material = materialMatch.Groups[1].Value;
        }

        // Extract diameter (multiple patterns)
        var diameterMatch = Regex.Match(text, @"(?:Size|Diameter)[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
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

        // Extract water resistance (multiple patterns)
        // Pattern 1: "Water Resistance 20 m" or "Water resistance to 30m"
        var waterMatch = Regex.Match(text, @"Water[- ](?:Resistance|resistant)[:\s]+(?:to\s+)?(\d+\s*(?:m|meters|ATM|atm))", RegexOptions.IgnoreCase);
        if (waterMatch.Success)
        {
            caseSpecs.WaterResistance = waterMatch.Groups[1].Value;
        }

        // Extract crystal
        if (text.Contains("Sapphire", StringComparison.OrdinalIgnoreCase))
        {
            caseSpecs.Crystal = "Sapphire";
        }

        // Extract case back
        var caseBackMatch = Regex.Match(text, @"Case back[:\s]+([^\n]+)", RegexOptions.IgnoreCase);
        if (caseBackMatch.Success)
        {
            caseSpecs.CaseBack = caseBackMatch.Groups[1].Value.Trim();
        }

        return caseSpecs;
    }

    /// Parses strap/bracelet specifications from text
    /// Handles leather, rubber, and metal bracelet descriptions
    private StrapSpecs ParseStrapSpecs(string text)
    {
        var strap = new StrapSpecs();

        // Extract material (expanded list for AP and other brands)
        var materialMatch = Regex.Match(text, @"(Alligator leather|Calfskin|Rubber|Stainless steel bracelet|ceramic bracelet|white gold bracelet|yellow gold bracelet|rose gold bracelet|black ceramic bracelet)", RegexOptions.IgnoreCase);
        if (materialMatch.Success)
        {
            strap.Material = materialMatch.Groups[1].Value;
        }
        else
        {
            // Fallback: try simpler patterns
            if (text.Contains("ceramic", StringComparison.OrdinalIgnoreCase))
                strap.Material = "Ceramic bracelet";
            else if (text.Contains("leather", StringComparison.OrdinalIgnoreCase))
                strap.Material = "Leather strap";
            else if (text.Contains("rubber", StringComparison.OrdinalIgnoreCase))
                strap.Material = "Rubber strap";
            else if (text.Contains("bracelet", StringComparison.OrdinalIgnoreCase))
                strap.Material = "Metal bracelet";
        }

        // Extract color
        var colorMatch = Regex.Match(text, @"(black|brown|blue|navy|beige|tan|white|grey|gray|red|green)", RegexOptions.IgnoreCase);
        if (colorMatch.Success)
        {
            strap.Color = colorMatch.Groups[1].Value;
        }

        // Extract buckle/clasp
        var buckleMatch = Regex.Match(text, @"(?:clasp|buckle|prong)[:\s]*([^\n]+)", RegexOptions.IgnoreCase);
        if (buckleMatch.Success)
        {
            strap.Buckle = buckleMatch.Groups[1].Value.Trim();
        }
        else
        {
            // Fallback: look for material + clasp pattern
            var fallbackMatch = Regex.Match(text, @"(white gold|yellow gold|rose gold|platinum|steel|gold).*?(buckle|clasp|prong)", RegexOptions.IgnoreCase);
            if (fallbackMatch.Success)
            {
                strap.Buckle = fallbackMatch.Value;
            }
        }

        return strap;
    }

    /// Parses movement specifications from text
    /// Handles both generic text format and AP's detailed list-based specs
    private MovementSpecs ParseMovementSpecs(string text)
    {
        var movement = new MovementSpecs();

        // Extract caliber (multiple patterns for different brands)
        // Pattern 1: "Calibre 2885" or "Calibre 26-330"
        var caliberMatch = Regex.Match(text, @"Calibre[:\s]+([A-Z0-9\-\.]+)", RegexOptions.IgnoreCase);
        if (caliberMatch.Success)
        {
            movement.Caliber = caliberMatch.Groups[1].Value.Trim();
        }
        // Pattern 2: Generic number-letter pattern (fallback)
        else
        {
            var genericMatch = Regex.Match(text, @"^(?:Calibre\s+)?(\d+[-\s]*\w+[-\s]*\w*)", RegexOptions.IgnoreCase);
            if (genericMatch.Success)
            {
                movement.Caliber = genericMatch.Groups[1].Value.Trim();
            }
        }

        // Extract mechanism/type
        if (text.Contains("Self-winding", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("Selfwinding", StringComparison.OrdinalIgnoreCase) ||
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

        // Extract diameter (movement diameter)
        var diameterMatch = Regex.Match(text, @"Total diameter[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        if (!diameterMatch.Success)
        {
            diameterMatch = Regex.Match(text, @"Diameter[:\s]+(\d+(?:\.\d+)?\s*mm)", RegexOptions.IgnoreCase);
        }
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
        var powerMatch = Regex.Match(text, @"Power reserve[:\s]+([^\n]+?)(?:Number of|$)", RegexOptions.IgnoreCase);
        if (powerMatch.Success)
        {
            movement.PowerReserve = powerMatch.Groups[1].Value.Trim();
        }

        // Extract frequency (multiple patterns)
        // Pattern 1: "28,800 semi-oscillations/hour (4 Hz)" or "2.75 hz 19800 vph"
        var frequencyMatch = Regex.Match(text, @"Frequency[:\s]+([^\n]+?)(?:Total diameter|$)", RegexOptions.IgnoreCase);
        if (!frequencyMatch.Success)
        {
            frequencyMatch = Regex.Match(text, @"(\d+[,\d]+\s*(?:semi-oscillations|vibrations|vph).*?(?:\d+(?:\.\d+)?\s*H?z)?)", RegexOptions.IgnoreCase);
        }
        if (frequencyMatch.Success)
        {
            movement.Frequency = frequencyMatch.Groups[1].Value.Trim();
        }

        // Extract functions/complications (AP uses "Functions" in specs)
        var functionsMatch = Regex.Match(text, @"Functions[:\s]+([^\n]+?)(?:Number of jewels|Mechanism|$)", RegexOptions.IgnoreCase);
        if (functionsMatch.Success)
        {
            var functionsText = functionsMatch.Groups[1].Value.Trim();
            var functions = functionsText.Split(',')
                .Select(f => f.Trim())
                .Where(f => !string.IsNullOrEmpty(f))
                .ToList();

            if (functions.Count > 0)
            {
                movement.Complications = functions;
            }
        }

        // Fallback: extract common complications from text
        if (movement.Complications == null || movement.Complications.Count == 0)
        {
            var complications = new List<string>();
            if (text.Contains("Date", StringComparison.OrdinalIgnoreCase))
                complications.Add("Date");
            if (text.Contains("Chronograph", StringComparison.OrdinalIgnoreCase))
                complications.Add("Chronograph");
            if (text.Contains("Power reserve", StringComparison.OrdinalIgnoreCase))
                complications.Add("Power reserve indicator");
            if (text.Contains("Perpetual calendar", StringComparison.OrdinalIgnoreCase))
                complications.Add("Perpetual calendar");
            if (text.Contains("Minute repeater", StringComparison.OrdinalIgnoreCase))
                complications.Add("Minute repeater");
            if (text.Contains("Tourbillon", StringComparison.OrdinalIgnoreCase))
                complications.Add("Tourbillon");

            if (complications.Count > 0)
            {
                movement.Complications = complications;
            }
        }

        return movement;
    }

    /// Parses price string and converts to AUD decimal
    /// Returns formatted string like "$73,200.00" or "Price on request"
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

    /// Fetches page content using Selenium (for JavaScript-heavy sites)
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
            wait.Until(d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState")?.ToString() == "complete");

            // Additional wait for dynamic content
            await Task.Delay(3000);

            // Dismiss cookie dialogs if present (before interacting with page)
            try
            {
                // Try multiple common cookie dialog selectors
                var cookieSelectors = new[]
                {
                    "//button[@id='CybotCookiebotDialogBodyButtonAccept']", // Cookiebot Accept button
                    "//button[@id='CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll']", // Cookiebot Allow All
                    "//button[contains(@class, 'cookie') and contains(text(), 'Accept')]", // Generic cookie accept
                    "//button[contains(@class, 'cookie') and contains(text(), 'Allow')]", // Generic cookie allow
                    "//a[@id='CybotCookiebotDialogBodyButtonDecline']" // Cookiebot Decline
                };

                foreach (var selector in cookieSelectors)
                {
                    try
                    {
                        var cookieButton = _driver.FindElements(By.XPath(selector));
                        if (cookieButton.Count > 0 && cookieButton[0].Displayed)
                        {
                            cookieButton[0].Click();
                            await Task.Delay(1000); // Wait for dialog to close
                            _logger.LogInformation("Dismissed cookie dialog using selector: {Selector}", selector);
                            break; // Exit after first successful dismissal
                        }
                    }
                    catch (Exception)
                    {
                        // Continue to next selector
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not dismiss cookie dialog (non-fatal)");
            }

            // For detail pages, expand all accordion sections if needed
            if (expandAccordions)
            {
                try
                {
                    // Try to click VC tabs (Caliber tab) if present
                    try
                    {
                        var caliberTab = _driver.FindElements(By.XPath("//button[@id='vac-tab-1' or contains(@class, 'vac-tabs__tab')][@aria-selected='false']"));
                        if (caliberTab.Count > 0)
                        {
                            caliberTab[0].Click();
                            await Task.Delay(500);
                            _logger.LogInformation("Clicked Caliber tab for VC");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not click Caliber tab");
                    }

                    // Find all closed accordion buttons and click them (for Patek Philippe)
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

    /// Fetches page content using HttpClient (for static sites)
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

    /// Initializes Selenium Chrome WebDriver
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

    /// Cleans and normalizes text
    private string CleanText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        text = System.Net.WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    /// Extracts reference number from full text (removes dimensions like "42.5 mm Titanium")
    /// Examples:
    ///   "6000V/210T-H032 42.5 mm Titanium" -> "6000V/210T-H032"
    ///   "1410U/000G-H017 39 mm White Gold" -> "1410U/000G-H017"
    ///   "Ref. 26238CE.OO.1300CE.02" -> "26238CE.OO.1300CE.02"
    private string ExtractReferenceNumber(string fullText)
    {
        if (string.IsNullOrEmpty(fullText))
            return string.Empty;

        // Strip "Ref. " prefix (common in AP and other brands)
        var cleanedText = fullText.Trim();
        if (cleanedText.StartsWith("Ref.", StringComparison.OrdinalIgnoreCase))
        {
            cleanedText = cleanedText.Substring(4).Trim();
        }

        // Strip "mixed-grid-product-" prefix (JLC/ALS itemid format)
        if (cleanedText.StartsWith("mixed-grid-product-", StringComparison.OrdinalIgnoreCase))
        {
            cleanedText = cleanedText.Substring("mixed-grid-product-".Length).Trim();
        }

        // Match JLC pattern (Q followed by alphanumeric: Q389848J, Q389257J)
        var jlcMatch = Regex.Match(cleanedText, @"^(Q[A-Z0-9]+)", RegexOptions.IgnoreCase);
        if (jlcMatch.Success)
        {
            return jlcMatch.Groups[1].Value.ToUpper();
        }

        // Match reference number pattern with dots (for AP: 26238CE.OO.1300CE.02)
        // Examples: 26238CE.OO.1300CE.02, 26470ER.OO.1220ER.01
        var dotMatch = Regex.Match(cleanedText, @"^([A-Z0-9]+(?:\.[A-Z0-9]+)*(?:-[A-Z0-9]+)?)");
        if (dotMatch.Success && !cleanedText.Contains("mm"))
        {
            return dotMatch.Groups[1].Value;
        }

        // Match reference number pattern (alphanumeric with slashes, hyphens for VC/Patek)
        // Examples: 6000V/210T-H032, 1410U/000G-H017, 5500V/12A-B145
        var match = Regex.Match(cleanedText, @"^([A-Z0-9]+/[A-Z0-9]+-[A-Z0-9]+)");
        if (match.Success)
        {
            return match.Groups[1].Value;
        }

        // Fallback: return the part before the first digit followed by "mm"
        var dimMatch = Regex.Match(cleanedText, @"^(.*?)\s+\d+\s*mm");
        if (dimMatch.Success)
        {
            return dimMatch.Groups[1].Value.Trim();
        }

        // If no pattern matches, return cleaned text (with Ref. removed)
        return cleanedText;
    }

    /// Extracts image URL from an HTML node, handling lazy-loading and data URIs
    private string ExtractImageUrl(HtmlNode imageNode, string baseUrl)
    {
        if (imageNode == null)
            return string.Empty;

        // Priority order: data-srcset > data-src > srcset > src
        // Skip data: URIs (inline SVG placeholders)
        
        // 1. Check data-srcset (lazy-loaded responsive images)
        var dataSrcset = imageNode.GetAttributeValue("data-srcset", string.Empty);
        if (!string.IsNullOrEmpty(dataSrcset) && !dataSrcset.StartsWith("data:"))
        {
            var urls = dataSrcset.Split(',');
            if (urls.Length > 0)
            {
                var lastUrl = urls[urls.Length - 1].Trim().Split(' ')[0];
                return lastUrl.StartsWith("http") ? lastUrl : baseUrl + lastUrl;
            }
        }

        // 2. Check data-src (lazy-loaded single image)
        var dataSrc = imageNode.GetAttributeValue("data-src", string.Empty);
        if (!string.IsNullOrEmpty(dataSrc) && !dataSrc.StartsWith("data:"))
        {
            return dataSrc.StartsWith("http") ? dataSrc : baseUrl + dataSrc;
        }

        // 3. Check srcset (responsive images)
        var srcset = imageNode.GetAttributeValue("srcset", string.Empty);
        if (!string.IsNullOrEmpty(srcset) && !srcset.StartsWith("data:"))
        {
            var urls = srcset.Split(',');
            if (urls.Length > 0)
            {
                var lastUrl = urls[urls.Length - 1].Trim().Split(' ')[0];
                return lastUrl.StartsWith("http") ? lastUrl : baseUrl + lastUrl;
            }
        }

        // 4. Check src (standard image)
        var src = imageNode.GetAttributeValue("src", string.Empty);
        if (!string.IsNullOrEmpty(src) && !src.StartsWith("data:"))
        {
            return src.StartsWith("http") ? src : baseUrl + src;
        }

        return string.Empty;
    }

    /// Uploads an image from a URL to Cloudinary CDN
    /// Returns the public_id for database storage
    private async Task<string> DownloadImageLocallyAsync(string imageUrl, string brandName, string referenceNumber)
    {
        if (string.IsNullOrEmpty(imageUrl))
            return string.Empty;

        try
        {
            // Sanitize brand name and reference number for Cloudinary public_id
            var sanitizedRef = Regex.Replace(referenceNumber, @"[^a-zA-Z0-9_\-]", "");
            var sanitizedBrand = Regex.Replace(brandName, @"[^a-zA-Z0-9_\-]", "");
            var publicId = $"{sanitizedBrand}_{sanitizedRef}";

            // Upload to Cloudinary (method name is DownloadImageLocallyAsync for backward compatibility)
            var cloudinaryPublicId = await _cloudinaryService.UploadImageFromUrlAsync(imageUrl, publicId, "watches");

            if (!string.IsNullOrEmpty(cloudinaryPublicId))
            {
                _logger.LogInformation("Uploaded image to Cloudinary: {PublicId}", cloudinaryPublicId);
                return cloudinaryPublicId; // Return public_id (e.g., "watches/PatekPhilippe_5227G010")
            }

            _logger.LogWarning("Failed to upload image to Cloudinary from {Url}", imageUrl);
            return string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error uploading image to Cloudinary from {Url}", imageUrl);
            return string.Empty;
        }
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

/// Helper class for storing product card information
internal class ProductCardInfo
{
    public string DetailUrl { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public string CollectionName { get; set; } = string.Empty;
    public string CaseMaterial { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}
