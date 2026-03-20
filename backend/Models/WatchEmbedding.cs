// EF Core entity for storing per-watch semantic embeddings.
// Each watch has up to 4 chunks (full, brand_style, specs, use_case),
// each with its own 768-dim nomic-embed-text vector stored via pgvector.
using Pgvector;

namespace backend.Models;

public class WatchEmbedding
{
    public int Id { get; set; }

    public int WatchId { get; set; }
    public Watch Watch { get; set; } = null!;

    /// One of: "full" | "brand_style" | "specs" | "use_case"
    public string ChunkType { get; set; } = "";

    /// The text that was embedded — stored for debugging and re-embedding
    public string ChunkText { get; set; } = "";

    /// 768-dim vector (nomic-embed-text). Null until embedding is generated.
    public Vector? Embedding { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
