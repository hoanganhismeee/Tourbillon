// Data Transfer Object for scraped watch data from Chrono24
// Holds watch information before database insertion

namespace backend.DTOs;

public class ScrapedWatchDto
{
    /// Watch name or model (e.g., "Submariner Date", "Speedmaster Professional")
    public string Name { get; set; } = string.Empty;

    /// Brand name (e.g., "Rolex", "Omega", "Patek Philippe")
    public string BrandName { get; set; } = string.Empty;

    /// Collection name (e.g., "Submariner", "Speedmaster", "Nautilus")
    public string CollectionName { get; set; } = string.Empty;

    /// Current price as string (e.g., "84,000" or "Price on request")
    public string CurrentPrice { get; set; } = string.Empty;

    /// Detailed watch description (2-3 paragraphs of history and characteristics)
    public string Description { get; set; } = string.Empty;

    /// Technical specifications formatted as key-value pairs
    /// Format: "Movement: [details]; Case: [details]; Dial: [details]; etc."
    public string Specs { get; set; } = string.Empty;

    /// Primary image URL from Chrono24
    public string ImageUrl { get; set; } = string.Empty;

    /// Reference number if available (e.g., "116610LN", "5711/1A")
    public string? ReferenceNumber { get; set; }

    /// Additional image URLs (comma-separated)
    public string? AdditionalImages { get; set; }

    /// Source URL from Chrono24 for reference
    public string? SourceUrl { get; set; }
}
