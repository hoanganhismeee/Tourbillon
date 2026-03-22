// Persistent semantic query cache — stores search results indexed by query embedding.
// Enables sub-100ms responses for queries semantically similar to pre-seeded ones.
using Pgvector;

namespace backend.Models;

public class QueryCache
{
    public int Id { get; set; }

    /// Original query text, preserved for debugging and cache inspection.
    public string QueryText { get; set; } = "";

    /// 768-dim nomic-embed-text vector of the query. Used for cosine similarity lookup.
    public Vector QueryEmbedding { get; set; } = null!;

    /// Full WatchFinderResult serialised as JSON.
    public string ResultJson { get; set; } = "";

    /// Feature this cache entry serves. Allows feature-scoped lookups in the same table.
    /// Values: "watch_finder" | "rag_chat"
    public string Feature { get; set; } = "watch_finder";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
