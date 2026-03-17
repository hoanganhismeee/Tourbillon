'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { adminFetchWatches, fetchBrands, fetchCollections, deleteWatch, Watch, Brand, Collection } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import WatchEditorModal from './components/WatchEditorModal';
import AddWatchModal from './components/AddWatchModal';

export default function ScrapeAdminPage() {
    const [watches, setWatches] = useState<Watch[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    
    const [selectedBrand, setSelectedBrand] = useState<number | ''>('');
    const [selectedCollection, setSelectedCollection] = useState<number | ''>('');
    
    const [loading, setLoading] = useState(true);
    const [editingWatch, setEditingWatch] = useState<Watch | null>(null);
    const [addingWatch, setAddingWatch] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [watchesData, brandsData, colsData] = await Promise.all([
                adminFetchWatches(),
                fetchBrands(),
                fetchCollections()
            ]);
            setWatches(watchesData);
            setBrands(brandsData);
            setCollections(colsData);
        } catch (error) {
            console.error('Failed to load initial data', error);
        } finally {
            setLoading(false);
        }
    };

    const reloadWatches = async () => {
        try {
            const data = await adminFetchWatches();
            setWatches(data);
        } catch (error) {
            console.error('Failed to reload watches', error);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = () => {
        setEditingWatch(null);
        reloadWatches();
    };

    const handleDelete = async (w: Watch) => {
        if (!confirm(`Delete "${w.name}" (ID ${w.id})?`)) return;
        await deleteWatch(w.id);
        reloadWatches();
    };

    const filteredWatches = useMemo(() => {
        return watches.filter(w => {
            if (selectedBrand && w.brandId !== selectedBrand) return false;
            if (selectedCollection && w.collectionId !== selectedCollection) return false;
            return true;
        });
    }, [watches, selectedBrand, selectedCollection]);

    if (loading) {
        return <div className="text-white p-8">Loading Review Studio...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-white mb-6">Watch Review Studio</h1>

            <div className="flex gap-4 mb-6">
                <select 
                    className="bg-black/60 border border-white/20 text-white rounded p-2 focus:outline-none focus:border-[#f0e6d2] transition-colors"
                    value={selectedBrand}
                    onChange={(e) => {
                        setSelectedBrand(e.target.value ? Number(e.target.value) : '');
                        setSelectedCollection(''); 
                    }}
                >
                    <option value="">All Brands</option>
                    {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>

                <select 
                    className="bg-black/60 border border-white/20 text-white rounded p-2 focus:outline-none focus:border-[#f0e6d2] transition-colors"
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value ? Number(e.target.value) : '')}
                    disabled={!selectedBrand}
                >
                    <option value="">All Collections</option>
                    {collections
                        .filter(c => !selectedBrand || c.brandId === selectedBrand)
                        .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <div className="text-gray-400 self-center">
                    Showing {filteredWatches.length} watches
                </div>

                <button
                    className="ml-auto bg-[#f0e6d2] text-black px-5 py-2 rounded font-medium hover:bg-white transition-colors"
                    onClick={() => setAddingWatch(true)}
                >
                    + Add Watch
                </button>
            </div>

            <div className="overflow-x-auto bg-black/40 rounded border border-white/20">
                <table className="w-full text-left text-white border-collapse">
                    <thead>
                        <tr className="border-b border-white/20 bg-white/5">
                            <th className="p-3">ID</th>
                            <th className="p-3">Image</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Collection</th>
                            <th className="p-3">Price</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredWatches.map(w => (
                            <tr key={w.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="p-3">{w.id}</td>
                                <td className="p-3">
                                    {w.image ? (
                                        <img
                                            src={w.image.startsWith('http') ? w.image : imageTransformations.thumbnail(w.image)}
                                            alt={w.name}
                                            width={60}
                                            height={60}
                                            className="rounded object-cover"
                                            onError={(e) => {
                                                // Fallback if transformation fails
                                                if (!e.currentTarget.src.includes('upload/')) {
                                                    e.currentTarget.src = w.image;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span className="text-gray-500">No Image</span>
                                    )}
                                </td>
                                <td className="p-3">{w.name}</td>
                                <td className="p-3 text-gray-400">{collections.find(c => c.id === w.collectionId)?.name ?? '—'}</td>
                                <td className="p-3">{w.currentPrice === 0 ? 'Price on request' : `$${w.currentPrice.toLocaleString()}`}</td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        <button
                                            className="bg-[#f0e6d2] text-black px-4 py-1 rounded font-medium hover:bg-white transition-colors"
                                            onClick={() => setEditingWatch(w)}
                                        >
                                            Review / Edit
                                        </button>
                                        <button
                                            className="bg-red-900/60 text-red-200 px-4 py-1 rounded font-medium hover:bg-red-700 transition-colors"
                                            onClick={() => handleDelete(w)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {editingWatch && (
                <WatchEditorModal
                    watch={editingWatch}
                    onClose={() => setEditingWatch(null)}
                    onSave={handleSave}
                />
            )}

            {addingWatch && (
                <AddWatchModal
                    brands={brands}
                    collections={collections}
                    onClose={() => setAddingWatch(false)}
                    onSave={() => { setAddingWatch(false); reloadWatches(); }}
                />
            )}
        </div>
    );
}
