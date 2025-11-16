// Interface for Chrono24 web scraping service
// Defines methods for scraping watch data from Chrono24

using backend.DTOs;

namespace backend.Services;

public interface IChrono24ScraperService
{
    /// <summary>
    /// Tests connection to Chrono24 and verifies scraping capabilities
    /// </summary>
    Task<(bool success, string message)> TestConnectionAsync();

    /// <summary>
    /// Scrapes watches for a specific brand and collection
    /// </summary>
    /// <param name="brandName">Name of the watch brand (e.g., "Rolex", "Omega")</param>
    /// <param name="collectionName">Name of the collection (e.g., "Submariner", "Speedmaster")</param>
    /// <param name="maxWatches">Maximum number of watches to scrape (default: 10)</param>
    Task<List<ScrapedWatchDto>> ScrapeWatchesByCollectionAsync(
        string brandName,
        string collectionName,
        int maxWatches = 10);

    /// <summary>
    /// Scrapes watches for a specific brand across all its collections
    /// </summary>
    /// <param name="brandName">Name of the watch brand</param>
    /// <param name="maxWatchesPerCollection">Maximum watches per collection (default: 10)</param>
    Task<List<ScrapedWatchDto>> ScrapeWatchesByBrandAsync(
        string brandName,
        int maxWatchesPerCollection = 10);

    /// <summary>
    /// Scrapes a specific watch by exact name search (returns top 5 results)
    /// </summary>
    /// <param name="watchName">Exact watch name to search for</param>
    /// <param name="brandName">Name of the watch brand</param>
    /// <param name="collectionName">Name of the collection</param>
    Task<ScrapedWatchDto?> ScrapeWatchByExactNameAsync(
        string watchName,
        string brandName,
        string collectionName);
}
