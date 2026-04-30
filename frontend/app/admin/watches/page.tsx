'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminFetchWatches, adminRefreshImageCache, fetchBrands, fetchCollections,
  deleteWatch, Watch, Brand, Collection,
} from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import WatchEditorModal from './components/WatchEditorModal';
import AddWatchModal from './components/AddWatchModal';

export default function AdminWatchesPage() {
  const { isAdmin } = useAuth();

  const [watches, setWatches] = useState<Watch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<number | ''>('');
  const [selectedCollection, setSelectedCollection] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingWatch, setEditingWatch] = useState<Watch | null>(null);
  const [addingWatch, setAddingWatch] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [cacheMsg, setCacheMsg] = useState('');

  const filtered = useMemo(() => watches.filter(w => {
    if (selectedBrand && w.brandId !== selectedBrand) return false;
    if (selectedCollection && w.collectionId !== selectedCollection) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) &&
        !(w.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [watches, selectedBrand, selectedCollection, search]);

  const loadData = async () => {
    setLoading(true);
    const [w, b, c] = await Promise.all([adminFetchWatches(), fetchBrands(), fetchCollections()]);
    setWatches(w); setBrands(b); setCollections(c);
    setLoading(false);
  };

  const reloadWatches = async () => setWatches(await adminFetchWatches());

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  const handleDelete = async (w: Watch) => {
    if (!confirm(`Delete "${w.name}" (ID ${w.id})?`)) return;
    await deleteWatch(w.id);
    reloadWatches();
  };

  const handleRefreshCache = async () => {
    const brandId = selectedBrand || undefined;
    const scope = brandId ? brands.find(b => b.id === brandId)?.name : 'all brands';
    if (!confirm(`Bump image cache version for ${scope}?`)) return;
    setRefreshingCache(true); setCacheMsg('');
    try {
      const r = await adminRefreshImageCache(brandId);
      setCacheMsg(`Updated ${r.updated} watches (v${r.version})`);
    } catch (e: unknown) {
      setCacheMsg(e instanceof Error ? e.message : 'Failed');
    } finally { setRefreshingCache(false); }
  };

  if (loading) return <div className="p-8 text-white text-sm">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Watches</h1>
          <p className="text-[#555] text-xs mt-0.5">{filtered.length} of {watches.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          {cacheMsg && <span className="text-xs text-green-400">{cacheMsg}</span>}
          <button
            className="bg-white/10 text-gray-300 px-4 py-1.5 rounded text-sm hover:bg-white/20 transition-colors disabled:opacity-50"
            onClick={handleRefreshCache} disabled={refreshingCache}
          >
            {refreshingCache ? 'Refreshing...' : 'Refresh Cache'}
          </button>
          <button
            className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors"
            onClick={() => setAddingWatch(true)}
          >
            + Add Watch
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text" placeholder="Search watches..."
          className="bg-[#111] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 flex-1 focus:outline-none focus:border-[#c9a96e]"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#111] border border-[#1e1e1e] text-[#888] text-sm rounded px-3 py-1.5 focus:outline-none"
          value={selectedBrand}
          onChange={e => { setSelectedBrand(e.target.value ? Number(e.target.value) : ''); setSelectedCollection(''); }}
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          className="bg-[#111] border border-[#1e1e1e] text-[#888] text-sm rounded px-3 py-1.5 focus:outline-none disabled:opacity-40"
          value={selectedCollection}
          onChange={e => setSelectedCollection(e.target.value ? Number(e.target.value) : '')}
          disabled={!selectedBrand}
        >
          <option value="">All Collections</option>
          {collections.filter(c => !selectedBrand || c.brandId === selectedBrand).map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>
          )}
        </select>
      </div>

      <div className="overflow-x-auto rounded border border-[#1a1a1a]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1e1e1e] bg-[#111]">
              <th className="px-3 py-2 text-[#555] font-normal w-14">Image</th>
              <th className="px-3 py-2 text-[#555] font-normal">Reference</th>
              <th className="px-3 py-2 text-[#555] font-normal">Collection</th>
              <th className="px-3 py-2 text-[#555] font-normal w-32">Price</th>
              <th className="px-3 py-2 text-[#555] font-normal w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id} className="border-b border-[#111] hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  {w.image ? (
                    <img
                      src={w.imageUrl || (w.image.startsWith('http') ? w.image : imageTransformations.thumbnail(w.image))}
                      alt={w.name} width={48} height={48}
                      className="rounded object-contain"
                      onError={e => { e.currentTarget.src = w.image; }}
                    />
                  ) : <div className="w-12 h-12 bg-[#1a1a1a] rounded" />}
                </td>
                <td className="px-3 py-2">
                  <div className="text-white text-xs">{w.name}</div>
                  <div className="text-[#555] text-[10px]">{brands.find(b => b.id === w.brandId)?.name}</div>
                </td>
                <td className="px-3 py-2 text-[#666] text-xs">{collections.find(c => c.id === w.collectionId)?.name ?? '—'}</td>
                <td className="px-3 py-2 text-[#666] text-xs">
                  {w.currentPrice === 0 ? 'Price on request' : `$${w.currentPrice.toLocaleString()}`}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <button
                      className="bg-[#c9a96e] text-black px-3 py-1 rounded text-xs font-medium hover:bg-[#d4b97e] transition-colors"
                      onClick={() => setEditingWatch(w)}
                    >Edit</button>
                    <button
                      className="bg-red-900/60 text-red-300 px-3 py-1 rounded text-xs hover:bg-red-800 transition-colors"
                      onClick={() => handleDelete(w)}
                    >Delete</button>
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
          onSave={() => { setEditingWatch(null); reloadWatches(); }}
        />
      )}
      {addingWatch && (
        <AddWatchModal
          brands={brands} collections={collections}
          onClose={() => setAddingWatch(false)}
          onSave={() => { setAddingWatch(false); reloadWatches(); }}
        />
      )}
    </div>
  );
}
