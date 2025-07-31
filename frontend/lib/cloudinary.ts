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

// Helper function to construct public ID with folder structure
export const getPublicId = (imageName: string, folder: string = 'Watches') => {
  // Remove file extension if present
  const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, '');
  return `${folder}/${nameWithoutExtension}`;
};

// Helper function to get local image URL when Cloudinary is not available
export const getLocalImageUrl = (imageName: string) => {
  // For now, we'll use a placeholder or return the image name
  // In a real setup, you'd serve these from your backend or public directory
  return `/api/images/${imageName}`;
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
    return publicId; // Return original URL if Cloudinary not configured
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
  card: (publicId: string) => getOptimizedImageUrl(publicId, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  }) + `?t=${Date.now()}`, // Auto-refresh with timestamp

  // For Trinity Showcase (square format to match container)
  showcase: (publicId: string) => getOptimizedImageUrl(publicId, {
    width: 600,
    height: 600,
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  }) + `?t=${Date.now()}`, // Auto-refresh with timestamp

  // For individual watch detail pages
  detail: (publicId: string) => getOptimizedImageUrl(publicId, {
    width: 1200,
    height: 1200,
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  }) + `?t=${Date.now()}`, // Auto-refresh with timestamp

  // For thumbnails
  thumbnail: (publicId: string) => getOptimizedImageUrl(publicId, {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  }) + `?t=${Date.now()}`, // Auto-refresh with timestamp

  // For brand logos
  logo: (publicId: string) => getOptimizedImageUrl(publicId, {
    width: 300,
    height: 100,
    crop: 'fit',
    quality: 'auto',
    format: 'auto'
  }) + `?t=${Date.now()}`, // Auto-refresh with timestamp
};

// Note: Upload functionality requires server-side implementation
// This browser version only handles URL generation for existing images 