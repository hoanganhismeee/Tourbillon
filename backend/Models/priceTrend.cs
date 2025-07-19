// The Price History of the Watch, it is a list of prices at different dates
// Will be used to show by graphs

namespace backend.Models;

public class PriceTrend
{
    public int Id { get; set; }
    public decimal PriceHistory { get; set; }
    public DateTime Date { get; set; }
    public int WatchId { get; set; }
    public Watch? Watches { get; set; }
}