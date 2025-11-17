// Configuration for brand-specific scraping
// Defines XPath selectors and URL patterns for each luxury watch brand's official website

namespace backend.Models;

/// <summary>
/// XPath selectors for extracting data from product cards on listing pages
/// </summary>
public class ProductCardSelectors
{
    /// <summary>
    /// XPath or CSS selector for the product card container
    /// Example: "a[class*='editorial-card']" or "//div[@class='product-card']"
    /// </summary>
    public string CardContainer { get; set; } = string.Empty;

    /// <summary>
    /// Selector for reference number within the card
    /// Example: "h2[class*='title']" or ".//h2[@class='ref-number']"
    /// </summary>
    public string ReferenceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Selector for collection name within the card
    /// Example: "h3[class*='subtitle']" or ".//h3[@class='collection']"
    /// </summary>
    public string CollectionName { get; set; } = string.Empty;

    /// <summary>
    /// Selector for case material text within the card
    /// Example: "p[class*='material']" or ".//p[@class='case-material']"
    /// </summary>
    public string CaseMaterial { get; set; } = string.Empty;

    /// <summary>
    /// Selector for product image element
    /// Example: "img[class*='product-image']" or ".//img[@class='watch-img']"
    /// </summary>
    public string Image { get; set; } = string.Empty;

    /// <summary>
    /// Selector for detail page link within the card
    /// Example: "a[href]" or ".//a[@class='product-link']"
    /// </summary>
    public string DetailPageLink { get; set; } = string.Empty;
}

/// <summary>
/// XPath selectors for extracting data from watch detail pages
/// </summary>
public class DetailPageSelectors
{
    /// <summary>
    /// Selector for price element on detail page
    /// Example: "div[class*='product-price'] p" or "//div[@class='price']/p"
    /// </summary>
    public string Price { get; set; } = string.Empty;

    /// <summary>
    /// Selector for dial specifications section
    /// Example: "div[data-accordion='dial']" or "//div[@class='dial-specs']"
    /// </summary>
    public string DialSpecs { get; set; } = string.Empty;

    /// <summary>
    /// Selector for case specifications section
    /// Example: "div[data-accordion='case']" or "//div[@class='case-specs']"
    /// </summary>
    public string CaseSpecs { get; set; } = string.Empty;

    /// <summary>
    /// Selector for strap/bracelet specifications section
    /// Example: "div[data-accordion='strap']" or "//div[@class='strap-specs']"
    /// </summary>
    public string StrapSpecs { get; set; } = string.Empty;

    /// <summary>
    /// Selector for movement specifications section
    /// Example: "div[data-accordion='movement']" or "//div[@class='movement-specs']"
    /// </summary>
    public string MovementSpecs { get; set; } = string.Empty;

    /// <summary>
    /// Selector for reference number on detail page (fallback)
    /// Example: "h2[class*='title']" or "//h2[@class='ref-number']"
    /// </summary>
    public string ReferenceNumber { get; set; } = string.Empty;

    /// <summary>
    /// Selector for collection name on detail page (fallback)
    /// Example: "h3[class*='subtitle']" or "//h3[@class='collection']"
    /// </summary>
    public string CollectionName { get; set; } = string.Empty;

    /// <summary>
    /// Selector for product image on detail page
    /// Example: "img[class*='product-image']" or "//img[@class='watch-img']"
    /// </summary>
    public string Image { get; set; } = string.Empty;
}

/// <summary>
/// Complete configuration for scraping a luxury watch brand's official website
/// </summary>
public class BrandScraperConfig
{
    /// <summary>
    /// Brand name (must match Brand.Name in database)
    /// Example: "Patek Philippe", "Vacheron Constantin", "Audemars Piguet"
    /// </summary>
    public string BrandName { get; set; } = string.Empty;

    /// <summary>
    /// Base URL for the brand's website
    /// Example: "https://www.patek.com"
    /// </summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// Collection URLs to scrape (collection name -> URL)
    /// Example: {"Calatrava": "/en/collection/calatrava/all-watches"}
    /// </summary>
    public Dictionary<string, string> CollectionUrls { get; set; } = new();

    /// <summary>
    /// Selectors for extracting data from product cards
    /// </summary>
    public ProductCardSelectors ProductCard { get; set; } = new();

    /// <summary>
    /// Selectors for extracting data from detail pages
    /// </summary>
    public DetailPageSelectors DetailPage { get; set; } = new();

    /// <summary>
    /// Whether the site requires JavaScript rendering (Selenium)
    /// If false, uses simple HTTP client
    /// </summary>
    public bool RequiresJavaScript { get; set; } = false;

    /// <summary>
    /// Currency used on the website
    /// Example: "AUD", "USD", "EUR"
    /// </summary>
    public string Currency { get; set; } = "AUD";

    /// <summary>
    /// Delay between requests in milliseconds (for rate limiting)
    /// </summary>
    public int RequestDelayMs { get; set; } = 2000;
}
