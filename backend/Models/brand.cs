// Brands of the Watches
namespace backend.Models;
public class Brand
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;  //string.empty because it will alway be filled
    public string Description { get; set; } = string.Empty; 
    public string? Image { get; set; }
    public ICollection<Watch>? Watches { get; set; } = new List<Watch>();
}