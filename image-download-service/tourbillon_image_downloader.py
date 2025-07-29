# Tourbillon Image Download Service - Main downloader class
# Downloads luxury watch images from the internet and saves them locally

import requests
import pandas as pd
import os
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from PIL import Image
from io import BytesIO
import urllib.parse
from tqdm import tqdm
import concurrent.futures

class TourbillonImageDownloader:
    """
    Main class for downloading luxury watch images from the internet.
    Searches for and downloads high-quality images for watches, brands, and collections.
    """
    
    def __init__(self, csv_data_path: str = "../backend/Data", download_folder: str = "../backend/Images"):
        """
        Initialize the downloader with paths to CSV data and download folder.
        
        Args:
            csv_data_path: Path to folder containing CSV files
            download_folder: Path to folder where images will be downloaded
        """
        self.csv_data_path = Path(csv_data_path)
        self.download_folder = Path(download_folder)
        self.download_results = {
            'watches': {'success': [], 'failed': []},
            'brands': {'success': [], 'failed': []},
            'collections': {'success': [], 'failed': []}
        }
        
        # Create download folders
        self.watches_folder = self.download_folder / "watches"
        self.brands_folder = self.download_folder / "brands"
        self.collections_folder = self.download_folder / "collections"
        
        for folder in [self.download_folder, self.watches_folder, self.brands_folder, self.collections_folder]:
            folder.mkdir(parents=True, exist_ok=True)
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('download_log.txt'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Set up session for requests
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # Image sources for luxury watches
        self.image_sources = [
            "https://www.hodinkee.com",
            "https://www.ablogtowatch.com", 
            "https://www.watchtime.com",
            "https://www.watchprosite.com",
            "https://www.chrono24.com"
        ]
    
    def search_watch_image_urls(self, watch_name: str, brand_name: str) -> List[str]:
        """
        Search for watch image URLs using various methods.
        Creates multiple search terms combining watch name and brand to find relevant images online.
        
        Args:
            watch_name: Name of the watch (e.g., "6119G Clous de Paris")
            brand_name: Name of the brand (e.g., "Patek Philippe")
            
        Returns:
            List of potential image URLs found from search results
        """
        search_terms = [
            f"{brand_name} {watch_name} watch",
            f"{watch_name} {brand_name}",
            f"{brand_name} {watch_name} luxury watch",
            f"{watch_name} timepiece"
        ]
        
        image_urls = []
        
        for term in search_terms:
            try:
                # Use Google Images search (simplified approach)
                search_url = f"https://www.google.com/search?q={urllib.parse.quote(term)}&tbm=isch"
                
                response = self.session.get(search_url, timeout=10)
                if response.status_code == 200:
                    # Extract image URLs from Google search results
                    # This is a simplified approach - in production you'd use a proper image search API
                    content = response.text
                    
                    # Look for image URLs in the response
                    import re
                    img_pattern = r'https://[^"]*\.(?:jpg|jpeg|png|webp)'
                    found_urls = re.findall(img_pattern, content)
                    
                    # Filter for high-quality images
                    for url in found_urls:
                        if any(keyword in url.lower() for keyword in ['watch', 'timepiece', 'luxury']):
                            image_urls.append(url)
                
                time.sleep(1)  # Be respectful to servers
                
            except Exception as e:
                self.logger.warning(f"Error searching for {term}: {e}")
                continue
        
        return list(set(image_urls))  # Remove duplicates
    
    def download_image(self, url: str, filepath: Path) -> bool:
        """
        Download an image from URL and save it to filepath.
        Validates the image quality, checks dimensions, and converts to consistent format.
        
        Args:
            url: Image URL to download from the internet
            filepath: Local path where to save the downloaded image
            
        Returns:
            True if download and validation successful, False if failed
        """
        try:
            response = self.session.get(url, timeout=15, stream=True)
            response.raise_for_status()
            
            # Check if it's actually an image
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return False
            
            # Download and save image
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Validate the downloaded image
            try:
                with Image.open(filepath) as img:
                    # Check minimum dimensions
                    if img.width < 200 or img.height < 200:
                        filepath.unlink()  # Delete small images
                        return False
                    
                    # Convert to RGB if necessary
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                        img.save(filepath, 'JPEG', quality=95)
                
                return True
                
            except Exception as e:
                self.logger.warning(f"Invalid image file {filepath}: {e}")
                if filepath.exists():
                    filepath.unlink()
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to download {url}: {e}")
            return False
    
    def get_safe_filename(self, name: str) -> str:
        """Convert watch name to safe filename for file system storage.
        Removes special characters, replaces spaces with underscores, and limits length."""
        # Remove special characters and replace spaces
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_name = safe_name.replace(' ', '_').replace('/', '_').replace('&', 'and')
        return safe_name[:100]  # Limit length
    
    def download_watch_images(self, max_parallel: int = 5) -> Dict[str, List]:
        """
        Download images for all watches in watches.csv.
        Reads the CSV file, searches for each watch image online, and downloads them in parallel.
        Updates the CSV with downloaded image filenames.
        
        Args:
            max_parallel: Maximum number of parallel downloads (default: 5 for efficiency)
            
        Returns:
            Dictionary with success and failed download lists for reporting
        """
        self.logger.info("Starting watch images download...")
        
        try:
            # Read watches CSV
            watches_df = pd.read_csv(self.csv_data_path / 'watches.csv')
            
            # Get brand names for better search
            brands_df = pd.read_csv(self.csv_data_path / 'brands.csv')
            brand_dict = dict(zip(brands_df['Id'], brands_df['Name']))
            
            def download_single_watch(watch_data):
                """Download image for a single watch.
                Checks if image already exists, searches for URLs, and downloads the best match."""
                watch_id = watch_data['Id']
                watch_name = watch_data['Name']
                brand_id = watch_data['BrandId']
                brand_name = brand_dict.get(brand_id, "Unknown")
                
                # Check if image already exists
                safe_filename = self.get_safe_filename(watch_name)
                image_path = self.watches_folder / f"{safe_filename}.jpg"
                
                if image_path.exists():
                    self.logger.info(f"Image already exists for {watch_name}")
                    return {
                        'id': watch_id,
                        'name': watch_name,
                        'filename': image_path.name,
                        'status': 'already_exists'
                    }
                
                # Search for image URLs
                image_urls = self.search_watch_image_urls(watch_name, brand_name)
                
                if not image_urls:
                    return {
                        'id': watch_id,
                        'name': watch_name,
                        'filename': None,
                        'status': 'no_urls_found'
                    }
                
                # Try to download from first few URLs
                for i, url in enumerate(image_urls[:3]):
                    if self.download_image(url, image_path):
                        return {
                            'id': watch_id,
                            'name': watch_name,
                            'filename': image_path.name,
                            'status': 'success',
                            'url': url
                        }
                    time.sleep(0.5)  # Brief pause between attempts
                
                return {
                    'id': watch_id,
                    'name': watch_name,
                    'filename': None,
                    'status': 'download_failed'
                }
            
            # Download images in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_parallel) as executor:
                # Prepare watch data
                watch_data_list = []
                for _, row in watches_df.iterrows():
                    watch_data_list.append({
                        'Id': row['Id'],
                        'Name': row['Name'],
                        'BrandId': row['BrandId']
                    })
                
                # Submit all downloads
                future_to_watch = {executor.submit(download_single_watch, watch_data): watch_data 
                                 for watch_data in watch_data_list}
                
                # Process results with progress bar
                for future in tqdm(concurrent.futures.as_completed(future_to_watch), 
                                 total=len(watch_data_list), 
                                 desc="Downloading watch images"):
                    result = future.result()
                    
                    if result['status'] == 'success':
                        self.download_results['watches']['success'].append(result)
                    else:
                        self.download_results['watches']['failed'].append(result)
            
            # Update CSV with downloaded image filenames
            for result in self.download_results['watches']['success']:
                if result['filename']:
                    watch_id = result['id']
                    watches_df.loc[watches_df['Id'] == watch_id, 'Image'] = result['filename']
            
            # Save updated CSV
            watches_df.to_csv(self.csv_data_path / 'watches_with_images.csv', index=False)
            
            self.logger.info(f"Watch images download completed. Success: {len(self.download_results['watches']['success'])}, Failed: {len(self.download_results['watches']['failed'])}")
            
        except Exception as e:
            self.logger.error(f"Error processing watch images: {str(e)}")
        
        return self.download_results['watches']
    
    def download_brand_images(self) -> Dict[str, List]:
        """
        Download brand logos and images for all brands in brands.csv.
        Searches for brand logos and official images, downloads them sequentially.
        Updates the CSV with downloaded image filenames.
        
        Returns:
            Dictionary with success and failed download lists for reporting
        """
        self.logger.info("Starting brand images download...")
        
        try:
            brands_df = pd.read_csv(self.csv_data_path / 'brands.csv')
            
            for _, row in brands_df.iterrows():
                brand_id = row['Id']
                brand_name = row['Name']
                
                # Check if image already exists
                safe_filename = self.get_safe_filename(brand_name)
                image_path = self.brands_folder / f"{safe_filename}.jpg"
                
                if image_path.exists():
                    self.logger.info(f"Brand image already exists for {brand_name}")
                    self.download_results['brands']['success'].append({
                        'id': brand_id,
                        'name': brand_name,
                        'filename': image_path.name,
                        'status': 'already_exists'
                    })
                    continue
                
                # Search for brand logo
                search_terms = [
                    f"{brand_name} logo",
                    f"{brand_name} watch brand",
                    f"{brand_name} luxury watch brand"
                ]
                
                image_found = False
                for term in search_terms:
                    image_urls = self.search_watch_image_urls(term, brand_name)
                    
                    for url in image_urls[:2]:  # Try first 2 URLs
                        if self.download_image(url, image_path):
                            self.download_results['brands']['success'].append({
                                'id': brand_id,
                                'name': brand_name,
                                'filename': image_path.name,
                                'status': 'success',
                                'url': url
                            })
                            image_found = True
                            break
                    
                    if image_found:
                        break
                    time.sleep(1)
                
                if not image_found:
                    self.download_results['brands']['failed'].append({
                        'id': brand_id,
                        'name': brand_name,
                        'filename': None,
                        'status': 'download_failed'
                    })
            
            # Update CSV with downloaded image filenames
            for result in self.download_results['brands']['success']:
                if result['filename']:
                    brand_id = result['id']
                    brands_df.loc[brands_df['Id'] == brand_id, 'Image'] = result['filename']
            
            # Save updated CSV
            brands_df.to_csv(self.csv_data_path / 'brands_with_images.csv', index=False)
            
            self.logger.info(f"Brand images download completed. Success: {len(self.download_results['brands']['success'])}, Failed: {len(self.download_results['brands']['failed'])}")
            
        except Exception as e:
            self.logger.error(f"Error processing brand images: {str(e)}")
        
        return self.download_results['brands']
    
    def download_all_images(self, max_parallel: int = 5) -> Dict[str, Dict[str, List]]:
        """
        Download all images (watches, brands, collections).
        Main orchestrator function that runs the complete download process.
        Generates a comprehensive report after completion.
        
        Args:
            max_parallel: Maximum number of parallel downloads for watch images
            
        Returns:
            Complete download results for all categories with success/failure statistics
        """
        self.logger.info("Starting complete image download process...")
        
        # Download all categories
        self.download_watch_images(max_parallel)
        self.download_brand_images()
        
        # Generate summary report
        self.generate_download_report()
        
        return self.download_results
    
    def generate_download_report(self):
        """Generate a comprehensive download report.
        Creates a text file with detailed statistics of all downloads including success/failure counts."""
        report_path = Path('download_report.txt')
        
        with open(report_path, 'w') as f:
            f.write("=== TOURBILLON IMAGE DOWNLOAD REPORT ===\n\n")
            
            for category, results in self.download_results.items():
                f.write(f"{category.upper()} IMAGES:\n")
                f.write(f"  Successfully downloaded: {len(results['success'])}\n")
                f.write(f"  Failed downloads: {len(results['failed'])}\n")
                
                if results['failed']:
                    f.write("  Failed items:\n")
                    for item in results['failed']:
                        f.write(f"    - {item.get('name', 'Unknown')}: {item.get('status', 'Unknown error')}\n")
                
                f.write("\n")
        
        self.logger.info(f"Download report generated: {report_path}")
    
    def get_download_statistics(self) -> Dict[str, Dict[str, int]]:
        """Get statistics about the download process.
        Returns counts of successful and failed downloads for each category (watches, brands, collections)."""
        stats = {}
        for category, results in self.download_results.items():
            stats[category] = {
                'success': len(results['success']),
                'failed': len(results['failed']),
                'total': len(results['success']) + len(results['failed'])
            }
        return stats 