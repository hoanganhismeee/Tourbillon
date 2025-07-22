// displaying the details of a single watch.
// It fetches the watch data based on the ID from the URL and presents it
// in a structured and styled layout.
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchWatchById, Watch } from '@/lib/api';

const WatchDetailPage = () => {
  const params = useParams(); // Hook to access the dynamic URL parameters.
  const watchId = Array.isArray(params.watchId) ? params.watchId[0] : params.watchId;

  const [watch, setWatch] = useState<Watch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!watchId) return;

    const getWatchData = async () => { // Fetches the data for the specific watch.
      try {
        setLoading(true);
        const numericWatchId = parseInt(watchId, 10);

        if (isNaN(numericWatchId)) {
          throw new Error('Invalid Watch ID');
        }

        const watchData = await fetchWatchById(numericWatchId);
        setWatch(watchData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    getWatchData();
  }, [watchId]);

  if (loading) {
    return <div className="container mx-auto px-8 py-24 pt-32 text-center tourbillon-text-color">Loading watch details...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-8 py-24 pt-32 text-center text-red-500">Error: {error}</div>;
  }

  if (!watch) {
    return <div className="container mx-auto px-8 py-24 pt-32 text-center tourbillon-text-color">Watch not found.</div>;
  }

  return (
    <div className="container mx-auto px-8 py-24 pt-32">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Watch Image */}
        <div>
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
            {/* Placeholder for image */}
            <div className="w-full h-96 bg-gray-700 rounded-md flex items-center justify-center">
              <span className="text-gray-400">Image of {watch.name}</span>
            </div>
          </div>
        </div>

        {/* Watch Details */}
        <div className="tourbillon-text-color">
          <h1 className="text-5xl font-playfair font-bold mb-4">{watch.name}</h1>
          <p className="text-2xl font-semibold text-gray-300 mb-6">${watch.currentPrice.toLocaleString()}</p>
          <p className="text-lg text-gray-400 leading-relaxed mb-8">{watch.description}</p>
          
          <button className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchDetailPage; 