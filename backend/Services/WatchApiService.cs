// Service for communicating with The Watch API
// Handles authentication, HTTP requests, and error handling

using System.Net.Http.Headers;
using System.Text.Json;
using backend.DTOs;

namespace backend.Services;

public class WatchApiService : IWatchApiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WatchApiService> _logger;
    private readonly string _apiToken;
    private readonly string _baseUrl;

    public WatchApiService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<WatchApiService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        _baseUrl = configuration["WatchApi:BaseUrl"] ?? "https://api.thewatchapi.com/v1";
        _apiToken = configuration["WatchApi:ApiToken"] ?? "";

        // Configure HttpClient
        _httpClient.BaseAddress = new Uri(_baseUrl);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        // Support both authentication methods: Bearer token and API key header
        if (!string.IsNullOrEmpty(_apiToken))
        {
            _httpClient.DefaultRequestHeaders.Add("x-api-key", _apiToken);
        }
    }

    public async Task<(bool Success, string Message)> TestConnectionAsync()
    {
        try
        {
            _logger.LogInformation("Testing Watch API connection...");

            if (string.IsNullOrEmpty(_apiToken))
            {
                return (false, "API token is not configured. Please set WatchApi:ApiToken in user secrets.");
            }

            // Try to fetch brands to test the connection
            var response = await _httpClient.GetAsync($"/v1/brand/list?api_token={_apiToken}");

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Watch API connection successful");
                return (true, $"API connection successful! Status: {response.StatusCode}");
            }

            var errorContent = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("Watch API connection failed: {StatusCode} - {Content}", response.StatusCode, errorContent);
            return (false, $"API returned {response.StatusCode}: {errorContent}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing Watch API connection");
            return (false, $"Connection error: {ex.Message}");
        }
    }

    public async Task<WatchApiListResponse?> GetWatchesAsync(int page = 1, int limit = 100)
    {
        // Note: The Watch API doesn't have a paginated "get all watches" endpoint
        // This method now returns watches by searching with common terms
        // For full sync, use GetWatchesByBrandAsync for each brand
        try
        {
            _logger.LogInformation("Fetching watches from API using search");

            // Use a broad search to get some watches
            var watches = await SearchWatchesAsync("");

            var response = new WatchApiListResponse
            {
                Data = watches.Take(limit).ToList(),
                Total = watches.Count,
                Page = page,
                Limit = limit
            };

            _logger.LogInformation("Successfully fetched {Count} watches", response.Data.Count);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching watches from API");
            return null;
        }
    }

    public async Task<WatchApiDto?> GetWatchByReferenceAsync(string reference)
    {
        try
        {
            _logger.LogInformation("Fetching watch by reference: {Reference}", reference);

            var url = $"/v1/reference/search?search={Uri.EscapeDataString(reference)}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Watch not found: {Reference}", reference);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var watches = JsonSerializer.Deserialize<List<WatchApiDto>>(content, options);
            return watches?.FirstOrDefault();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching watch by reference: {Reference}", reference);
            return null;
        }
    }

    public async Task<List<BrandApiDto>> GetBrandsAsync()
    {
        try
        {
            _logger.LogInformation("Fetching brands from API");

            var url = $"/v1/brand/list?api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch brands: {StatusCode}", response.StatusCode);
                return [];
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            // API returns {"data": ["Brand1", "Brand2", ...]}
            var brandListResponse = JsonSerializer.Deserialize<BrandListResponse>(content, options);
            _logger.LogInformation("Successfully fetched {Count} brands", brandListResponse?.Data?.Count ?? 0);

            // Convert brand names to BrandApiDto objects
            return brandListResponse?.Data?.Select(name => new BrandApiDto { Name = name }).ToList() ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching brands from API");
            return [];
        }
    }

    public async Task<List<WatchApiDto>> GetWatchesByBrandAsync(string brandName)
    {
        try
        {
            _logger.LogInformation("Fetching watches for brand: {Brand}", brandName);

            var url = $"/v1/model/search?brand={Uri.EscapeDataString(brandName)}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                // Check if it's a "too many results" error (common with free API plan)
                if (content.Contains("too_many_results"))
                {
                    _logger.LogWarning("Too many results for brand {Brand}. Free API plan limit exceeded (max 3 results). Try more specific searches.", brandName);
                }
                else
                {
                    _logger.LogWarning("Failed to fetch watches for brand {Brand}: {StatusCode} - {Content}", brandName, response.StatusCode, content);
                }
                return [];
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            // API returns {"data": [...]} format
            var watchResponse = JsonSerializer.Deserialize<WatchListDataResponse>(content, options);
            return watchResponse?.Data ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching watches for brand: {Brand}", brandName);
            return [];
        }
    }

    public async Task<List<WatchApiDto>> SearchWatchesAsync(string query)
    {
        try
        {
            _logger.LogInformation("Searching watches: {Query}", query);

            var url = $"/v1/model/search?search={Uri.EscapeDataString(query)}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                if (content.Contains("too_many_results"))
                {
                    _logger.LogWarning("Search '{Query}' returned too many results. Free API plan limit (3 results). Try more specific search.", query);
                }
                else
                {
                    _logger.LogWarning("Search failed: {StatusCode} - {Content}", response.StatusCode, content);
                }
                return [];
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            // API returns {"data": [...]} format
            var watchResponse = JsonSerializer.Deserialize<WatchListDataResponse>(content, options);
            return watchResponse?.Data ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching watches: {Query}", query);
            return [];
        }
    }
}
