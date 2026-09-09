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

    /// Retrieval pipeline and embedding model this result was produced under. Lookups ignore
    /// entries stamped with a different version, so changing either self-invalidates the cache
    /// instead of silently serving answers computed by code that no longer exists. Critical for
    /// the embedding model in particular: vectors from a different model are not comparable, so
    /// a mismatched entry would return arbitrary results rather than merely stale ones.
    public string PipelineVersion { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
