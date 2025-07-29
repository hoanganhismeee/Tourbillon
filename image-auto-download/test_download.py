# Tourbillon Image Download Service - Test Script
# Tests the download service functionality and validates setup

import os
import sys
from pathlib import Path

def test_environment():
    """Test if the environment is properly set up for the download service"""
    print("=== TESTING DOWNLOAD SERVICE ENVIRONMENT ===\n")
    
    # Check Python version
    print(f"✓ Python version: {sys.version.split()[0]}")
    
    # Check required packages
    required_packages = ['requests', 'pandas', 'PIL', 'tqdm']
    missing_packages = []
    
    for package in required_packages:
        try:
            if package == 'PIL':
                import PIL
                print(f"✓ {package} (Pillow) installed")
            else:
                __import__(package)
                print(f"✓ {package} installed")
        except ImportError:
            missing_packages.append(package)
            print(f"✗ {package} not found")
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    # Check CSV files
    csv_path = Path("../backend/Data")
    if csv_path.exists():
        csv_files = list(csv_path.glob("*.csv"))
        if csv_files:
            print(f"✓ Found {len(csv_files)} CSV files in {csv_path}")
            for file in csv_files:
                print(f"  - {file.name}")
        else:
            print(f"✗ No CSV files found in {csv_path}")
            return False
    else:
        print(f"✗ CSV data path not found: {csv_path}")
        return False
    
    print("\n✅ Environment test passed!")
    return True

def test_downloader_import():
    """Test if the downloader class can be imported"""
    print("\n=== TESTING DOWNLOADER IMPORT ===\n")
    
    try:
        from tourbillon_image_downloader import TourbillonImageDownloader
        print("✓ TourbillonImageDownloader class imported successfully")
        
        # Test instantiation
        downloader = TourbillonImageDownloader()
        print("✓ Downloader instance created successfully")
        
        print("\n✅ Import test passed!")
        return True
        
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False

def test_safe_filename():
    """Test the safe filename function"""
    print("\n=== TESTING SAFE FILENAME FUNCTION ===\n")
    
    try:
        from tourbillon_image_downloader import TourbillonImageDownloader
        downloader = TourbillonImageDownloader()
        
        test_names = [
            "6119G Clous de Paris",
            "Patek Philippe & Co.",
            "Submariner/Date",
            "Speedmaster '57"
        ]
        
        for name in test_names:
            safe_name = downloader.get_safe_filename(name)
            print(f"'{name}' → '{safe_name}'")
        
        print("\n✅ Safe filename test passed!")
        return True
        
    except Exception as e:
        print(f"✗ Safe filename test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("=== TOURBILLON IMAGE DOWNLOAD SERVICE - TEST SUITE ===\n")
    
    tests = [
        test_environment,
        test_downloader_import,
        test_safe_filename
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print("-" * 50)
    
    print(f"\n=== TEST RESULTS ===")
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! Your download service is ready to use.")
        print("\nNext steps:")
        print("1. Run: python main.py help")
        print("2. Start with: python main.py watches")
        print("3. Check downloaded images in ../backend/Images/")
    else:
        print("❌ Some tests failed. Please fix the issues before using the service.")

if __name__ == "__main__":
    main() 