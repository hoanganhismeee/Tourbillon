'use client';

import { imageTransformations, testCloudinaryConnection } from '@/lib/cloudinary';
import Image from 'next/image';

export default function DebugImagesPage() {
  const cloudinaryStatus = testCloudinaryConnection();
  
  // Test URLs for brand logos
  const testBrandUrls = [
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/patekphilippe',
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/Brands/patekphilippe',
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/brands/patekphilippe',
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/patek-philippe',
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/patek_philippe',
  ];

  // Test URLs for watch images (these work)
  const testWatchUrls = [
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/AP26331',
    'https://res.cloudinary.com/dcd9lcdoj/image/upload/PP6119G',
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Cloudinary Image Debug</h1>
      
      <div className="mb-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Cloudinary Status</h2>
        <p>Status: {cloudinaryStatus ? '✅ Configured' : '❌ Not Configured'}</p>
        <p>Cloud Name: {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Brand Logo Test URLs</h2>
        <p className="mb-4 text-sm text-gray-600">
          Click on each URL to test if it loads. The working one will show the image.
        </p>
        <div className="space-y-2">
          {testBrandUrls.map((url, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {index + 1}. {url}
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Watch Image Test URLs (These Work)</h2>
        <div className="space-y-2">
          {testWatchUrls.map((url, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {index + 1}. {url}
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-yellow-100 rounded">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click on each brand logo URL above</li>
          <li>If you see the image, that's the correct public ID format</li>
          <li>If you get a 404 or 400 error, that format doesn't work</li>
          <li>Once you find the working format, we can update the code</li>
        </ol>
      </div>
    </div>
  );
} 