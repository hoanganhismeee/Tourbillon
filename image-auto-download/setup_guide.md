# Tourbillon Image Download Service - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd image-download-service
pip install -r requirements.txt
```

### 2. Prepare Your Environment
1. Ensure you have internet connection
2. Make sure your CSV files are in `../backend/Data/`
3. The service will create the Images folder automatically

### 3. Run the Download Service
```bash
# Download all images (watches, brands, collections)
python main.py

# Download only watch images
python main.py watches

# Download only brand images
python main.py brands

# Show help
python main.py help
```

## What This Service Does

### Image Discovery
- Searches for luxury watch images using watch names and brand information
- Uses multiple search terms to find the best quality images
- Filters for high-quality, relevant images

### Download Process
- Downloads images in parallel for efficiency
- Validates image quality and dimensions
- Converts images to consistent format (JPEG)
- Organizes downloads into structured folders

### Quality Control
- Minimum image size requirements (200x200 pixels)
- Image format validation
- Duplicate prevention
- Error handling and retry logic

## Folder Structure

After running the service, you'll have this structure:
```
backend/
├── Data/
│   ├── watches.csv
│   ├── brands.csv
│   ├── collections.csv
│   ├── watches_with_images.csv  # Updated with image filenames
│   └── brands_with_images.csv   # Updated with image filenames
└── Images/
    ├── watches/
    │   ├── 6119G_Clous_de_Paris.jpg
    │   ├── 5227G_010_Automatic_Date.jpg
    │   └── ...
    ├── brands/
    │   ├── Patek_Philippe.jpg
    │   ├── Vacheron_Constantine.jpg
    │   └── ...
    └── collections/
        ├── Calatrava.jpg
        ├── Nautilus.jpg
        └── ...
```

## Output Files

The service generates several output files:
- `watches_with_images.csv` - Updated watches CSV with downloaded image filenames
- `brands_with_images.csv` - Updated brands CSV with downloaded image filenames
- `download_log.txt` - Detailed download logs
- `download_report.txt` - Summary report of download results

## Integration with Your Project

### Frontend Integration
Use the downloaded images in your Next.js components:

```typescript
// Use downloaded images
<img src="/images/watches/6119G_Clous_de_Paris.jpg" alt="Patek Philippe" />
```

### Backend Integration
Update your ASP.NET Core models to use local image paths:

```csharp
// Update your watch model to use local image paths
public class Watch
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Image { get; set; } // Now contains local image filename
    // ... other properties
}
```

## Benefits

1. **Complete Image Library**: All watch images available locally
2. **High Quality**: Professional images for luxury watch showcase
3. **Offline Access**: Images available without internet dependency
4. **Consistent Naming**: Organized file structure for easy management
5. **Fast Loading**: Local images load faster than remote URLs

## Troubleshooting

### Common Issues

1. **"No URLs found" errors**
   - Some watches may not have easily findable images online
   - Try running the service multiple times
   - Check the logs for specific search terms used

2. **Download failures**
   - Network connectivity issues
   - Server blocking requests
   - Invalid image URLs

3. **CSV reading errors**
   - Check that CSV files exist in `../backend/Data`
   - Verify CSV format matches expected structure

### Getting Help

- Check `download_log.txt` for detailed error messages
- Review `download_report.txt` for summary of issues
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Verify internet connection is working

## Performance Tips

1. **Parallel Downloads**: The service uses parallel downloads for efficiency
2. **Resume Capability**: Re-running the service will skip already downloaded images
3. **Quality Filtering**: Only high-quality images are saved
4. **Error Recovery**: Failed downloads are logged and can be retried

## Legal Considerations

- This service downloads images from publicly available sources
- Respect copyright and usage rights
- Consider using images only for development/testing purposes
- For production use, ensure you have proper image licenses 