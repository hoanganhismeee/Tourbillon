'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminFetchWatches, adminGetEditorialStatus, adminSeedEditorial, adminClearEditorial,
  adminUpdateEditorial, Watch, WatchEditorialContent, EditorialStatus,
} from '@/lib/api';

const EMPTY_EDITORIAL: WatchEditorialContent = {
  whyItMatters: '', collectorAppeal: '', designLanguage: '', bestFor: '',
};

export default function AdminEditorialPage() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<EditorialStatus | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ watch: Watch; content: WatchEditorialContent } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [w, s] = await Promise.all([adminFetchWatches(), adminGetEditorialStatus()]);
    setWatches(w); setStatus(s); setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = watches.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()) || (w.description ?? '').toLowerCase().includes(search.toLowerCase()));

  const openEdit = (w: Watch) => setEditing({ watch: w, content: w.editorialContent ? { ...w.editorialContent } : { ...EMPTY_EDITORIAL } });

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminUpdateEditorial(editing.watch.id, editing.content);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSeed = async () => {
    if (!confirm('Enqueue editorial generation for all watches without content? This runs in the background.')) return;
    setWorking(true); setActionMsg('');
    try {
      const r = await adminSeedEditorial();
      setActionMsg(r.message);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    } finally { setWorking(false); }
  };

  const handleClear = async () => {
    if (!confirm('Delete all editorial content? This cannot be undone.')) return;
    setWorking(true); setActionMsg('');
    try {
      const r = await adminClearEditorial();
      setActionMsg(`Deleted ${r.deleted} records`);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    } finally { setWorking(false); }
  };

  const set = (key: keyof WatchEditorialContent, val: string) =>
    setEditing(e => e ? { ...e, content: { ...e.content, [key]: val } } : e);

  if (loading) return <div className="p-8 text-white text-sm">Loading...</div>;

  const coverage = status ? `${status.withEditorial}/${status.total} (${status.coveragePct.toFixed(0)}%)` : '—';

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Editorial</h1>
          <p className="text-[#555] text-xs mt-0.5">Coverage: {coverage}</p>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-xs text-green-400">{actionMsg}</span>}
          <button
            className="bg-white/10 text-red-300 px-3 py-1.5 rounded text-sm hover:bg-red-900/40 transition-colors disabled:opacity-50"
            onClick={handleClear} disabled={working}
          >Clear All</button>
          <button
            className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
            onClick={handleSeed} disabled={working}
          >{working ? 'Working…' : 'Seed Missing'}</button>
        </div>
      </div>

      {status && (
        <div className="mb-4 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden w-full max-w-md">
          <div className="h-full bg-[#c9a96e] transition-all" style={{ width: `${status.coveragePct}%` }} />
        </div>
      )}

      <div className="mb-4">
        <input
          type="text" placeholder="Search watches..."
          className="bg-[#111] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 w-80 focus:outline-none focus:border-[#c9a96e]"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded border border-[#1a1a1a]">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#1e1e1e] bg-[#111]">
              <th className="px-3 py-2 text-[#555] font-normal">Watch</th>
              <th className="px-3 py-2 text-[#555] font-normal w-24">Status</th>
              <th className="px-3 py-2 text-[#555] font-normal w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id} className="border-b border-[#111] hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <div className="text-white text-xs">{w.name}</div>
                  <div className="text-[#555] text-[10px]">{w.description}</div>
                </td>
                <td className="px-3 py-2">
                  {w.editorialContent ? (
                    <span className="text-green-500 text-[10px]">Done</span>
                  ) : (
                    <span className="text-[#444] text-[10px]">Missing</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    className="bg-[#c9a96e] text-black px-3 py-1 rounded text-xs font-medium hover:bg-[#d4b97e] transition-colors"
                    onClick={() => openEdit(w)}
                  >Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white text-base font-semibold mb-1">Editorial — {editing.watch.name}</h2>
            <p className="text-[#555] text-xs mb-4">{editing.watch.description}</p>
            <div className="space-y-4">
              {([
                ['whyItMatters', 'Why It Matters'],
                ['collectorAppeal', 'Collector Appeal'],
                ['designLanguage', 'Design Language'],
                ['bestFor', 'Best For'],
              ] as [keyof WatchEditorialContent, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[#555] text-xs block mb-1">{label}</label>
                  <textarea
                    className="w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-[#c9a96e] resize-none"
                    rows={3}
                    value={editing.content[key]}
                    onChange={e => set(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="px-4 py-1.5 text-sm text-[#666] hover:text-white transition-colors" onClick={() => setEditing(null)}>Cancel</button>
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
