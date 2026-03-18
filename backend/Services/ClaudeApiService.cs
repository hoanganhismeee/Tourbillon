// Claude API service for extracting structured watch data from HTML pages
// Uses Claude Haiku to parse any watch brand's product page without per-brand XPath config

using backend.DTOs;
using backend.Models;
using HtmlAgilityPack;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace backend.Services;

public interface IClaudeApiService
{
    /// Extracts structured watch data from a product page's HTML
    Task<WatchPageData?> ExtractWatchPageDataAsync(string html, string url, CancellationToken ct = default);

    /// Extracts product page URLs from a collection listing page's HTML
    Task<List<string>> ExtractProductUrlsFromListingAsync(string html, string listingUrl, string brandName, CancellationToken ct = default);
}

public class ClaudeApiService : IClaudeApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ClaudeApiService> _logger;
    private readonly IConfiguration _configuration;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public ClaudeApiService(
        HttpClient httpClient,
        ILogger<ClaudeApiService> logger,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;

        _httpClient.BaseAddress = new Uri("https://api.anthropic.com/");
        _httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var apiKey = _configuration["Anthropic:ApiKey"];
        if (!string.IsNullOrEmpty(apiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);
        }
    }

    public async Task<WatchPageData?> ExtractWatchPageDataAsync(string html, string url, CancellationToken ct = default)
    {
        try
        {
            var cleanedHtml = PreprocessHtml(html);
            _logger.LogInformation("Preprocessed HTML: {OriginalSize}KB -> {CleanedSize}KB for {Url}",
                html.Length / 1024, cleanedHtml.Length / 1024, url);

            var model = _configuration["Anthropic:Model"] ?? "claude-haiku-4-5-20251001";
            var maxTokens = int.TryParse(_configuration["Anthropic:MaxTokens"], out var mt) ? mt : 2000;

            var prompt = BuildExtractionPrompt(cleanedHtml, url);

            var requestBody = new
            {
                model = model,
                max_tokens = maxTokens,
                messages = new[]
                {
                    new { role = "user", content = prompt }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("v1/messages", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Claude API error {StatusCode}: {Body}", response.StatusCode, errorBody);

                // Retry once on 429 (rate limit) or 5xx
                if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
                {
                    _logger.LogInformation("Retrying after 3s...");
                    await Task.Delay(3000, ct);
                    response = await _httpClient.PostAsync("v1/messages", content, ct);
                    if (!response.IsSuccessStatusCode)
                    {
                        errorBody = await response.Content.ReadAsStringAsync(ct);
                        _logger.LogError("Claude API retry failed {StatusCode}: {Body}", response.StatusCode, errorBody);
                        return null;
                    }
                }
                else
                {
                    return null;
                }
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            return ParseClaudeResponse(responseJson);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Claude API for {Url}", url);
            return null;
        }
    }

    public async Task<List<string>> ExtractProductUrlsFromListingAsync(
        string html, string listingUrl, string brandName, CancellationToken ct = default)
    {
        try
        {
            var cleanedHtml = PreprocessHtml(html);
            _logger.LogInformation("Preprocessed listing HTML: {OriginalSize}KB -> {CleanedSize}KB for {Url}",
                html.Length / 1024, cleanedHtml.Length / 1024, listingUrl);

            var model = _configuration["Anthropic:Model"] ?? "claude-haiku-4-5-20251001";

            var prompt = $@"You are a URL extractor for luxury watch websites. Given the HTML of a collection/catalog listing page for {brandName}, extract all individual watch product page URLs.

Return ONLY a JSON array of absolute URLs, one per watch product page. Example:
[""https://www.brand.com/watches/model-1"", ""https://www.brand.com/watches/model-2""]

Rules:
- Only include URLs that lead to individual watch product/detail pages (NOT category pages, NOT filters, NOT accessories)
- URLs should be complete absolute URLs starting with https://
- If you see relative URLs, prepend the base domain from: {listingUrl}
- Do NOT include duplicate URLs
- Do NOT include pagination links, sort/filter links, or navigation links
- If you cannot find any product URLs, return an empty array: []

Page URL: {listingUrl}

HTML content:
{cleanedHtml}";

            var requestBody = new
            {
                model = model,
                max_tokens = 4000,
                messages = new[]
                {
                    new { role = "user", content = prompt }
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("v1/messages", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Claude API error for URL extraction {StatusCode}: {Body}", response.StatusCode, errorBody);
                return new List<string>();
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);

            // Parse Claude response to get the text content
            using var doc = JsonDocument.Parse(responseJson);
            var root = doc.RootElement;
            var contentArray = root.GetProperty("content");
            var textContent = "";
            foreach (var item in contentArray.EnumerateArray())
            {
                if (item.GetProperty("type").GetString() == "text")
                {
                    textContent = item.GetProperty("text").GetString() ?? "";
                    break;
                }
            }

            // Clean markdown fences
            textContent = textContent.Trim();
            if (textContent.StartsWith("```"))
            {
                textContent = Regex.Replace(textContent, @"^```\w*\n?", "");
                textContent = Regex.Replace(textContent, @"\n?```$", "");
                textContent = textContent.Trim();
            }

            var urls = JsonSerializer.Deserialize<List<string>>(textContent, JsonOptions);
            _logger.LogInformation("Claude extracted {Count} product URLs from listing page", urls?.Count ?? 0);
            return urls ?? new List<string>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting product URLs from listing page {Url}", listingUrl);
            return new List<string>();
        }
    }

    /// Strips unnecessary HTML elements and attributes to reduce token count
    /// Reduces ~300KB page to ~20-30KB of relevant content
    private string PreprocessHtml(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // Remove elements that never contain watch specs
        var tagsToRemove = new[] { "script", "style", "svg", "noscript", "header", "footer", "nav", "iframe", "video", "audio" };
        foreach (var tag in tagsToRemove)
        {
            var nodes = doc.DocumentNode.SelectNodes($"//{tag}");
            if (nodes != null)
            {
                foreach (var node in nodes.ToList())
                {
                    node.Remove();
                }
            }
        }

        // Remove HTML comments
        var comments = doc.DocumentNode.SelectNodes("//comment()");
        if (comments != null)
        {
            foreach (var comment in comments.ToList())
            {
                comment.Remove();
            }
        }

        // Keep only useful attributes, remove the rest
        var keepAttributes = new HashSet<string> { "class", "id", "alt", "src", "href", "content", "property", "name", "data-price", "data-ref", "data-sku" };
        StripAttributes(doc.DocumentNode, keepAttributes);

        var result = doc.DocumentNode.OuterHtml;

        // Collapse whitespace
        result = Regex.Replace(result, @"\s+", " ");
        result = Regex.Replace(result, @">\s+<", "><");

        // If still too large (>50KB), truncate to the main content area
        if (result.Length > 50000)
        {
            // Try to find the main content area
            var mainContent = doc.DocumentNode.SelectSingleNode("//main")
                              ?? doc.DocumentNode.SelectSingleNode("//*[contains(@class,'product')]")
                              ?? doc.DocumentNode.SelectSingleNode("//*[contains(@class,'watch')]")
                              ?? doc.DocumentNode.SelectSingleNode("//article");

            if (mainContent != null)
            {
                // Also grab meta tags (for og:image, etc.)
                var head = doc.DocumentNode.SelectSingleNode("//head");
                var metaTags = head?.SelectNodes(".//meta[@property or @name]");
                var metaHtml = metaTags != null
                    ? string.Join("", metaTags.Select(m => m.OuterHtml))
                    : "";

                result = metaHtml + mainContent.OuterHtml;
                result = Regex.Replace(result, @"\s+", " ");
            }
        }

        return result;
    }

    private void StripAttributes(HtmlNode node, HashSet<string> keepAttributes)
    {
        if (node.NodeType == HtmlNodeType.Element)
        {
            var attributesToRemove = node.Attributes
                .Where(a => !keepAttributes.Contains(a.Name.ToLowerInvariant()))
                .Select(a => a.Name)
                .ToList();

            foreach (var attr in attributesToRemove)
            {
                node.Attributes.Remove(attr);
            }
        }

        foreach (var child in node.ChildNodes.ToList())
        {
            StripAttributes(child, keepAttributes);
        }
    }

    private string BuildExtractionPrompt(string cleanedHtml, string url)
    {
        return $@"You are a luxury watch data extractor. Given the HTML of a watch product page, extract structured data as JSON.

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{{
  ""referenceNumber"": ""string or null"",
  ""watchName"": ""string or null"",
  ""description"": ""string or null"",
  ""price"": ""string or null"",
  ""imageUrl"": ""string or null"",
  ""specs"": {{
    ""productionStatus"": ""Current production"" or ""Discontinued"" or null,
    ""dial"": {{
      ""color"": ""string or null"",
      ""finish"": ""string or null"",
      ""indices"": ""string or null"",
      ""hands"": ""string or null""
    }},
    ""case"": {{
      ""material"": ""string or null"",
      ""diameter"": ""string or null"",
      ""thickness"": ""string or null"",
      ""lugToLug"": ""string or null"",
      ""waterResistance"": ""string or null"",
      ""crystal"": ""string or null"",
      ""caseBack"": ""string or null""
    }},
    ""movement"": {{
      ""caliber"": ""string or null"",
      ""type"": ""Automatic"" or ""Manual"" or ""Quartz"" or null,
      ""powerReserve"": ""string or null"",
      ""frequency"": ""string or null"",
      ""jewels"": number or null,
      ""functions"": [""string""] or null
    }},
    ""strap"": {{
      ""material"": ""string or null"",
      ""color"": ""string or null"",
      ""buckle"": ""string or null""
    }}
  }}
}}

Rules:
- watchName: the model name (e.g. ""Senator Excellence"", ""Royal Oak Selfwinding""). NOT just the reference number.
- referenceNumber: the full reference (e.g. ""1-36-01-02-05-61"", ""15500ST.OO.1220ST.01"").
- description: 2-3 sentences drawn from the page's marketing copy or editorial text describing this specific watch's character, design highlights, and what makes it notable. Do NOT use the brand name alone. If no descriptive text exists on the page, return null.
- imageUrl: the MAIN product image (front-facing hero shot of the watch). Look for:
  1. og:image meta tag
  2. The first/largest product image with the watch face visible (often in a hero section)
  3. Image URLs containing the reference number or ""master"" or ""product""
  Do NOT use detail/close-up/lifestyle shots. Return full absolute URL.
- price: exactly as displayed. If no price shown, use ""Price on request"".
- dial.color: just the color (e.g. ""Blue"", ""Silver"", ""Black""). Not a full description.
- dial.finish: surface finish (e.g. ""Sunburst"", ""Galvanic"", ""Lacquered"", ""Guilloché"").
- dial.indices: hour marker type (e.g. ""Applied baton"", ""Roman numerals"", ""Arabic numerals"").
- movement.type: normalize to exactly ""Automatic"", ""Manual"", or ""Quartz"".
- movement.frequency: format as ""28,800 vph (4 Hz)"" — comma-separated thousands, lowercase ""vph"", Hz in parentheses.
- movement.powerReserve: write out ""hours"" in full (e.g. ""70 hours"", not ""70 h"").
- movement.functions: list each function separately. Capitalise the first item, lowercase the rest (e.g. [""Hours"", ""minutes"", ""central seconds"", ""date""]).
- case.waterResistance: format as ""30 m / 3 bar"" — metres first, slash separator, bar second.
- case.lugToLug: lug-to-lug distance in mm (e.g. ""47 mm""). Use null if not found.
- productionStatus: ""Current production"" if the watch appears currently available, ""Discontinued"" if the page indicates it is no longer produced, null if unclear.
- Use null for any field not found. Never guess or fabricate.

Page URL: {url}

HTML content:
{cleanedHtml}";
    }

    private WatchPageData? ParseClaudeResponse(string responseJson)
    {
        try
        {
            // Parse the Claude API response wrapper
            using var doc = JsonDocument.Parse(responseJson);
            var root = doc.RootElement;

            // Extract the text content from the response
            var contentArray = root.GetProperty("content");
            var textContent = "";
            foreach (var item in contentArray.EnumerateArray())
            {
                if (item.GetProperty("type").GetString() == "text")
                {
                    textContent = item.GetProperty("text").GetString() ?? "";
                    break;
                }
            }

            if (string.IsNullOrEmpty(textContent))
            {
                _logger.LogWarning("Empty text content in Claude response");
                return null;
            }

            // Clean up any markdown fences Claude might add despite instructions
            textContent = textContent.Trim();
            if (textContent.StartsWith("```"))
            {
                textContent = Regex.Replace(textContent, @"^```\w*\n?", "");
                textContent = Regex.Replace(textContent, @"\n?```$", "");
                textContent = textContent.Trim();
            }

            // Deserialize the extracted JSON into WatchPageData
            var watchData = JsonSerializer.Deserialize<WatchPageData>(textContent, JsonOptions);

            if (watchData == null)
            {
                _logger.LogWarning("Failed to deserialize watch data from Claude response");
                return null;
            }

            _logger.LogInformation("Extracted: {Ref} - {Name} ({Price})",
                watchData.ReferenceNumber, watchData.WatchName, watchData.Price);

            return watchData;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Claude JSON response");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Claude API response");
            return null;
        }
    }
}
