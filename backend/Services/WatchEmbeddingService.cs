// Generates and stores semantic embeddings for watches using nomic-embed-text via ai-service.
// Each watch gets up to 5 chunk types: full, brand_style, specs, use_case, and editorial (when seeded).
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
                Feature = "watch_finder",
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        _logger.LogDebug("Embedded watch {Id} ({Name})", watchId, watch.Name);
    }

    /// Generates embeddings for a list of watch IDs, skipping any already fully embedded.
    /// Called as fire-and-forget from search results — only processes watches new to the vector store.
    public async Task GenerateBulkAsync(IEnumerable<int> watchIds)
    {
        var ids = watchIds.ToList();

        // Skip watches that already have all 4 chunk types — avoids re-embedding on every search
        var alreadyEmbedded = await _context.WatchEmbeddings
            .Where(e => ids.Contains(e.WatchId) && e.ChunkType == "full")
            .Select(e => e.WatchId)
            .ToListAsync();
        var toEmbed = ids.Except(alreadyEmbedded).ToList();

        foreach (var id in toEmbed)
        {
            try { await GenerateForWatchAsync(id); }
            catch (Exception ex) { _logger.LogWarning("Embedding skipped for watch {Id}: {Err}", id, ex.Message); }
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
    /// Uses true batch embedding: accumulates all chunk texts, sends 50 watches at a time
    /// (200 texts per HTTP call) instead of one call per watch — scales to 1000+ watches.
    /// Returns the number of newly embedded watches.
    public async Task<int> GenerateMissingAsync()
    {
        const int WatchesPerBatch = 10; // 10 watches × 4 chunks = 40 texts per embed call
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        var alreadyEmbeddedIds = await _context.WatchEmbeddings
            .Where(e => e.ChunkType == "full")
            .Select(e => e.WatchId)
            .ToListAsync();

        var missing = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .Where(w => !alreadyEmbeddedIds.Contains(w.Id))
            .AsNoTracking()
            .ToListAsync();

        if (missing.Count == 0) return 0;

        // Build all chunks upfront — avoids per-watch DB round trips
        var watchChunks = missing.Select(w => (Watch: w, Chunks: BuildChunks(w))).ToList();

        for (int i = 0; i < watchChunks.Count; i += WatchesPerBatch)
        {
            var batch = watchChunks.Skip(i).Take(WatchesPerBatch).ToList();
            var allTexts = batch.SelectMany(wc => wc.Chunks.Select(c => c.Text)).ToList();

            List<float[]>? embeddings;
            try
            {
                var resp = await httpClient.PostAsJsonAsync("/embed", new { texts = allTexts });
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Batch embed returned {Status} for watches {Start}-{End}", resp.StatusCode, i, i + batch.Count);
                    continue;
                }
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
                if (!json.TryGetProperty("embeddings", out var embEl)) continue;
                embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
                if (embeddings == null || embeddings.Count != allTexts.Count) continue;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Batch embed call failed: {Err}", ex.Message);
                continue;
            }

            // Delete any partial embeddings for this batch's watches, then insert fresh
            var batchWatchIds = batch.Select(wc => wc.Watch.Id).ToList();
            var existing = await _context.WatchEmbeddings
                .Where(e => batchWatchIds.Contains(e.WatchId))
                .ToListAsync();
            _context.WatchEmbeddings.RemoveRange(existing);

            // Distribute embeddings back to each watch in order
            int offset = 0;
            var now = DateTime.UtcNow;
            foreach (var (watch, chunks) in batch)
            {
                for (int j = 0; j < chunks.Count; j++)
                {
                    _context.WatchEmbeddings.Add(new WatchEmbedding
                    {
                        WatchId = watch.Id,
                        ChunkType = chunks[j].ChunkType,
                        ChunkText = chunks[j].Text,
                        Embedding = new Vector(embeddings[offset + j]),
                        UpdatedAt = now,
                    });
                }
                offset += chunks.Count;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Embedded batch {Start}-{End} of {Total}", i, i + batch.Count, missing.Count);
        }

        return missing.Count;
    }

    /// Deletes all watch_finder embeddings and regenerates from scratch.
    /// Use after changing chunk-building logic (InferCategory, InferOccasions, BuildChunks).
    public async Task<int> RegenerateAllAsync()
    {
        var existing = await _context.WatchEmbeddings
            .Where(e => e.Feature == "watch_finder")
            .ToListAsync();
        _context.WatchEmbeddings.RemoveRange(existing);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Deleted {Count} watch_finder embeddings for regeneration", existing.Count);
        return await GenerateMissingAsync();
    }

    /// Generates editorial embeddings (Feature="editorial", ChunkType="editorial") for watches
    /// that have editorial content linked but no editorial embedding yet.
    /// Called after SeedAllAsync completes — safe to re-run (skips already-embedded watches).
    public async Task<int> GenerateEditorialChunksAsync()
    {
        const int BatchSize = 10;
        var httpClient = _httpClientFactory.CreateClient("ai-service");

        var alreadyHaveEditorial = await _context.WatchEmbeddings
            .Where(e => e.ChunkType == "editorial")
            .Select(e => e.WatchId)
            .ToListAsync();

        // Fetch watches with editorial content that don't yet have an editorial embedding
        var watches = await _context.Watches
            .Include(w => w.EditorialLink)
                .ThenInclude(l => l!.EditorialContent)
            .Where(w => w.EditorialLink != null && !alreadyHaveEditorial.Contains(w.Id))
            .AsNoTracking()
            .ToListAsync();

        if (watches.Count == 0) return 0;

        // Build one text blob per watch from all four editorial sections
        var watchTexts = watches.Select(w =>
        {
            var ed = w.EditorialLink!.EditorialContent!;
            var text = string.Join(" ", new[] { ed.WhyItMatters, ed.BestFor, ed.DesignLanguage, ed.CollectorAppeal }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
            return (Watch: w, Text: text);
        }).ToList();

        int count = 0;
        for (int i = 0; i < watchTexts.Count; i += BatchSize)
        {
            var batch = watchTexts.Skip(i).Take(BatchSize).ToList();
            var texts = batch.Select(wt => wt.Text).ToList();

            List<float[]>? embeddings;
            try
            {
                var resp = await httpClient.PostAsJsonAsync("/embed", new { texts });
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Editorial embed batch returned {Status}", resp.StatusCode);
                    continue;
                }
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions);
                if (!json.TryGetProperty("embeddings", out var embEl)) continue;
                embeddings = JsonSerializer.Deserialize<List<float[]>>(embEl.GetRawText(), _jsonOptions);
                if (embeddings == null || embeddings.Count != texts.Count) continue;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Editorial embed call failed: {Err}", ex.Message);
                continue;
            }

            var now = DateTime.UtcNow;
            for (int j = 0; j < batch.Count; j++)
            {
                _context.WatchEmbeddings.Add(new WatchEmbedding
                {
                    WatchId    = batch[j].Watch.Id,
                    ChunkType  = "editorial",
                    ChunkText  = batch[j].Text,
                    Embedding  = new Vector(embeddings[j]),
                    Feature    = "editorial",
                    UpdatedAt  = now,
                });
            }
            await _context.SaveChangesAsync();
            count += batch.Count;
            _logger.LogInformation("Embedded editorial batch {Start}-{End} of {Total}",
                i, i + batch.Count, watches.Count);
        }

        return count;
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

        // brand_style: aesthetic and identity positioning — watch-specific differentiators
        var styleParts = new List<string> { $"{brand} {watch.Name}" };
        if (!string.IsNullOrEmpty(collection)) styleParts.Add($"{collection} collection");
        if (!string.IsNullOrEmpty(specs?.Case?.Material)) styleParts.Add($"{specs.Case.Material} case");
        if (!string.IsNullOrEmpty(specs?.Dial?.Color)) styleParts.Add($"{specs.Dial.Color} dial");
        if (!string.IsNullOrEmpty(specs?.Dial?.Finish)) styleParts.Add($"{specs.Dial.Finish} finish");
        if (!string.IsNullOrEmpty(specs?.Dial?.Indices)) styleParts.Add($"{specs.Dial.Indices} indices");
        if (!string.IsNullOrEmpty(specs?.Dial?.Hands)) styleParts.Add($"{specs.Dial.Hands} hands");
        if (!string.IsNullOrEmpty(specs?.Strap?.Material)) styleParts.Add($"{specs.Strap.Material} strap");
        if (!string.IsNullOrEmpty(specs?.Movement?.Caliber)) styleParts.Add($"Caliber {specs.Movement.Caliber}");
        if (!string.IsNullOrEmpty(specs?.Case?.CaseBack)) styleParts.Add($"{specs.Case.CaseBack} case back");
        if (!string.IsNullOrEmpty(specs?.ProductionStatus)) styleParts.Add(specs.ProductionStatus);
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

        // use_case: deterministic category + spec-grounded wear context per watch
        var category = InferCategory(watch, specs);
        var occasions = InferOccasions(watch, specs);
        var useCaseParts = new List<string> { $"{brand} {watch.Name} — {category}" };
        // Ground the category with watch-specific specs for intra-collection differentiation
        if (!string.IsNullOrEmpty(specs?.Case?.Diameter)) useCaseParts.Add(specs.Case.Diameter);
        if (!string.IsNullOrEmpty(specs?.Case?.Material)) useCaseParts.Add(specs.Case.Material);
        if (!string.IsNullOrEmpty(specs?.Case?.WaterResistance)) useCaseParts.Add($"{specs.Case.WaterResistance} water resistance");
        if (!string.IsNullOrEmpty(specs?.Movement?.Type)) useCaseParts.Add(specs.Movement.Type);
        if (specs?.Movement?.Functions?.Any() == true)
        {
            var complications = specs.Movement.Functions
                .Where(f => !f.Equals("Hours", StringComparison.OrdinalIgnoreCase)
                         && !f.Equals("Minutes", StringComparison.OrdinalIgnoreCase)
                         && !f.Equals("Seconds", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (complications.Count > 0) useCaseParts.Add(string.Join(", ", complications));
        }
        var useCase = $"{string.Join(", ", useCaseParts)}. Ideal for {string.Join(", ", occasions)}. Price: {price}.";

        return
        [
            new Chunk("full",        full.Trim()),
            new Chunk("brand_style", brandStyle.Trim()),
            new Chunk("specs",       specsText.Trim()),
            new Chunk("use_case",    useCase.Trim()),
        ];
    }

    // Functional category classification — first match wins.
    // Used by InferOccasions to gate occasion labels and by BuildChunks to embed category text.
    private static readonly HashSet<string> _diverCollections = new(StringComparer.OrdinalIgnoreCase)
        { "Submariner", "SeaQ", "Seamaster", "Aquanaut", "Marine", "Polaris" };
    private static readonly HashSet<string> _sportCollections = new(StringComparer.OrdinalIgnoreCase)
        { "Nautilus", "Royal Oak", "Overseas", "Highlife", "lineSport", "Spezialist",
          "Sport Collection", "GMT-Master II", "Royal Oak Offshore", "Royal Oak Concept" };
    private static readonly HashSet<string> _dressCollections = new(StringComparer.OrdinalIgnoreCase)
        { "Calatrava", "Patrimony", "Saxonia", "Classique", "Reverso", "Master Ultra Thin",
          "Senator", "Slimline", "Elegance Collection", "De Ville", "Tradition", "1815",
          "Lange 1", "Datejust", "Day-Date", "Historiques", "Métiers d'Art",
          "Heritage Collection", "Classics", "Reine de Naples", "élégante", "PanoMatic",
          "Duomètre", "Manufacture", "Constellation", "Grand Complications", "Zeitwerk",
          "Collection", "Collection Convexe", "Datograph", "Evolution 9" };

    private static string InferCategory(Watch watch, WatchSpecs? specs)
    {
        var collection = watch.Collection?.Name ?? "";
        var name = watch.Name.ToLower();
        var functions = specs?.Movement?.Functions ?? [];
        var wr = specs?.Case?.WaterResistance ?? "";

        // 1. Diver — high WR or diver collection
        var wrMatch = Regex.Match(wr, @"(\d+)");
        if (wrMatch.Success && int.TryParse(wrMatch.Value, out var wrM) && wrM >= 200)
            return "diver's watch";
        if (_diverCollections.Contains(collection))
            return "diver's watch";

        // 2. Chronograph — functions or name keywords
        if (functions.Any(f => f.Contains("chronograph", StringComparison.OrdinalIgnoreCase))
            || Regex.IsMatch(name, @"chronograph|chronographe|chrono|rattrapante|daytona|speedmaster|centigraphe", RegexOptions.IgnoreCase))
            return "chronograph";

        // 3. Sport watch — sport-oriented collections
        if (_sportCollections.Contains(collection))
            return "sport watch";

        // 4. Dress watch — dress-oriented collections
        if (_dressCollections.Contains(collection))
            return "dress watch";

        // 5. Default
        return "luxury watch";
    }

    private static List<string> InferOccasions(Watch watch, WatchSpecs? specs)
    {
        var occasions = new List<string>();
        var category = InferCategory(watch, specs);

        // High water resistance → diving / water sports
        var wr = specs?.Case?.WaterResistance ?? "";
        if (Regex.IsMatch(wr, @"\b(100|150|200|300|500)\s*(m|bar|ATM)", RegexOptions.IgnoreCase))
            occasions.Add("diving and water sports");

        // Gold / platinum → formal ONLY for dress watches and uncategorised pieces
        var mat = specs?.Case?.Material?.ToLower() ?? "";
        var name = watch.Name.ToLower();
        if ((mat.Contains("gold") || mat.Contains("platinum")
            || name.Contains("tourbillon") || name.Contains("minute repeater"))
            && category is "dress watch" or "luxury watch")
            occasions.Add("formal occasions and black-tie events");

        // Dress category → dress occasions
        if (category == "dress watch")
            occasions.Add("dress occasions and understated elegance");

        // Sport / diver / chrono → active lifestyle
        if (category is "sport watch" or "diver's watch" or "chronograph")
            occasions.Add("active lifestyle and sport");

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
