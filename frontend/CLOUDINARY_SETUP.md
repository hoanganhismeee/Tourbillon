# Cloudinary Integration Setup

This guide explains how to set up Cloudinary with your Tourbillon project.

## Step 1: Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Get your credentials from the dashboard

## Step 2: Environment Variables

1. Copy `env.example` to `.env.local`
2. Fill in your Cloudinary credentials:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Step 3: Upload Images

### Option A: Manual Upload
1. Go to your Cloudinary dashboard
2. Upload images to your media library
3. Copy the public ID (e.g., `watches/patek-philippe-5711`)

### Option B: Programmatic Upload
Use the upload function in `lib/cloudinary.ts`:

```typescript
import { uploadImage } from '@/lib/cloudinary';

const result = await uploadImage('path/to/image.jpg', {
  public_id: 'watches/patek-philippe-5711',
  folder: 'watches'
});
```

## Step 4: Update Database

Add the Cloudinary public ID to your watch records:

```sql
UPDATE watches 
SET image = 'watches/patek-philippe-5711' 
WHERE id = 1;
```

## Step 5: Image Transformations

The project includes predefined transformations:

- **Card**: 400x400px for grid layout
- **Showcase**: 400x320px for Trinity showcase
- **Detail**: 800x800px for product pages
- **Thumbnail**: 200x200px for small previews

## Usage Examples

```typescript
import { imageTransformations } from '@/lib/cloudinary';

// For watch cards
const cardImage = imageTransformations.card('watches/patek-philippe-5711');

// For detail pages
const detailImage = imageTransformations.detail('watches/patek-philippe-5711');

// Custom transformation
import { getOptimizedImageUrl } from '@/lib/cloudinary';
const customImage = getOptimizedImageUrl('watches/patek-philippe-5711', {
  width: 600,
  height: 600,
  crop: 'fill',
  quality: 'auto'
});
```

## Benefits

- ✅ **Automatic optimization**: Cloudinary serves the best format per browser
- ✅ **Responsive images**: Different sizes for different contexts
- ✅ **Fast loading**: Optimized file sizes
- ✅ **CDN delivery**: Global content delivery network
- ✅ **Format conversion**: Automatic AVIF/WebP/JPG delivery

## File Naming Convention

Use consistent naming for your images:
- `watches/patek-philippe-5711`
- `watches/rolex-submariner-126610`
- `brands/patek-philippe-logo`
- `collections/nautilus-collection`

This makes it easy to manage and reference images in your code. 