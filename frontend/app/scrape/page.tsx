'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetchWatches, adminFetchWatchById, adminUpdateEditorial, fetchBrands, fetchCollections, deleteWatch, Watch, WatchEditorialContent, Brand, Collection } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import WatchEditorModal from './components/WatchEditorModal';
import AddWatchModal from './components/AddWatchModal';

export default function ScrapeAdminPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [watches, setWatches] = useState<Watch[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<number | ''>('');
    const [selectedCollection, setSelectedCollection] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [editingWatch, setEditingWatch] = useState<Watch | null>(null);
    const [addingWatch, setAddingWatch] = useState(false);

    // Inline editorial editing
    const [editorialWatchId, setEditorialWatchId] = useState<number | null>(null);
    const [editorialMap, setEditorialMap] = useState<Record<number, WatchEditorialContent>>({});
    const [editorialLoading, setEditorialLoading] = useState(false);
    const [editorialSaving, setEditorialSaving] = useState(false);
    const [editorialError, setEditorialError] = useState('');

    const filteredWatches = useMemo(() => {
        return watches.filter(w => {
            if (selectedBrand && w.brandId !== selectedBrand) return false;
            if (selectedCollection && w.collectionId !== selectedCollection) return false;
            return true;
        });
    }, [watches, selectedBrand, selectedCollection]);

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
        if (!authLoading && !isAdmin) router.replace('/');
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) loadData();
    }, [isAdmin]);

    const handleSave = () => {
        setEditingWatch(null);
        reloadWatches();
    };

    const handleToggleEditorial = async (watchId: number) => {
        if (editorialWatchId === watchId) { setEditorialWatchId(null); return; }
        setEditorialWatchId(watchId);
        setEditorialError('');
        if (!editorialMap[watchId]) {
            setEditorialLoading(true);
            try {
                const data = await adminFetchWatchById(watchId);
                setEditorialMap(prev => ({ ...prev, [watchId]: data.editorialContent ?? { whyItMatters: '', collectorAppeal: '', designLanguage: '', bestFor: '' } }));
            } finally {
                setEditorialLoading(false);
            }
        }
    };

    const handleSaveEditorial = async (watchId: number) => {
        setEditorialSaving(true);
        setEditorialError('');
        try {
            await adminUpdateEditorial(watchId, editorialMap[watchId]);
        } catch (err: unknown) {
            setEditorialError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setEditorialSaving(false);
        }
    };

    const handleDelete = async (w: Watch) => {
        if (!confirm(`Delete "${w.name}" (ID ${w.id})?`)) return;
        await deleteWatch(w.id);
        reloadWatches();
    };

    if (authLoading || !isAdmin) return null;

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
                            <React.Fragment key={w.id}>
                            <tr className="border-b border-white/10 hover:bg-white/5">
                                <td className="p-3">{w.id}</td>
                                <td className="p-3">
                                    {w.image ? (
                                        <img
                                            src={w.imageUrl || (w.image.startsWith('http') ? w.image : imageTransformations.thumbnail(w.image))}
                                            alt={w.name}
                                            width={60}
                                            height={60}
                                            className="rounded object-contain"
                                            onError={(e) => {
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
                                            className={`px-4 py-1 rounded font-medium transition-colors ${editorialWatchId === w.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                            onClick={() => handleToggleEditorial(w.id)}
                                        >
                                            Editorial
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
                            {editorialWatchId === w.id && (
                                <tr className="border-b border-white/10 bg-white/[0.02]">
                                    <td colSpan={6} className="p-4">
                                        {editorialLoading ? (
                                            <div className="text-gray-400 text-sm">Loading...</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                {(['whyItMatters', 'collectorAppeal', 'designLanguage', 'bestFor'] as const).map(key => (
                                                    <div key={key}>
                                                        <label className="block text-xs text-gray-500 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                                        <textarea
                                                            className="w-full h-28 bg-black/60 border border-white/20 rounded p-2 text-white text-sm resize-none"
                                                            value={editorialMap[w.id]?.[key] ?? ''}
                                                            onChange={e => setEditorialMap(prev => ({ ...prev, [w.id]: { ...prev[w.id], [key]: e.target.value } }))}
                                                        />
                                                    </div>
                                                ))}
                                                <div className="col-span-2 flex items-center justify-between">
                                                    {editorialError && <span className="text-red-400 text-sm">{editorialError}</span>}
                                                    <button
                                                        className="ml-auto px-5 py-1.5 bg-[#f0e6d2] text-black rounded font-medium text-sm disabled:opacity-50"
                                                        onClick={() => handleSaveEditorial(w.id)}
                                                        disabled={editorialSaving}
                                                    >
                                                        {editorialSaving ? 'Saving...' : 'Save Editorial'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
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
