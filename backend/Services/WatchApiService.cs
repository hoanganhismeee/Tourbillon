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

            // Try to fetch a small set of watches to test the connection
            var response = await _httpClient.GetAsync($"/watches?limit=1&api_token={_apiToken}");

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
        try
        {
            _logger.LogInformation("Fetching watches from API - Page: {Page}, Limit: {Limit}", page, limit);

            var url = $"/watches?page={page}&limit={limit}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch watches: {StatusCode}", response.StatusCode);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<WatchApiListResponse>(content, options);
            _logger.LogInformation("Successfully fetched {Count} watches", result?.Data?.Count ?? 0);

            return result;
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

            var url = $"/watches/{reference}?api_token={_apiToken}";
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

            return JsonSerializer.Deserialize<WatchApiDto>(content, options);
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

            var url = $"/brands?api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch brands: {StatusCode}", response.StatusCode);
                return new List<BrandApiDto>();
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<BrandApiResponse>(content, options);
            _logger.LogInformation("Successfully fetched {Count} brands", result?.Data?.Count ?? 0);

            return result?.Data ?? new List<BrandApiDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching brands from API");
            return new List<BrandApiDto>();
        }
    }

    public async Task<List<WatchApiDto>> GetWatchesByBrandAsync(string brandName)
    {
        try
        {
            _logger.LogInformation("Fetching watches for brand: {Brand}", brandName);

            var url = $"/watches?brand={Uri.EscapeDataString(brandName)}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch watches for brand {Brand}: {StatusCode}", brandName, response.StatusCode);
                return new List<WatchApiDto>();
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<WatchApiListResponse>(content, options);
            return result?.Data ?? new List<WatchApiDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching watches for brand: {Brand}", brandName);
            return new List<WatchApiDto>();
        }
    }

    public async Task<List<WatchApiDto>> SearchWatchesAsync(string query)
    {
        try
        {
            _logger.LogInformation("Searching watches: {Query}", query);

            var url = $"/watches?search={Uri.EscapeDataString(query)}&api_token={_apiToken}";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Search failed: {StatusCode}", response.StatusCode);
                return new List<WatchApiDto>();
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var result = JsonSerializer.Deserialize<WatchApiListResponse>(content, options);
            return result?.Data ?? new List<WatchApiDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching watches: {Query}", query);
            return new List<WatchApiDto>();
        }
    }
}
