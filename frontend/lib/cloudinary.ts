// Browser-compatible Cloudinary utilities for image optimization
// Constructs URLs directly without requiring Node.js modules

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

// Test function to verify Cloudinary connection
export const testCloudinaryConnection = () => {
  if (!CLOUDINARY_CLOUD_NAME) {
    console.error('❌ Cloudinary not configured: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is missing');
    return false;
  }
  
  console.log('✅ Cloudinary configured with cloud name:', CLOUDINARY_CLOUD_NAME);
  return true;
};

/** Ensure we always have a full publicId with folder and no extension */
export const toPublicId = (value: string) => {
  if (!value) return '';
  // If caller already passed a full publicId (has '/'), keep it
  if (value.includes('/')) return value.replace(/\.[^/.]+$/, '');
  
  // For your Cloudinary setup: images are in root folder with extensions
  // Just return the clean filename without folder prefix
  const cleanName = value.replace(/\.[^/.]+$/, '');
  
  // Handle Cloudinary auto-suffixes by mapping base names to their actual public IDs
  const suffixMapping: Record<string, string> = {
    // Add your actual mappings here as you discover them
    // Format: 'baseName': 'baseName_actualSuffix'
    // Example: 'PP3029': 'PP3029_ejwq2',
    // Example: 'patekphilippe': 'patekphilippe_abc123',
    
    // Current mappings based on your data
    'JLCchrono': 'JLCchronograph', // From your spreadsheet data
    'JLCgyro': 'JLCgyro', // If this has a suffix, update it
    'JLCsphero': 'JLCsphero', // If this has a suffix, update it
    
    // Add more mappings here as you discover them
    // For example, if you upload PP3029 and it becomes PP3029_ejwq2:
    // 'PP3029': 'PP3029_ejwq2',
  };
  
  // If we have a mapping for this base name, use it
  if (suffixMapping[cleanName]) {
    return suffixMapping[cleanName];
  }
  
  // Otherwise, return the clean name (for assets without suffixes)
  return cleanName;
};

// Helper function to add suffix mappings easily
export const addSuffixMapping = (baseName: string, actualPublicId: string) => {
  console.log(`📝 Adding suffix mapping: ${baseName} → ${actualPublicId}`);
  // In a real implementation, you might want to store this in localStorage or a config file
  // For now, this is just for documentation
};

// Helper function to get all current mappings (for debugging)
export const getSuffixMappings = () => {
  return {
    // This would return the actual mappings in a real implementation
    message: 'Check the suffixMapping object in toPublicId function'
  };
};

// TEMPORARY FIX OPTION: If your Cloudinary assets have different naming,
// uncomment and modify one of these alternatives:

// Option 1: If your assets are in root folder without extensions
// export const toPublicId = (value: string, folder = 'Watches') => {
//   if (!value) return '';
//   if (value.includes('/')) return value.replace(/\.[^/.]+$/, '');
//   // Remove folder prefix and just use the clean name
//   return value.replace(/\.[^/.]+$/, '');
// };

// Option 2: If your assets have suffixes like _abc123
// export const toPublicId = (value: string, folder = 'Watches') => {
//   if (!value) return '';
//   if (value.includes('/')) return value.replace(/\.[^/.]+$/, '');
//   // Add your actual suffix pattern here
//   const cleanName = value.replace(/\.[^/.]+$/, '');
//   return `${folder}/${cleanName}_abc123`; // Replace with your actual suffix
// };

// Option 3: If your assets are in different folders
// export const toPublicId = (value: string, folder = 'Watches') => {
//   if (!value) return '';
//   if (value.includes('/')) return value.replace(/\.[^/.]+$/, '');
//   // Map to your actual folder structure
//   const cleanName = value.replace(/\.[^/.]+$/, '');
//   if (folder === 'Brands') return `Logos/${cleanName}`; // If brands are in "Logos" folder
//   if (folder === 'Watches') return `Products/${cleanName}`; // If watches are in "Products" folder
//   return `${folder}/${cleanName}`;
// };

// Helper function to construct public ID with folder structure
export const getPublicId = (imageName: string, folder: string = 'Watches') => {
  // Remove file extension if present
  const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, '');
  return `${folder}/${nameWithoutExtension}`;
};

// Helper function to get local image URL when Cloudinary is not available
export const getLocalImageUrl = (imageName: string) => {
  // Serve images from the backend API
  return `/${imageName}`;
};

// Utility function to generate optimized image URLs
export const getOptimizedImageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'thumb' | 'scale';
    quality?: 'auto' | number;
    format?: 'auto' | 'avif' | 'webp' | 'jpg' | 'png';
    gravity?: 'auto' | 'center' | 'face' | 'north' | 'south' | 'east' | 'west';
  } = {}
) => {
  if (!CLOUDINARY_CLOUD_NAME) {
    console.warn('Cloudinary cloud name not configured, using local fallback');
    // If the publicId looks like a Cloudinary public ID (contains '/'), 
    // extract the original filename and return local URL
    if (publicId.includes('/')) {
      const parts = publicId.split('/');
      const filename = parts[parts.length - 1];
      // Try to reconstruct the original filename with extension
      // This is a simple approach - in practice you'd want to store the original filename
      return getLocalImageUrl(filename);
    }
    // If publicId is just a filename (like 'AP26589.webp'), use local URL
    return getLocalImageUrl(publicId);
  }

  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
    gravity = 'auto'
  } = options;

  // Build transformation string
  const transformations: string[] = [];
  
  if (width || height) {
    const size = [];
    if (width) size.push(`w_${width}`);
    if (height) size.push(`h_${height}`);
    if (crop) size.push(`c_${crop}`);
    if (gravity) size.push(`g_${gravity}`);
    transformations.push(size.join(','));
  }
  
  if (quality !== 'auto') {
    transformations.push(`q_${quality}`);
  }
  
  if (format !== 'auto') {
    transformations.push(`f_${format}`);
  }

  // Construct the URL
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const transformationString = transformations.length > 0 ? transformations.join('/') + '/' : '';
  
  return `${baseUrl}/${transformationString}${publicId}`;
};

// Predefined transformations for different use cases
export const imageTransformations = {
  // For watch cards in grid (AllWatchesSection)
  card: (value: string) =>
    getOptimizedImageUrl(toPublicId(value), {
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }) + (process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : ''),

  // For Trinity Showcase (square format to match container)
  showcase: (value: string) =>
    getOptimizedImageUrl(toPublicId(value), {
      width: 600,
      height: 600,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }) + (process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : ''),

  // For individual watch detail pages
  detail: (value: string) =>
    getOptimizedImageUrl(toPublicId(value), {
      width: 1200,
      height: 1200,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }) + (process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : ''),

  // For thumbnails
  thumbnail: (value: string) =>
    getOptimizedImageUrl(toPublicId(value), {
      width: 200,
      height: 200,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }) + (process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : ''),

  // For brand logos
  logo: (value: string) => {
    const pid = toPublicId(value); // change folder if you use a different one for logos
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${pid}`
      + (process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : '');
  },
};

// Note: Upload functionality requires server-side implementation
// This browser version only handles URL generation for existing images 