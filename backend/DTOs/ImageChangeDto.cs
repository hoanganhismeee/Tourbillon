namespace backend.DTOs;

// Represents a single image rename — used as the request body for RevertImageNames.
// Pass the "changes" array from a previous NormalizeImageNames response.
public class ImageChangeDto
{
    public int WatchId { get; set; }
    public string WatchName { get; set; } = string.Empty;
    public string OldImage { get; set; } = string.Empty;
    public string NewImage { get; set; } = string.Empty;
}
