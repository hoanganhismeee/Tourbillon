// Media utilities for watch assets.
// Image serving always uses S3/CloudFront. Cloudinary is only used for
// uploading new images from the scrape page.

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dcd9lcdoj';
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || 'd2lauyid2w6u9c.cloudfront.net';

// Bump these whenever images/videos are replaced to force CDN cache invalidation.
const IMAGE_CACHE_VERSION = 2;
const VIDEO_CACHE_VERSION = 2;

export const testCloudinaryConnection = () => {
  if (!CLOUDFRONT_DOMAIN) {
    console.error('S3 storage: NEXT_PUBLIC_CLOUDFRONT_DOMAIN is missing');
    return false;
  }
  console.log('S3 storage configured with CloudFront domain:', CLOUDFRONT_DOMAIN);
  return true;
};

// Normalizes a stored public ID into an S3 object key.
// - Backend S3 keys are stored without extensions.
// - Many assets live under a folder prefix (e.g. `watches/`).
// - Some rows may still store a bare basename (e.g. `PP6119G`) — add a default folder when missing.
const normalizePublicId = (value: string, options?: { defaultFolder?: string }): string => {
  if (!value) return '';

  // Full S3 key already (e.g. `watches/PP6119G`, `brands/rolex`)
  if (value.includes('/')) return value;

  // If caller knows the folder, apply it.
  const defaultFolder = options?.defaultFolder?.trim();
  if (defaultFolder) return `${defaultFolder}/${value}`;

  // Otherwise keep as-is.
  return value;
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

// Returns the CloudFront URL for an asset key. Full http(s) URLs are passed through unchanged.
export const getPlainStorageUrl = (publicId: string): string => {
  if (!publicId) return '';
  if (isHttpUrl(publicId)) return publicId;
  return `https://${CLOUDFRONT_DOMAIN}/${publicId}?v=${IMAGE_CACHE_VERSION}`;
};

// Returns the S3/CloudFront URL for an image.
// Width/height/crop/quality/format options are accepted for API compatibility but ignored —
// S3 serves originals only; on-the-fly transforms are not available.
export const getOptimizedImageUrl = (
  publicId: string,
  _options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    gravity?: string;
  } = {}
): string => {
  if (!publicId) return '';
  return getPlainStorageUrl(normalizePublicId(publicId, { defaultFolder: 'watches' }));
};

// Preset aliases — all return plain CloudFront URLs.
// Names are kept so call sites don't need updating.
export const imageTransformations = {
  card:      (value: string) => getPlainStorageUrl(normalizePublicId(value, { defaultFolder: 'watches' })),
  showcase:  (value: string) => getPlainStorageUrl(normalizePublicId(value, { defaultFolder: 'watches' })),
  detail:    (value: string) => getPlainStorageUrl(normalizePublicId(value, { defaultFolder: 'watches' })),
  thumbnail: (value: string) => getPlainStorageUrl(normalizePublicId(value, { defaultFolder: 'watches' })),
  logo:      (value: string) => getPlainStorageUrl(normalizePublicId(value, { defaultFolder: 'brands' })),
};

// Returns the CloudFront URL for a video asset (watches folder, mp4).
export const videoUrl = (name: string) =>
  `https://${CLOUDFRONT_DOMAIN}/watches/${name}.mp4?v=${VIDEO_CACHE_VERSION}`;

// ── Upload helpers (scrape page only) ────────────────────────────────────────

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
    throw new Error('Cloudinary upload configuration missing. Check NEXT_PUBLIC_CLOUDINARY_* env vars.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('unique_filename', 'false');
  formData.append('use_filename', 'true');
  formData.append('overwrite', 'true');

  if (options.unique_filename !== undefined) formData.append('unique_filename', options.unique_filename.toString());
  if (options.use_filename !== undefined)    formData.append('use_filename',    options.use_filename.toString());
  if (options.overwrite !== undefined)       formData.append('overwrite',       options.overwrite.toString());
  if (options.folder)                        formData.append('folder',          options.folder);
  if (options.public_id)                     formData.append('public_id',       options.public_id);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error(`Cloudinary upload failed: ${response.statusText}`);

  const result = await response.json();
  return {
    public_id:  result.public_id,
    secure_url: result.secure_url,
    url:        result.url,
    width:      result.width,
    height:     result.height,
    format:     result.format,
    bytes:      result.bytes,
  };
};

export const uploadImageWithName = async (
  file: File,
  desiredName: string,
  folder?: string
) => {
  const nameWithoutExtension = desiredName.replace(/\.[^/.]+$/, '');
  return uploadImage(file, {
    folder,
    public_id: nameWithoutExtension,
    use_filename: false,
    unique_filename: false,
    overwrite: true,
  });
};
