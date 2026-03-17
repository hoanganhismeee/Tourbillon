// Response DTO from Claude API watch page extraction
// Contains all structured data extracted from a single watch product page

using backend.Models;

namespace backend.DTOs;

public class WatchPageData
{
    /// Reference number (e.g., "1-36-01-02-05-61", "5711/1A-010")
    public string? ReferenceNumber { get; set; }

    /// Watch model name (e.g., "Senator Excellence", "Royal Oak")
    public string? WatchName { get; set; }

    /// Display price (e.g., "$84,000", "Price on request")
    public string? Price { get; set; }

    /// Primary product image URL
    public string? ImageUrl { get; set; }

    /// 2-3 sentence product description covering the watch's character and key highlights
    public string? Description { get; set; }

    /// Structured watch specifications
    public WatchSpecs? Specs { get; set; }
}
