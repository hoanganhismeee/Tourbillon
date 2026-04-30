'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchBrands, fetchCollections,
  adminCreateCollection, adminUpdateCollection, adminDeleteCollection,
  Brand, Collection,
} from '@/lib/api';

const EMPTY: Omit<Collection, 'id'> = { name: '', slug: '', description: '', image: '', brandId: 0, style: '' };

export default function AdminCollectionsPage() {
  const { isAdmin } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState<number | ''>('');
  const [panel, setPanel] = useState<{ mode: 'add' | 'edit'; data: Omit<Collection, 'id'> & { id?: number } } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    const [c, b] = await Promise.all([fetchCollections(), fetchBrands()]);
    setCollections(c); setBrands(b); setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = collections.filter(c => {
    if (filterBrand && c.brandId !== filterBrand) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => { setErr(''); setPanel({ mode: 'add', data: { ...EMPTY } }); };
  const openEdit = (c: Collection) => { setErr(''); setPanel({ mode: 'edit', data: { ...c } }); };
  const closePanel = () => setPanel(null);

  const handleSave = async () => {
    if (!panel) return;
    if (!panel.data.name.trim()) { setErr('Name is required'); return; }
    if (!panel.data.brandId) { setErr('Brand is required'); return; }
    setSaving(true); setErr('');
    try {
      if (panel.mode === 'add') {
        await adminCreateCollection({ name: panel.data.name, brandId: panel.data.brandId, description: panel.data.description, image: panel.data.image, styles: panel.data.style ? [panel.data.style] : [] });
      } else {
        await adminUpdateCollection(panel.data.id!, { name: panel.data.name, description: panel.data.description, image: panel.data.image, styles: panel.data.style ? [panel.data.style] : [] });
      }
      closePanel();
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (c: Collection) => {
    if (!confirm(`Delete collection "${c.name}"? This will fail if it has watches.`)) return;
    try {
      await adminDeleteCollection(c.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const set = (key: keyof typeof EMPTY, val: string | number) =>
    setPanel(p => p ? { ...p, data: { ...p.data, [key]: val } } : p);

  if (loading) return <div className="p-8 text-white text-sm">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Collections</h1>
          <p className="text-[#555] text-xs mt-0.5">{filtered.length} of {collections.length} entries</p>
        </div>
        <button
          className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors"
          onClick={openAdd}
        >+ Add Collection</button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text" placeholder="Search collections..."
          className="bg-[#111] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 flex-1 focus:outline-none focus:border-[#c9a96e]"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#111] border border-[#1e1e1e] text-[#888] text-sm rounded px-3 py-1.5 focus:outline-none"
          value={filterBrand}
          onChange={e => setFilterBrand(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded border border-[#1a1a1a]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1e1e1e] bg-[#111]">
              <th className="px-3 py-2 text-[#555] font-normal">Name</th>
              <th className="px-3 py-2 text-[#555] font-normal">Brand</th>
              <th className="px-3 py-2 text-[#555] font-normal">Style</th>
              <th className="px-3 py-2 text-[#555] font-normal">Slug</th>
              <th className="px-3 py-2 text-[#555] font-normal w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-[#111] hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-white text-xs">{c.name}</td>
                <td className="px-3 py-2 text-[#666] text-xs">{brands.find(b => b.id === c.brandId)?.name ?? '—'}</td>
                <td className="px-3 py-2 text-[#666] text-xs">{c.style || '—'}</td>
                <td className="px-3 py-2 text-[#444] text-[10px] font-mono">{c.slug}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <button className="bg-[#c9a96e] text-black px-3 py-1 rounded text-xs font-medium hover:bg-[#d4b97e] transition-colors" onClick={() => openEdit(c)}>Edit</button>
                    <button className="bg-red-900/60 text-red-300 px-3 py-1 rounded text-xs hover:bg-red-800 transition-colors" onClick={() => handleDelete(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg w-full max-w-md p-6">
            <h2 className="text-white text-base font-semibold mb-4">{panel.mode === 'add' ? 'Add Collection' : 'Edit Collection'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[#555] text-xs block mb-1">Name *</label>
                <input className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e]" value={panel.data.name} onChange={e => set('name', e.target.value)} />
              </div>
              {panel.mode === 'add' && (
                <div>
                  <label className="text-[#555] text-xs block mb-1">Brand *</label>
                  <select className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-[#888] text-sm rounded px-3 py-1.5 focus:outline-none" value={panel.data.brandId} onChange={e => set('brandId', Number(e.target.value))}>
                    <option value={0}>Select brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[#555] text-xs block mb-1">Style</label>
                <input className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e]" placeholder="e.g. dress, sport, complication" value={panel.data.style ?? ''} onChange={e => set('style', e.target.value)} />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1">Description</label>
                <textarea className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e] resize-none" rows={3} value={panel.data.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1">Image key</label>
                <input className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e] font-mono" value={panel.data.image} onChange={e => set('image', e.target.value)} />
              </div>
            </div>
            {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button className="px-4 py-1.5 text-sm text-[#666] hover:text-white transition-colors" onClick={closePanel}>Cancel</button>
              <button
                className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
                onClick={handleSave} disabled={saving}
              >{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
