# Tourbillon Image Download Service - Main execution script
# Downloads luxury watch images from the internet to your local device

import os
import sys
from pathlib import Path
from tourbillon_image_downloader import TourbillonImageDownloader

def main():
    """
    Main execution function for the Tourbillon image download service.
    Downloads luxury watch images from the internet to your local device.
    """
    print("=== TOURBILLON IMAGE DOWNLOAD SERVICE ===")
    print("Downloading luxury watch images to your device...\n")
    
    try:
        # Initialize the downloader
        csv_data_path = "../backend/Data"
        download_folder = "../backend/Images"
        
        # Check if paths exist
        if not Path(csv_data_path).exists():
            print(f"Error: CSV data path not found: {csv_data_path}")
            print("Please ensure the backend/Data folder exists with your CSV files.")
            return
        
        # Create downloader instance
        downloader = TourbillonImageDownloader(csv_data_path, download_folder)
        
        # Download all images
        print("Starting image download process...")
        print("This will download luxury watch images from the internet.")
        print("The process may take some time depending on the number of watches.\n")
        
        results = downloader.download_all_images(max_parallel=3)  # Conservative parallel downloads
        
        # Display results
        print("\n=== DOWNLOAD RESULTS ===")
        for category, category_results in results.items():
            print(f"\n{category.upper()}:")
            print(f"  Successfully downloaded: {len(category_results['success'])}")
            print(f"  Failed downloads: {len(category_results['failed'])}")
            
            if category_results['failed']:
                print("  Failed items:")
                for item in category_results['failed'][:5]:  # Show first 5 failures
                    print(f"    - {item.get('name', 'Unknown')}: {item.get('status', 'Unknown error')}")
                if len(category_results['failed']) > 5:
                    print(f"    ... and {len(category_results['failed']) - 5} more")
        
        # Display statistics
        stats = downloader.get_download_statistics()
        print(f"\n=== SUMMARY ===")
        total_success = sum(stats[cat]['success'] for cat in stats)
        total_failed = sum(stats[cat]['failed'] for cat in stats)
        print(f"Total images processed: {total_success + total_failed}")
        print(f"Successfully downloaded: {total_success}")
        print(f"Failed downloads: {total_failed}")
        
        print(f"\nDownload process completed!")
        print("Check 'download_log.txt' for detailed logs and 'download_report.txt' for a summary report.")
        print("Downloaded images are saved in:")
        print(f"  - Watches: {downloader.watches_folder}")
        print(f"  - Brands: {downloader.brands_folder}")
        print(f"  - Collections: {downloader.collections_folder}")
        print("\nUpdated CSV files with image filenames have been saved as *_with_images.csv")
        
    except Exception as e:
        print(f"Error during download process: {str(e)}")
        print("Check the logs for more details.")

def download_watches_only():
    """Download only watch images (for testing or selective downloads).
    Useful when you want to download just watch images without brands or collections."""
    print("=== DOWNLOADING WATCH IMAGES ONLY ===")
    
    try:
        downloader = TourbillonImageDownloader()
        results = downloader.download_watch_images(max_parallel=3)
        
        print(f"Watch images download completed!")
        print(f"Success: {len(results['success'])}, Failed: {len(results['failed'])}")
        print(f"Images saved in: {downloader.watches_folder}")
        
    except Exception as e:
        print(f"Error: {str(e)}")

def download_brands_only():
    """Download only brand images (for testing or selective downloads).
    Useful when you want to download just brand logos without watches or collections."""
    print("=== DOWNLOADING BRAND IMAGES ONLY ===")
    
    try:
        downloader = TourbillonImageDownloader()
        results = downloader.download_brand_images()
        
        print(f"Brand images download completed!")
        print(f"Success: {len(results['success'])}, Failed: {len(results['failed'])}")
        print(f"Images saved in: {downloader.brands_folder}")
        
    except Exception as e:
        print(f"Error: {str(e)}")

def show_help():
    """Show help information and usage instructions.
    Displays all available commands and explains what the service does."""
    print("=== TOURBILLON IMAGE DOWNLOAD SERVICE - HELP ===")
    print("\nThis service downloads luxury watch images from the internet to your local device.")
    print("\nUsage:")
    print("  python main.py              # Download all images (watches, brands, collections)")
    print("  python main.py watches      # Download only watch images")
    print("  python main.py brands       # Download only brand images")
    print("  python main.py help         # Show this help message")
    print("\nWhat it does:")
    print("  - Searches for luxury watch images online")
    print("  - Downloads high-quality images to your device")
    print("  - Organizes images in folders: watches/, brands/, collections/")
    print("  - Updates CSV files with downloaded image filenames")
    print("  - Provides detailed logs and reports")
    print("\nRequirements:")
    print("  - Internet connection")
    print("  - Python packages: requests, pandas, Pillow, tqdm")
    print("  - CSV files in ../backend/Data/")

if __name__ == "__main__":
    # Check command line arguments for selective downloads
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "watches":
            download_watches_only()
        elif command == "brands":
            download_brands_only()
        elif command == "help":
            show_help()
        else:
            print(f"Unknown command: {command}")
            print("Use 'python main.py help' for usage information.")
    else:
        # Default: download all images
        main() 