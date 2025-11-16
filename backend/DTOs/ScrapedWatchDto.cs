// Data Transfer Object for scraped watch data from Chrono24
// Holds watch information before database insertion

namespace backend.DTOs;

public class ScrapedWatchDto
{
    /// <summary>
    /// Watch name or model (e.g., "Submariner Date", "Speedmaster Professional")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Brand name (e.g., "Rolex", "Omega", "Patek Philippe")
    /// </summary>
    public string BrandName { get; set; } = string.Empty;

    /// <summary>
    /// Collection name (e.g., "Submariner", "Speedmaster", "Nautilus")
    /// </summary>
    public string CollectionName { get; set; } = string.Empty;

    /// <summary>
    /// Current price as string (e.g., "84,000" or "Price on request")
    /// </summary>
    public string CurrentPrice { get; set; } = string.Empty;

    /// <summary>
    /// Detailed watch description (2-3 paragraphs of history and characteristics)
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Technical specifications formatted as key-value pairs
    /// Format: "Movement: [details]; Case: [details]; Dial: [details]; etc."
    /// </summary>
    public string Specs { get; set; } = string.Empty;

    /// <summary>
    /// Primary image URL from Chrono24
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// Reference number if available (e.g., "116610LN", "5711/1A")
    /// </summary>
    public string? ReferenceNumber { get; set; }

    /// <summary>
    /// Additional image URLs (comma-separated)
    /// </summary>
    public string? AdditionalImages { get; set; }

    /// <summary>
    /// Source URL from Chrono24 for reference
    /// </summary>
    public string? SourceUrl { get; set; }
}
