// This component displays the detailed product page for a single watch.
// It fetches watch data based on the dynamic ID from the URL and presents it in a two-column layout
// with an image, description, specifications, and purchasing options.

'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Watch, fetchWatchById } from '@/lib/api';
import { ShoppingCartIcon } from '@heroicons/react/24/outline'; // Using outline icons for a cleaner look

const WatchDetailPage = () => {
    const params = useParams();
    const watchId = params.watchId as string;
    const [watch, setWatch] = useState<Watch | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (watchId) {
            const getWatchDetails = async () => {
                try {
                    // Convert the watchId from string to number before fetching
                    const numericWatchId = parseInt(watchId, 10);
                    if (isNaN(numericWatchId)) {
                        setError('Invalid watch ID.');
                        return;
                    }
                    const data = await fetchWatchById(numericWatchId);
                    setWatch(data);
                } catch (err) {
                    setError('Failed to fetch watch details. Please try again later.');
                    console.error(err);
                }
            };
            getWatchDetails();
        }
    }, [watchId]);

    if (error) {
        return <div className="flex justify-center items-center min-h-screen text-red-400">{error}</div>;
    }

    if (!watch) {
        return <div className="flex justify-center items-center min-h-screen text-white/80">Loading watch...</div>;
    }

    // Dummy data for specs - replace with actual data from your model if available
    const specifications = [
        { name: 'Reference', value: `REF-${watch.id}` },
        { name: 'Case Material', value: 'Stainless Steel' },
        { name: 'Diameter', value: '41mm' },
        { name: 'Movement', value: 'Automatic' },
        { name: 'Water Resistance', value: '100m' },
    ];

    return (
        <div className="container mx-auto px-4 sm:px-8 py-24 pt-48 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
                {/* Left Column: Watch Image */}
                <div className="flex justify-center items-start">
                    <div className="sticky top-32 w-full max-w-md bg-black/20 p-8 rounded-xl border border-white/10">
                        {/* Placeholder for the image */}
                        <div className="aspect-square bg-white/5 flex items-center justify-center rounded-lg">
                            <span className="text-white/40">Image of {watch.name}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Details & Actions */}
                <div className="pt-8">
                    <h1 className="text-4xl lg:text-5xl font-playfair font-bold text-[#f0e6d2] mb-4">{watch.name}</h1>
                    <p className="text-lg text-white/70 mb-8">{watch.description || 'No description available.'}</p>

                    <div className="mb-8">
                        <span className="text-4xl font-semibold text-white">
                            ${watch.currentPrice.toLocaleString()}
                        </span>
                        <p className="text-sm text-white/50 mt-1">Price subject to market changes</p>
                    </div>

                    <div className="flex items-center gap-4 mb-10">
                        <button className="flex-grow py-4 px-8 rounded-xl font-semibold bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] text-[#1e1512] hover:opacity-90 transition flex items-center justify-center gap-3">
                            <ShoppingCartIcon className="h-6 w-6" />
                            <span>Add to Cart</span>
                        </button>
                        <button className="py-4 px-8 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition">
                            Contact Advisor
                        </button>
                    </div>

                    {/* Specifications */}
                    <div>
                        <h2 className="text-2xl font-playfair font-semibold border-b border-white/10 pb-3 mb-4">Specifications</h2>
                        <table className="w-full text-left">
                            <tbody>
                                {specifications.map((spec) => (
                                    <tr key={spec.name} className="border-b border-white/5">
                                        <td className="py-3 pr-4 text-white/60">{spec.name}</td>
                                        <td className="py-3 text-white/90 font-medium">{spec.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WatchDetailPage; 