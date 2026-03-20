// Generates and stores semantic embeddings for watches using nomic-embed-text via ai-service.
// Each watch gets 4 chunk types: full, brand_style, specs, use_case.
// Embeddings are stored in WatchEmbeddings (pgvector vector(768)) for future similarity search.

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Database;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace backend.Services;

public class WatchEmbeddingService
{
    private readonly TourbillonContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WatchEmbeddingService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public WatchEmbeddingService(
        TourbillonContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<WatchEmbeddingService> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// Generates and upserts all 4 chunk embeddings for a single watch.
    public async Task GenerateForWatchAsync(int watchId)
    {
        var watch = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == watchId);

        if (watch == null) return;

        var chunks = BuildChunks(watch);
        var texts = chunks.Select(c => c.Text).ToList();

        var httpClient = _httpClientFactory.CreateClient("ai-service");
        HttpResponseMessage resp;
        try
        {
            resp = await httpClient.PostAsJsonAsync("/embed", new { texts });
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Embed endpoint returned {Status} for watch {Id}", resp.StatusCode, watchId);
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Embed call failed for watch {Id}: {Err}", watchId, ex.Message);
            return;
        }

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
        if (!json.TryGetProperty("embeddings", out var embEl)) return;

        var embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
        if (embeddings == null || embeddings.Count != chunks.Count) return;

        // Upsert: delete existing rows for this watch, then insert fresh ones
        var existing = await _context.WatchEmbeddings.Where(e => e.WatchId == watchId).ToListAsync();
        _context.WatchEmbeddings.RemoveRange(existing);

        for (int i = 0; i < chunks.Count; i++)
        {
            _context.WatchEmbeddings.Add(new WatchEmbedding
            {
                WatchId = watchId,
                ChunkType = chunks[i].ChunkType,
                ChunkText = chunks[i].Text,
                Embedding = new Vector(embeddings[i]),
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        _logger.LogDebug("Embedded watch {Id} ({Name})", watchId, watch.Name);
    }

    /// Generates embeddings for a list of watch IDs, processed 10 at a time.
    public async Task GenerateBulkAsync(IEnumerable<int> watchIds)
    {
        const int BatchSize = 10;
        var ids = watchIds.ToList();
        for (int i = 0; i < ids.Count; i += BatchSize)
        {
            foreach (var id in ids.Skip(i).Take(BatchSize))
            {
                try { await GenerateForWatchAsync(id); }
                catch (Exception ex) { _logger.LogWarning("Embedding skipped for watch {Id}: {Err}", id, ex.Message); }
            }
        }
    }

    /// Returns total watch count, embedded count, and coverage percentage.
    public async Task<(int Total, int Embedded, int CoveragePct)> GetStatusAsync()
    {
        var total = await _context.Watches.CountAsync();
        var embedded = await _context.WatchEmbeddings
            .Where(e => e.ChunkType == "full")
            .Select(e => e.WatchId)
            .Distinct()
            .CountAsync();
        var pct = total > 0 ? embedded * 100 / total : 0;
        return (total, embedded, pct);
    }

    /// Generates embeddings for all watches that don't yet have a "full" chunk.
    /// Returns the number of newly embedded watches.
    public async Task<int> GenerateMissingAsync()
    {
        var alreadyEmbeddedIds = await _context.WatchEmbeddings
            .Where(e => e.ChunkType == "full")
            .Select(e => e.WatchId)
            .ToListAsync();

        var missingIds = await _context.Watches
            .Where(w => !alreadyEmbeddedIds.Contains(w.Id))
            .Select(w => w.Id)
            .ToListAsync();

        await GenerateBulkAsync(missingIds);
        return missingIds.Count;
    }

    // ── Chunk builder ─────────────────────────────────────────────────────────

    private record Chunk(string ChunkType, string Text);

    private static List<Chunk> BuildChunks(Watch watch)
    {
        var specs = DeserialiseSpecs(watch.Specs);
        var brand = watch.Brand?.Name ?? "";
        var collection = watch.Collection?.Name ?? "";
        var price = watch.CurrentPrice > 0 ? $"${watch.CurrentPrice:N0}" : "price on request";

        // full: holistic one-liner covering brand, name, specs, and price
        var fullParts = new List<string> { $"{brand} {watch.Name}" };
        if (!string.IsNullOrEmpty(collection)) fullParts.Add($"Collection: {collection}");
        var specSummary = BuildSpecsSummary(specs);
        if (!string.IsNullOrEmpty(specSummary)) fullParts.Add(specSummary);
        fullParts.Add($"Price: {price}");
        var full = string.Join(". ", fullParts);

        // brand_style: aesthetic and identity positioning
        var styleParts = new List<string> { $"{brand} luxury watch" };
        if (!string.IsNullOrEmpty(collection)) styleParts.Add($"{collection} collection");
        if (!string.IsNullOrEmpty(specs?.Case?.Material)) styleParts.Add($"{specs.Case.Material} case");
        if (!string.IsNullOrEmpty(specs?.Dial?.Color)) styleParts.Add($"{specs.Dial.Color} dial");
        if (!string.IsNullOrEmpty(specs?.Strap?.Material)) styleParts.Add($"{specs.Strap.Material} strap");
        var brandStyle = string.Join(", ", styleParts) + ".";

        // specs: technical specification sentence
        var techParts = new List<string>();
        if (!string.IsNullOrEmpty(specs?.Case?.Material))       techParts.Add($"Case: {specs.Case.Material}");
        if (!string.IsNullOrEmpty(specs?.Case?.Diameter))       techParts.Add($"Diameter: {specs.Case.Diameter}");
        if (!string.IsNullOrEmpty(specs?.Case?.Thickness))      techParts.Add($"Thickness: {specs.Case.Thickness}");
        if (!string.IsNullOrEmpty(specs?.Case?.WaterResistance))techParts.Add($"Water resistance: {specs.Case.WaterResistance}");
        if (!string.IsNullOrEmpty(specs?.Movement?.Type))       techParts.Add($"Movement: {specs.Movement.Type}");
        if (!string.IsNullOrEmpty(specs?.Movement?.PowerReserve))techParts.Add($"Power reserve: {specs.Movement.PowerReserve}");
        if (specs?.Movement?.Functions?.Any() == true)          techParts.Add($"Functions: {string.Join(", ", specs.Movement.Functions)}");
        var specsText = $"{brand} {watch.Name} specifications: {string.Join(". ", techParts)}.";

        // use_case: occasion and wear context
        var occasions = InferOccasions(watch, specs);
        var useCase = $"{brand} {watch.Name} — ideal for {string.Join(", ", occasions)}. Price: {price}.";

        return
        [
            new Chunk("full",        full.Trim()),
            new Chunk("brand_style", brandStyle.Trim()),
            new Chunk("specs",       specsText.Trim()),
            new Chunk("use_case",    useCase.Trim()),
        ];
    }

    private static List<string> InferOccasions(Watch watch, WatchSpecs? specs)
    {
        var occasions = new List<string>();

        // High water resistance → diving / water sports
        var wr = specs?.Case?.WaterResistance ?? "";
        if (Regex.IsMatch(wr, @"\b(100|150|200|300|500)\s*(m|bar|ATM)", RegexOptions.IgnoreCase))
            occasions.Add("diving and water sports");

        // Gold / platinum / tourbillon / complications → formal / black tie
        var mat = specs?.Case?.Material?.ToLower() ?? "";
        var name = watch.Name.ToLower();
        if (mat.Contains("gold") || mat.Contains("platinum") || name.Contains("tourbillon") || name.Contains("minute repeater"))
            occasions.Add("formal occasions and black-tie events");

        // Small diameter → dress / understated elegance
        var diamRaw = specs?.Case?.Diameter ?? "";
        var diamMatch = Regex.Match(diamRaw, @"(\d+(?:\.\d+)?)");
        if (diamMatch.Success && double.TryParse(diamMatch.Value, out var diam) && diam <= 38)
            occasions.Add("dress occasions and understated elegance");

        if (occasions.Count == 0)
            occasions.Add("everyday luxury wear");

        return occasions;
    }

    private static string BuildSpecsSummary(WatchSpecs? specs)
    {
        if (specs == null) return "";
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(specs.Case?.Material))  parts.Add(specs.Case.Material);
        if (!string.IsNullOrEmpty(specs.Case?.Diameter))  parts.Add(specs.Case.Diameter);
        if (!string.IsNullOrEmpty(specs.Movement?.Type))  parts.Add(specs.Movement.Type);
        if (!string.IsNullOrEmpty(specs.Dial?.Color))     parts.Add($"{specs.Dial.Color} dial");
        return string.Join(", ", parts);
    }

    private static WatchSpecs? DeserialiseSpecs(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try { return JsonSerializer.Deserialize<WatchSpecs>(specsJson); }
        catch { return null; }
    }
}
