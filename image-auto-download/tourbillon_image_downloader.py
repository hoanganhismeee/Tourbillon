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
        
        # Image sources for luxury watches - comprehensive list of high-quality sources
        self.image_sources = [
            # Official brand websites (highest quality, transparent backgrounds)
            "https://www.patek.com",                    # Patek Philippe official
            "https://www.vacheron-constantin.com",      # Vacheron Constantin official
            "https://www.audemarspiguet.com",           # Audemars Piguet official
            "https://www.jaeger-lecoultre.com",         # Jaeger-LeCoultre official
            "https://www.alange-soehne.com",            # A. Lange & Söhne official
            "https://www.glashuette-original.com",      # Glashütte Original official
            "https://www.fpjourne.com",                 # F.P. Journe official
            "https://www.greubelforsey.com",            # Greubel Forsey official
            "https://www.rolex.com",                    # Rolex official
            "https://www.breguet.com",                  # Breguet official
            "https://www.blancpain.com",                # Blancpain official
            "https://www.omegawatches.com",             # Omega official
            "https://www.grand-seiko.com",              # Grand Seiko official
            "https://www.iwc.com",                      # IWC official
            "https://www.frederiqueconstant.com",       # Frederique Constant official
            
            # High-quality editorial and catalog sites
            "https://www.chrono24.com",                 # Massive catalog, model-specific pages
            "https://www.hodinkee.com",                 # High-quality editorial images
            "https://www.ablogtowatch.com",             # In-depth reviews with high-res photos
            "https://www.watchbase.com",                # Structured data, consistent image URLs
            "https://www.monochrome-watches.com",       # Editorial photography
            "https://www.watchtime.com",                # Clean layout, lots of reviews
            "https://www.timeandtidewatches.com",       # Good editorial photos
            "https://www.watchprosite.com"              # Additional luxury watch content
        ]
    
    def search_watch_image_urls(self, watch_name: str, brand_name: str) -> List[str]:
        """
        Search for watch image URLs using various methods.
        Prioritizes official brand websites for highest quality images with transparent backgrounds.
        
        Args:
            watch_name: Name of the watch (e.g., "6119G Clous de Paris")
            brand_name: Name of the brand (e.g., "Patek Philippe")
            
        Returns:
            List of potential image URLs found from search results (prioritized by quality)
        """
        # Priority 1: Official brand website searches (highest quality)
        official_search_terms = [
            f"site:{self.get_brand_website(brand_name)} {watch_name}",
            f"site:{self.get_brand_website(brand_name)} {watch_name} {brand_name}",
            f"site:{self.get_brand_website(brand_name)} {brand_name} {watch_name}",
        ]
        
        # Priority 2: General luxury watch searches (focusing on quality)
        general_search_terms = [
            f"{brand_name} {watch_name} transparent background",
            f"{brand_name} {watch_name} PNG transparent",
            f"{brand_name} {watch_name} luxury watch official",
            f"{brand_name} {watch_name} high resolution professional",
            f"{brand_name} {watch_name} studio photo",
            f"{watch_name} {brand_name} product image",
            f"{brand_name} {watch_name} white background",
            f"{watch_name} timepiece luxury professional"
        ]
        
        image_urls = []
        
        # Search official brand websites first
        for term in official_search_terms:
            try:
                search_url = f"https://www.google.com/search?q={urllib.parse.quote(term)}&tbm=isch&tbs=isz:l"
                
                response = self.session.get(search_url, timeout=10)
                if response.status_code == 200:
                    content = response.text
                    
                    # Look for image URLs in the response
                    import re
                    img_pattern = r'https://[^"]*\.(?:jpg|jpeg|png|webp)'
                    found_urls = re.findall(img_pattern, content)
                    
                    # Prioritize official brand website images
                    for url in found_urls:
                        if self.get_brand_website(brand_name) in url:
                            image_urls.insert(0, url)  # Add to beginning for priority
                        elif any(keyword in url.lower() for keyword in ['watch', 'timepiece', 'luxury']):
                            image_urls.append(url)
                
                time.sleep(1)  # Be respectful to servers
                
            except Exception as e:
                self.logger.warning(f"Error searching official sites for {term}: {e}")
                continue
        
        # Search general terms if we need more images
        if len(image_urls) < 5:
            for term in general_search_terms:
                try:
                    search_url = f"https://www.google.com/search?q={urllib.parse.quote(term)}&tbm=isch&tbs=isz:l"
                    
                    response = self.session.get(search_url, timeout=10)
                    if response.status_code == 200:
                        content = response.text
                        
                        import re
                        img_pattern = r'https://[^"]*\.(?:jpg|jpeg|png|webp)'
                        found_urls = re.findall(img_pattern, content)
                        
                        for url in found_urls:
                            if url not in image_urls and any(keyword in url.lower() for keyword in ['watch', 'timepiece', 'luxury']):
                                image_urls.append(url)
                    
                    time.sleep(1)
                    
                except Exception as e:
                    self.logger.warning(f"Error searching general terms for {term}: {e}")
                    continue
        
        return list(set(image_urls))  # Remove duplicates
    
    def get_brand_website(self, brand_name: str) -> str:
        """Get the official website for a brand name."""
        brand_websites = {
            'Patek Philippe': 'patek.com',
            'Vacheron Constantin': 'vacheron-constantin.com',
            'Audemars Piguet': 'audemarspiguet.com',
            'Jaeger-LeCoultre': 'jaeger-lecoultre.com',
            'A. Lange & Söhne': 'alange-soehne.com',
            'Glashütte Original': 'glashuette-original.com',
            'F.P. Journe': 'fpjourne.com',
            'Greubel Forsey': 'greubelforsey.com',
            'Rolex': 'rolex.com',
            'Breguet': 'breguet.com',
            'Blancpain': 'blancpain.com',
            'Omega': 'omegawatches.com',
            'Grand Seiko': 'grand-seiko.com',
            'IWC': 'iwc.com',
            'Frederique Constant': 'frederiqueconstant.com'
        }
        
        return brand_websites.get(brand_name, '')
    
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
                    # Check minimum dimensions (prefer larger images for better quality)
                    if img.width < 300 or img.height < 300:
                        filepath.unlink()  # Delete small images
                        return False
                    
                    # Prefer images with transparent backgrounds or professional backgrounds
                    # Check if image has transparency (RGBA mode)
                    if img.mode == 'RGBA':
                        # Keep transparency for PNG
                        img.save(filepath, 'PNG', optimize=True)
                    else:
                        # Convert to RGB and save as PNG
                        img = img.convert('RGB')
                        img.save(filepath, 'PNG', optimize=True)
                
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
    
    def get_brand_abbreviation(self, brand_name: str) -> str:
        """Get brand abbreviation for watch image naming."""
        brand_abbreviations = {
            'Patek Philippe': 'PP',
            'Vacheron Constantin': 'VC',
            'Audemars Piguet': 'AP',
            'Jaeger-LeCoultre': 'JLC',
            'A. Lange & Söhne': 'ALS',
            'Glashütte Original': 'GO',
            'F.P. Journe': 'FPJ',
            'Greubel Forsey': 'GF',
            'Rolex': 'RLX',
            'Breguet': 'BRG',
            'Blancpain': 'BLP',
            'Omega': 'OMG',
            'Grand Seiko': 'GS',
            'IWC': 'IWC',
            'Frederique Constant': 'FC'
        }
        return brand_abbreviations.get(brand_name, '')
    
    def get_watch_filename(self, watch_name: str, brand_name: str) -> str:
        """Generate watch filename following the CSV naming convention."""
        # Extract model number from watch name (e.g., "6119G Clous de Paris" -> "6119G")
        import re
        model_match = re.search(r'^(\d+[A-Z]*)', watch_name)
        if model_match:
            model_number = model_match.group(1)
            brand_abbr = self.get_brand_abbreviation(brand_name)
            return f"{brand_abbr}{model_number}.png"
        else:
            # Fallback: use safe filename
            safe_name = self.get_safe_filename(watch_name)
            brand_abbr = self.get_brand_abbreviation(brand_name)
            return f"{brand_abbr}_{safe_name}.png"
    
    def get_brand_filename(self, brand_name: str) -> str:
        """Generate brand filename following the CSV naming convention."""
        # Convert to lowercase and remove spaces
        filename = brand_name.lower().replace(' ', '').replace('&', '').replace('.', '')
        return f"{filename}.png"
    
    def get_collection_filename(self, collection_name: str) -> str:
        """Generate collection filename following the CSV naming convention."""
        # Convert to lowercase and remove spaces
        filename = collection_name.lower().replace(' ', '_').replace('&', '').replace('.', '')
        return f"{filename}.png"
    
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
                
                # Use exact filename from CSV or generate following naming convention
                csv_image_name = watch_data.get('Image', '')
                if not csv_image_name:
                    # Generate filename following the naming convention: PP6119G.png
                    csv_image_name = self.get_watch_filename(watch_name, brand_name)
                else:
                    # Ensure it has .png extension
                    if not csv_image_name.lower().endswith('.png'):
                        csv_image_name = csv_image_name.replace('.jpg', '.png').replace('.jpeg', '.png')
                        if not csv_image_name.lower().endswith('.png'):
                            csv_image_name += '.png'
                
                image_path = self.watches_folder / csv_image_name
                
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
                
                # Use exact filename from CSV or generate following naming convention
                csv_image_name = row.get('Image', '')
                if not csv_image_name:
                    # Generate filename following the naming convention: patekphillipe.png
                    csv_image_name = self.get_brand_filename(brand_name)
                else:
                    # Ensure it has .png extension
                    if not csv_image_name.lower().endswith('.png'):
                        csv_image_name = csv_image_name.replace('.jpg', '.png').replace('.jpeg', '.png')
                        if not csv_image_name.lower().endswith('.png'):
                            csv_image_name += '.png'
                
                image_path = self.brands_folder / csv_image_name
                
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