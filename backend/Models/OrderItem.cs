// Line item within an order — watch data snapshotted at purchase time
namespace backend.Models;

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int WatchId { get; set; }
    public Watch Watch { get; set; } = null!;

    // Snapshot fields — preserved even if the watch is later modified or deleted
    public string WatchName { get; set; } = string.Empty;
    public string? WatchDescription { get; set; }
    public string? WatchImage { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
}
