// Configuration for brand-specific scraping
// Defines XPath selectors and URL patterns for each luxury watch brand's official website

namespace backend.Models;

/// XPath selectors for extracting data from product cards on listing pages
public class ProductCardSelectors
{
    /// XPath or CSS selector for the product card container
    /// Example: "a[class*='editorial-card']" or "//div[@class='product-card']"
    public string CardContainer { get; set; } = string.Empty;

    /// Selector for reference number within the card
    /// Example: "h2[class*='title']" or ".//h2[@class='ref-number']"
    public string ReferenceNumber { get; set; } = string.Empty;

    /// Selector for collection name within the card
    /// Example: "h3[class*='subtitle']" or ".//h3[@class='collection']"
    public string CollectionName { get; set; } = string.Empty;

    /// Selector for case material text within the card
    /// Example: "p[class*='material']" or ".//p[@class='case-material']"
    public string CaseMaterial { get; set; } = string.Empty;

    /// Selector for product image element
    /// Example: "img[class*='product-image']" or ".//img[@class='watch-img']"
    public string Image { get; set; } = string.Empty;

    /// Selector for detail page link within the card
    /// Example: "a[href]" or ".//a[@class='product-link']"
    public string DetailPageLink { get; set; } = string.Empty;
}

/// XPath selectors for extracting data from watch detail pages
public class DetailPageSelectors
{
    /// Selector for price element on detail page
    /// Example: "div[class*='product-price'] p" or "//div[@class='price']/p"
    public string Price { get; set; } = string.Empty;

    /// Selector for dial specifications section
    /// Example: "div[data-accordion='dial']" or "//div[@class='dial-specs']"
    public string DialSpecs { get; set; } = string.Empty;

    /// Selector for case specifications section
    /// Example: "div[data-accordion='case']" or "//div[@class='case-specs']"
    public string CaseSpecs { get; set; } = string.Empty;

    /// Selector for strap/bracelet specifications section
    /// Example: "div[data-accordion='strap']" or "//div[@class='strap-specs']"
    public string StrapSpecs { get; set; } = string.Empty;

    /// Selector for movement specifications section
    /// Example: "div[data-accordion='movement']" or "//div[@class='movement-specs']"
    public string MovementSpecs { get; set; } = string.Empty;

    /// Selector for reference number on detail page (fallback)
    /// Example: "h2[class*='title']" or "//h2[@class='ref-number']"
    public string ReferenceNumber { get; set; } = string.Empty;

    /// Selector for collection name on detail page (fallback)
    /// Example: "h3[class*='subtitle']" or "//h3[@class='collection']"
    public string CollectionName { get; set; } = string.Empty;

    /// Selector for product image on detail page
    /// Example: "img[class*='product-image']" or "//img[@class='watch-img']"
    public string Image { get; set; } = string.Empty;

    /// Selector for link to final specs page (3-level navigation, e.g., for A. Lange & Söhne)
    /// Example: "//a[@class='cta-button']/@href" - used to navigate from intermediate detail page to final specs page
    public string? SpecsPageLink { get; set; }

    /// Selector for model name (for Watch.Description, e.g., A. Lange & Söhne)
    /// Example: "//h2[@class='model-name']"
    public string? ModelName { get; set; }

    /// Selector for subtitle/variant information (for Watch.Description, e.g., A. Lange & Söhne)
    /// Can be an attribute selector (e.g., "@subtitle") or XPath selector
    /// Example: "@subtitle" or "//div[@class='variant-info']"
    public string? Subtitle { get; set; }
}

/// Complete configuration for scraping a luxury watch brand's official website
public class BrandScraperConfig
{
    /// Brand name (must match Brand.Name in database)
    /// Example: "Patek Philippe", "Vacheron Constantin", "Audemars Piguet"
    public string BrandName { get; set; } = string.Empty;

    /// Base URL for the brand's website
    /// Example: "https://www.patek.com"
    public string BaseUrl { get; set; } = string.Empty;

    /// Collection URLs to scrape (collection name -> URL)
    /// Example: {"Calatrava": "/en/collection/calatrava/all-watches"}
    public Dictionary<string, string> CollectionUrls { get; set; } = new();

    /// Selectors for extracting data from product cards
    public ProductCardSelectors ProductCard { get; set; } = new();

    /// Selectors for extracting data from detail pages
    public DetailPageSelectors DetailPage { get; set; } = new();

    /// Whether the site requires JavaScript rendering (Selenium)
    /// If false, uses simple HTTP client
    public bool RequiresJavaScript { get; set; } = false;

    /// Currency used on the website
    /// Example: "AUD", "USD", "EUR"
    public string Currency { get; set; } = "AUD";

    /// Delay between requests in milliseconds (for rate limiting)
    public int RequestDelayMs { get; set; } = 2000;
}
