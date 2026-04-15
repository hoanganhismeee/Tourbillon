// AI intent classifier for the chat concierge routing layer.
// Calls POST /classify on the ai-service and returns a structured IntentClassification.
// Classifier failure is non-fatal — ChatService falls back to regex routing on "unclear".
using System.Net.Http.Json;
using System.Text.Json;

namespace backend.Services;

// Structured output from the AI intent classifier.
public sealed record IntentClassification(string Intent, double Confidence);

// Injectable interface for the intent classifier — enables FakeClassifier in tests.
public interface IIntentClassifier
{
    Task<IntentClassification> ClassifyAsync(
        string query,
        IReadOnlyList<string> entityBrands,
        IReadOnlyList<string> entityCollections,
        string followUpMode,
        int lastCardCount,
        IReadOnlyList<int> sessionBrandIds);
}

// Real implementation: calls the ai-service /classify endpoint.
public sealed class ChatIntentClassifier : IIntentClassifier
{
    private readonly IHttpClientFactory _httpClientFactory;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ChatIntentClassifier(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IntentClassification> ClassifyAsync(
        string query,
        IReadOnlyList<string> entityBrands,
        IReadOnlyList<string> entityCollections,
        string followUpMode,
        int lastCardCount,
        IReadOnlyList<int> sessionBrandIds)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient("ai-service");

            // Send minimal lastWatchCards array so the classifier receives the correct count.
            var payload = new
            {
                query,
                sessionState = new { followUpMode, brandIds = sessionBrandIds },
                lastWatchCards = Enumerable.Repeat(new { }, lastCardCount).ToArray(),
                entityMentions = new { brands = entityBrands, collections = entityCollections },
            };

            var resp = await httpClient.PostAsJsonAsync("/classify", payload);
            if (!resp.IsSuccessStatusCode)
                return new IntentClassification("unclear", 0.0);

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
            var intent = json.TryGetProperty("intent", out var intentEl)
                ? intentEl.GetString() ?? "unclear"
                : "unclear";
            var confidence = json.TryGetProperty("confidence", out var confEl)
                ? confEl.GetDouble()
                : 0.0;

            return new IntentClassification(intent, confidence);
        }
        catch
        {
            return new IntentClassification("unclear", 0.0);
        }
    }
}
