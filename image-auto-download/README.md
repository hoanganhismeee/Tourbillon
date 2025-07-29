# Tourbillon Image Download Service

## Purpose
This service automatically downloads luxury watch images from the internet and saves them locally in your repository for the Tourbillon e-commerce platform. It fetches high-quality images of watches, brands, and collections based on the data in your CSV files. After downloading, you can manually upload these images to Cloudinary for cloud storage.

**Note**: Since the database is created manually and you want to avoid scraping websites, this service provides a controlled way to gather images for luxury watch showcase.

## What This Service Does
- **Image Discovery**: Searches for luxury watch images using watch names and brand information
- **Bulk Download**: Downloads images in parallel for efficient processing
- **Quality Filtering**: Ensures downloaded images meet quality standards
- **Organized Storage**: Saves images in organized folders with proper naming
- **Duplicate Prevention**: Avoids downloading the same image multiple times

## Key Functions
- `download_watch_images()`: Downloads images for all watches in watches.csv
- `download_brand_images()`: Downloads brand logos and images
- `search_watch_images()`: Searches for specific watch images online
- `validate_image_quality()`: Checks image quality and dimensions
- `organize_downloads()`: Organizes downloaded images into folders

## Benefits for Tourbillon Project
- **Complete Image Library**: All watch images available locally in your repository
- **High Quality**: Professional images for luxury watch showcase
- **Manual Control**: You can review and organize images before uploading to Cloudinary
- **Consistent Naming**: Organized file structure for easy management
- **Repository Integration**: Images are part of your project structure 