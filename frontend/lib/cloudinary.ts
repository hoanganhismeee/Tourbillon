// Browser-compatible Cloudinary utilities for image optimization.
// Accepts EITHER a Cloudinary public_id (recommended) OR a direct image URL.
// If a URL is provided, we use Cloudinary "fetch" to normalize, crop, and optimize on the fly.

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// Test function to verify Cloudinary connection
export const testCloudinaryConnection = () => {
  if (!CLOUDINARY_CLOUD_NAME) {
    console.error('❌ Cloudinary not configured: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is missing');
    return false;
  }
  
  console.log('✅ Cloudinary configured with cloud name:', CLOUDINARY_CLOUD_NAME);
  return true;
};

// Normalize possible filename inputs to Cloudinary public ID by stripping extension only
const normalizePublicId = (value: string): string => {
  if (!value) return '';
  // If caller passed folder/name or a plain name, always remove the file extension
  return value.replace(/\.[^/.]+$/, '');
};

// Quick URL detector
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

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
  // Always prefer device pixel ratio and automatic quality/format for performance
  transformations.push('dpr_auto', 'q_auto', 'f_auto');
  
  if (width || height) {
    const size = [];
    if (width) size.push(`w_${width}`);
    if (height) size.push(`h_${height}`);
    if (crop) size.push(`c_${crop}`);
    if (gravity) size.push(`g_${gravity}`);
    transformations.push(size.join(','));
  }

  // Construct the URL for upload or fetch
  const transformationString = transformations.length > 0 ? transformations.join('/') + '/' : '';
  if (isHttpUrl(publicId)) {
    const fetchBase = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch`;
    return `${fetchBase}/${transformationString}${encodeURIComponent(publicId)}`;
  }
  const uploadBase = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  return `${uploadBase}/${transformationString}${publicId}`;
};

// Predefined transformations for different use cases
export const imageTransformations = {
  // For watch cards in grid (AllWatchesSection)
  card: (value: string) =>
    getOptimizedImageUrl(normalizePublicId(value), {
      width: 400,
      height: 400,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }),

  // For Trinity Showcase (square format to match container)
  showcase: (value: string) =>
    getOptimizedImageUrl(normalizePublicId(value), {
      width: 600,
      height: 600,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }),

  // For individual watch detail pages
  detail: (value: string) =>
    getOptimizedImageUrl(normalizePublicId(value), {
      width: 1200,
      height: 1200,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }),

  // For thumbnails
  thumbnail: (value: string) =>
    getOptimizedImageUrl(normalizePublicId(value), {
      width: 200,
      height: 200,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    }),

  // For brand logos
  logo: (value: string) => {
    // Brand logos work better without transformations
    const normalizedValue = normalizePublicId(value);
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${normalizedValue}`;
  },
};

// Upload function with unique_filename: false to allow overwriting
export const uploadImage = async (
  file: File,
  options: {
    folder?: string;
    public_id?: string;
    use_filename?: boolean;
    unique_filename?: boolean;
    overwrite?: boolean;
  } = {}
) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration missing. Please check your environment variables.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  
  // Force these settings regardless of preset configuration
  formData.append('unique_filename', 'false');
  formData.append('use_filename', 'true');
  formData.append('overwrite', 'true');
  
  // Override any preset settings that might conflict
  if (options.unique_filename !== undefined) {
    formData.append('unique_filename', options.unique_filename.toString());
  }
  if (options.use_filename !== undefined) {
    formData.append('use_filename', options.use_filename.toString());
  }
  if (options.overwrite !== undefined) {
    formData.append('overwrite', options.overwrite.toString());
  }

  // Add optional parameters
  if (options.folder) {
    formData.append('folder', options.folder);
  }
  
  if (options.public_id) {
    formData.append('public_id', options.public_id);
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Helper function for uploading with specific naming strategy
export const uploadImageWithName = async (
  file: File,
  desiredName: string,
  folder?: string
) => {
  // Remove file extension from desired name
  const nameWithoutExtension = desiredName.replace(/\.[^/.]+$/, '');
  
  return await uploadImage(file, {
    folder,
    public_id: nameWithoutExtension,
    use_filename: false, // Use our custom public_id instead
    unique_filename: false,
    overwrite: true,
  });
}; 