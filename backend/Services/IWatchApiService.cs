// Interface for The Watch API service
// Defines methods for fetching watch data from external API

using backend.DTOs;

namespace backend.Services;

public interface IWatchApiService
{
    /// <summary>
    /// Test the API connection and authentication
    /// </summary>
    Task<(bool Success, string Message)> TestConnectionAsync();

    /// <summary>
    /// Get watches from the API with pagination
    /// </summary>
    Task<WatchApiListResponse?> GetWatchesAsync(int page = 1, int limit = 100);

    /// <summary>
    /// Get a specific watch by reference number
    /// </summary>
    Task<WatchApiDto?> GetWatchByReferenceAsync(string reference);

    /// <summary>
    /// Get all available brands from the API
    /// </summary>
    Task<List<BrandApiDto>> GetBrandsAsync();

    /// <summary>
    /// Get watches by brand name
    /// </summary>
    Task<List<WatchApiDto>> GetWatchesByBrandAsync(string brandName);

    /// <summary>
    /// Search watches by keywords
    /// </summary>
    Task<List<WatchApiDto>> SearchWatchesAsync(string query);
}
