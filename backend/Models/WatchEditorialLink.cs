// Join table linking a watch to its editorial content archetype.
// Many watches share one WatchEditorialContent (all watches in a collection point to the same record).
namespace backend.Models;

public class WatchEditorialLink
{
    // PK is WatchId — one editorial per watch
    public int WatchId { get; set; }
    public Watch Watch { get; set; } = null!;

    public int EditorialContentId { get; set; }
    public WatchEditorialContent EditorialContent { get; set; } = null!;
}
