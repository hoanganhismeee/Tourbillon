using System.ComponentModel.DataAnnotations;

namespace backend.DTOs
{
    public class UpdateWatchDto
    {
        [Required]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        [Range(0, double.MaxValue)]
        public decimal CurrentPrice { get; set; }

        public string Image { get; set; } = string.Empty;

        public int? CollectionId { get; set; }

        public string Specs { get; set; } = string.Empty;
    }
}
