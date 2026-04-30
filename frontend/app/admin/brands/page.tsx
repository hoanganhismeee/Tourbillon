'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBrands, adminCreateBrand, adminUpdateBrand, adminDeleteBrand, Brand } from '@/lib/api';

const EMPTY: Omit<Brand, 'id'> = { name: '', slug: '', description: '', image: '', summary: '' };

export default function AdminBrandsPage() {
  const { isAdmin } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<{ mode: 'add' | 'edit'; data: Omit<Brand, 'id'> & { id?: number } } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => { setLoading(true); setBrands(await fetchBrands()); setLoading(false); };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = brands.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setErr(''); setPanel({ mode: 'add', data: { ...EMPTY } }); };
  const openEdit = (b: Brand) => { setErr(''); setPanel({ mode: 'edit', data: { ...b } }); };
  const closePanel = () => setPanel(null);

  const handleSave = async () => {
    if (!panel) return;
    if (!panel.data.name.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    try {
      if (panel.mode === 'add') {
        await adminCreateBrand({ name: panel.data.name, description: panel.data.description, image: panel.data.image, summary: panel.data.summary });
      } else {
        await adminUpdateBrand(panel.data.id!, { name: panel.data.name, description: panel.data.description, image: panel.data.image, summary: panel.data.summary });
      }
      closePanel();
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (b: Brand) => {
    if (!confirm(`Delete brand "${b.name}"? This will fail if it has watches or collections.`)) return;
    try {
      await adminDeleteBrand(b.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const set = (key: keyof typeof EMPTY, val: string) =>
    setPanel(p => p ? { ...p, data: { ...p.data, [key]: val } } : p);

  if (loading) return <div className="p-8 text-white text-sm">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Brands</h1>
          <p className="text-[#555] text-xs mt-0.5">{filtered.length} of {brands.length} entries</p>
        </div>
        <button
          className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors"
          onClick={openAdd}
        >+ Add Brand</button>
      </div>

      <div className="mb-4">
        <input
          type="text" placeholder="Search brands..."
          className="bg-[#111] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 w-80 focus:outline-none focus:border-[#c9a96e]"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded border border-[#1a1a1a]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1e1e1e] bg-[#111]">
              <th className="px-3 py-2 text-[#555] font-normal">Name</th>
              <th className="px-3 py-2 text-[#555] font-normal">Slug</th>
              <th className="px-3 py-2 text-[#555] font-normal">Image key</th>
              <th className="px-3 py-2 text-[#555] font-normal w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-b border-[#111] hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-white text-xs">{b.name}</td>
                <td className="px-3 py-2 text-[#444] text-[10px] font-mono">{b.slug}</td>
                <td className="px-3 py-2 text-[#444] text-[10px] font-mono">{b.image || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <button className="bg-[#c9a96e] text-black px-3 py-1 rounded text-xs font-medium hover:bg-[#d4b97e] transition-colors" onClick={() => openEdit(b)}>Edit</button>
                    <button className="bg-red-900/60 text-red-300 px-3 py-1 rounded text-xs hover:bg-red-800 transition-colors" onClick={() => handleDelete(b)}>Delete</button>
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
            <h2 className="text-white text-base font-semibold mb-4">{panel.mode === 'add' ? 'Add Brand' : 'Edit Brand'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[#555] text-xs block mb-1">Name *</label>
                <input className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e]" value={panel.data.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1">Description</label>
                <textarea className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e] resize-none" rows={3} value={panel.data.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className="text-[#555] text-xs block mb-1">Summary</label>
                <textarea className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e] resize-none" rows={2} value={panel.data.summary} onChange={e => set('summary', e.target.value)} />
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
