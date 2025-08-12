// Debug page to test Cloudinary image URLs and identify public ID mismatches
// This helps diagnose why images aren't loading by showing the exact URLs being generated

'use client';

import React, { useState } from 'react';
import { imageTransformations, getPublicId } from '@/lib/cloudinary';

const DebugImagesPage = () => {
  const [testImage, setTestImage] = useState('patekphilippe.png');
  const [testWatchImage, setTestWatchImage] = useState('PP6119G.png');
  const [baseName, setBaseName] = useState('');
  const [actualPublicId, setActualPublicId] = useState('');
  const [bulkImageNames, setBulkImageNames] = useState('');
  const [bulkResults, setBulkResults] = useState<Array<{name: string, url: string, status: 'pending' | 'success' | 'error'}>>([]);

  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  // Use a static timestamp to prevent hydration errors
  const staticTimestamp = '1754403505572';

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
      // Use static timestamp for debug page to prevent hydration errors
      const baseUrl = imageTransformations.logo(value);
      return baseUrl.replace(/\?t=\d+/, '') + `?t=${staticTimestamp}`;
    } else {
      const baseUrl = imageTransformations.card(value);
      return baseUrl.replace(/\?t=\d+/, '') + `?t=${staticTimestamp}`;
    }
  };

  const getPid = (value: string) => getPublicId(value);

  const handleAddMapping = () => {
    if (baseName && actualPublicId) {
      alert(`Mapping no longer required. Store the correct Cloudinary public_id in the database instead. Given: ${baseName} → ${actualPublicId}`);
      setBaseName('');
      setActualPublicId('');
    }
  };

  // Bulk testing function
  const handleBulkTest = () => {
    if (!bulkImageNames.trim()) return;

    // Parse the bulk input - support multiple formats
    const imageNames = bulkImageNames
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Handle different input formats
        if (line.includes('.')) {
          return line; // Already has extension
        } else {
          return line + '.png'; // Assume .png if no extension
        }
      });

    // Generate URLs for all images
    const results = imageNames.map(name => ({
      name,
      url: generateUrl(name, 'watch'),
      status: 'pending' as const
    }));

    setBulkResults(results);

    // Test each URL
    results.forEach((result, index) => {
      const img = new Image();
      img.onload = () => {
        setBulkResults(prev => 
          prev.map((r, i) => 
            i === index ? { ...r, status: 'success' as const } : r
          )
        );
      };
      img.onerror = () => {
        setBulkResults(prev => 
          prev.map((r, i) => 
            i === index ? { ...r, status: 'error' as const } : r
          )
        );
      };
      img.src = result.url;
    });
  };

  // Generate mapping suggestions for failed images
  const generateMappingSuggestions = () => {
    const failedImages = bulkResults.filter(r => r.status === 'error');
    if (failedImages.length === 0) return '';

    return failedImages.map(result => {
      const cleanName = result.name.replace(/\.[^/.]+$/, '');
      return `'${cleanName}': '${cleanName}_SUFFIX', // Replace SUFFIX with actual Cloudinary suffix`;
    }).join('\n');
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
        <h2 className="text-xl font-semibold mb-4">Bulk Image Testing</h2>
        <p className="mb-4 text-sm text-white/70">
          Paste multiple image names (one per line) to test them all at once.
        </p>
        
        <div className="space-y-4">
          <textarea
            value={bulkImageNames}
            onChange={(e) => setBulkImageNames(e.target.value)}
            className="w-full p-2 bg-black/30 border border-white/20 rounded text-white"
            rows={5}
            placeholder="e.g., PP6119G.png\nAP16202ST.png\nAP26331.png"
          />
          <button
            onClick={handleBulkTest}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
          >
            Test All Bulk Images
          </button>
        </div>

        {bulkResults.length > 0 && (
          <div className="mt-6 p-4 bg-black/10 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold mb-2">Bulk Test Results</h3>
            <div className="space-y-3">
              {bulkResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-black/5 rounded">
                  <span className="text-sm">{result.name}</span>
                  <span className={`text-sm font-medium ${
                    result.status === 'success' ? 'text-green-400' :
                    result.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
            {bulkResults.some(r => r.status === 'error') && (
              <div className="mt-4 p-3 bg-red-600/20 rounded-lg border border-red-600/30 text-red-300 text-sm">
                <h4 className="font-semibold mb-2">Failed Images:</h4>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {generateMappingSuggestions()}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-8 p-6 bg-black/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Test Cases</h2>
        <p className="mb-4 text-sm text-white/70">
          These are the image names from your CSV data. Click on any URL to test it in a new tab.
        </p>
        
        <div className="space-y-4">
                      {testCases.map((testCase, index) => {
              const publicId = getPid(testCase.value);
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
                <p><strong>Public ID:</strong> {getPid(testImage)}</p>
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
                <p><strong>Public ID:</strong> {getPid(testWatchImage)}</p>
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
          <li>Ensure your DB stores the exact Cloudinary <code>public_id</code> (no suffix mapping needed)</li>
          <li>Test again - the image should now load!</li>
        </ol>
      </div>
    </div>
  );
};

export default DebugImagesPage; 