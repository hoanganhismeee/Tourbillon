// Debug page to test Cloudinary image URLs and identify public ID mismatches
// This helps diagnose why images aren't loading by showing the exact URLs being generated

'use client';

import React, { useState } from 'react';
import { imageTransformations, toPublicId, addSuffixMapping } from '@/lib/cloudinary';

const DebugImagesPage = () => {
  const [testImage, setTestImage] = useState('patekphilippe.png');
  const [testWatchImage, setTestWatchImage] = useState('PP6119G.png');
  const [baseName, setBaseName] = useState('');
  const [actualPublicId, setActualPublicId] = useState('');

  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const testCases: Array<{ name: string; value: string; type: 'logo' | 'watch' }> = [
    // Brand logos
    { name: 'Patek Philippe', value: 'patekphilippe.png', type: 'logo' },
    { name: 'Vacheron Constantin', value: 'vacheronconstantin.png', type: 'logo' },
    { name: 'Audemars Piguet', value: 'audemarspiguet.png', type: 'logo' },
    { name: 'Rolex', value: 'rolex.png', type: 'logo' },
    
    // Watch images
    { name: 'PP6119G', value: 'PP6119G.png', type: 'watch' },
    { name: 'AP16202ST', value: 'AP16202ST.png', type: 'watch' },
    { name: 'AP26331', value: 'AP26331', type: 'watch' },
         { name: 'JLCchrono', value: 'JLCchronograph', type: 'watch' },
  ];

  const generateUrl = (value: string, type: 'logo' | 'watch') => {
    if (type === 'logo') {
      return imageTransformations.logo(value);
    } else {
      return imageTransformations.card(value);
    }
  };

  const getPublicId = (value: string) => {
    // Both logos and watches use the same function now since they're all in root folder
    return toPublicId(value);
  };

  const handleAddMapping = () => {
    if (baseName && actualPublicId) {
      addSuffixMapping(baseName, actualPublicId);
      alert(`Mapping added: ${baseName} → ${actualPublicId}\n\nNow update the suffixMapping object in cloudinary.ts with this mapping.`);
      setBaseName('');
      setActualPublicId('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-8">Cloudinary Image Debug</h1>
      
      <div className="mb-8 p-6 bg-black/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Environment Info</h2>
        <p><strong>Cloud Name:</strong> {CLOUDINARY_CLOUD_NAME || 'Not configured'}</p>
        <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
      </div>

      <div className="mb-8 p-6 bg-black/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Suffix Mapping Helper</h2>
        <p className="mb-4 text-sm text-white/70">
          Use this to add mappings for Cloudinary assets with auto-generated suffixes.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Base Name (from database):</label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="w-full p-2 bg-black/30 border border-white/20 rounded text-white"
              placeholder="e.g., PP3029"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Actual Public ID (from Cloudinary):</label>
            <input
              type="text"
              value={actualPublicId}
              onChange={(e) => setActualPublicId(e.target.value)}
              className="w-full p-2 bg-black/30 border border-white/20 rounded text-white"
              placeholder="e.g., PP3029_ejwq2"
            />
          </div>
          
          <button
            onClick={handleAddMapping}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
          >
            Add Mapping
          </button>
        </div>
      </div>

      <div className="mb-8 p-6 bg-black/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Test Cases</h2>
        <p className="mb-4 text-sm text-white/70">
          These are the image names from your CSV data. Click on any URL to test it in a new tab.
        </p>
        
        <div className="space-y-4">
                      {testCases.map((testCase, index) => {
              const publicId = getPublicId(testCase.value);
              const url = generateUrl(testCase.value, testCase.type);
              
              return (
                <div key={index} className="p-4 bg-black/10 rounded border border-white/10">
                  <h3 className="font-semibold mb-2">{testCase.name}</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Original Value:</strong> {testCase.value}</p>
                    <p><strong>Generated Public ID:</strong> {publicId}</p>
                    <p><strong>Full URL:</strong></p>
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-2 bg-blue-600/20 rounded text-blue-300 hover:bg-blue-600/30 transition-colors"
                    >
                      {url}
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="mb-8 p-6 bg-black/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Manual Test</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Brand Image:</label>
            <input
              type="text"
              value={testImage}
              onChange={(e) => setTestImage(e.target.value)}
              className="w-full p-2 bg-black/30 border border-white/20 rounded text-white"
              placeholder="e.g., patekphilippe.png"
            />
                          <div className="mt-2">
                <p><strong>Public ID:</strong> {toPublicId(testImage)}</p>
                <p><strong>URL:</strong> {imageTransformations.logo(testImage)}</p>
              </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Test Watch Image:</label>
            <input
              type="text"
              value={testWatchImage}
              onChange={(e) => setTestWatchImage(e.target.value)}
              className="w-full p-2 bg-black/30 border border-white/20 rounded text-white"
              placeholder="e.g., PP6119G.png"
            />
                          <div className="mt-2">
                <p><strong>Public ID:</strong> {toPublicId(testWatchImage)}</p>
                <p><strong>URL:</strong> {imageTransformations.card(testWatchImage)}</p>
              </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-yellow-600/20 rounded-lg border border-yellow-600/30">
        <h2 className="text-xl font-semibold mb-4 text-yellow-300">How to Use This</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Click on each URL above to see if it loads in a new tab</li>
          <li>If you get 404 errors, the public ID doesn&apos;t exist in Cloudinary</li>
          <li>Check your Cloudinary Media Library for the exact public IDs</li>
          <li>Use the &quot;Suffix Mapping Helper&quot; above to add mappings</li>
          <li>Copy the mapping to the <code>suffixMapping</code> object in <code>cloudinary.ts</code></li>
          <li>Test again - the image should now load!</li>
        </ol>
      </div>
    </div>
  );
};

export default DebugImagesPage; 