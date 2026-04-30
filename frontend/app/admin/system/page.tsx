'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminGetEmbeddingStatus, adminGenerateEmbeddings, adminRegenerateEmbeddings,
  adminGetQueryCacheStatus, adminSeedQueryCache, adminClearQueryCache,
  adminMigrateImageUrls, adminMigrateToS3, adminNormalizeImageNames,
  adminCleanCloudinaryOrphans,
  EmbeddingStatus, QueryCacheStatus,
} from '@/lib/api';

interface CardProps {
  title: string;
  children: React.ReactNode;
}
function Card({ title, children }: CardProps) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-5">
      <h2 className="text-white text-sm font-medium mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[#111] last:border-0">
      <span className="text-[#555] text-xs">{label}</span>
      <span className="text-[#888] text-xs font-mono">{value}</span>
    </div>
  );
}

function ActionBtn({ label, onClick, danger = false, disabled = false }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50 ${danger ? 'bg-red-900/60 text-red-300 hover:bg-red-800' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
    >{label}</button>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminSystemPage() {
  const { isAdmin } = useAuth();
  const [embStatus, setEmbStatus] = useState<EmbeddingStatus | null>(null);
  const [cacheStatus, setCacheStatus] = useState<QueryCacheStatus | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) return;
    adminGetEmbeddingStatus().then(setEmbStatus).catch(() => null);
    adminGetQueryCacheStatus().then(setCacheStatus).catch(() => null);
  }, [isAdmin]);

  const act = async (key: string, fn: () => Promise<string>) => {
    setWorking(w => ({ ...w, [key]: true }));
    setMsg(m => ({ ...m, [key]: '' }));
    try {
      const m = await fn();
      setMsg(prev => ({ ...prev, [key]: m }));
    } catch (e: unknown) {
      setMsg(prev => ({ ...prev, [key]: e instanceof Error ? e.message : 'Error' }));
    } finally {
      setWorking(w => ({ ...w, [key]: false }));
    }
  };

  const handleGenerateEmbeddings = () => act('emb', async () => {
    const r = await adminGenerateEmbeddings();
    setEmbStatus(r);
    return `Generated ${r.generated} — coverage ${r.coveragePct.toFixed(0)}%`;
  });

  const handleRegenerateEmbeddings = () => act('emb-regen', async () => {
    if (!confirm('Regenerate ALL embeddings from scratch? This can take a while.')) return 'Cancelled';
    const r = await adminRegenerateEmbeddings();
    setEmbStatus(r);
    return `Regenerated ${r.regenerated} — coverage ${r.coveragePct.toFixed(0)}%`;
  });

  const handleSeedCache = () => act('cache-seed', async () => {
    const r = await adminSeedQueryCache();
    adminGetQueryCacheStatus().then(setCacheStatus).catch(() => null);
    return r.message;
  });

  const handleClearCache = () => act('cache-clear', async () => {
    if (!confirm('Clear the query cache?')) return 'Cancelled';
    const r = await adminClearQueryCache();
    adminGetQueryCacheStatus().then(setCacheStatus).catch(() => null);
    return r.message;
  });

  const handleMigrateUrls = () => act('img-urls', async () => {
    const r = await adminMigrateImageUrls(false);
    return `${r.message} (${r.count} updated)`;
  });

  const handleMigrateS3 = () => act('img-s3', async () => {
    if (!confirm('Migrate all Cloudinary-hosted images to S3? This makes real network requests.')) return 'Cancelled';
    const r = await adminMigrateToS3(false);
    return r.message ?? 'Done';
  });

  const handleNormalizeNames = () => act('img-names', async () => {
    const r = await adminNormalizeImageNames(false);
    return `${r.message} — ${r.updated} updated`;
  });

  const handleCleanOrphans = () => act('img-orphans', async () => {
    if (!confirm('Delete Cloudinary assets not referenced by any watch? Use dry run first.')) return 'Cancelled';
    const r = await adminCleanCloudinaryOrphans(false);
    return r.message;
  });

  const handleCleanOrphansDry = () => act('img-orphans-dry', async () => {
    const r = await adminCleanCloudinaryOrphans(true);
    return `Dry run: ${r.message}`;
  });

  const W = working;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">System</h1>
        <p className="text-[#555] text-xs mt-0.5">Embeddings, caches, and data maintenance</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <Card title="Watch Embeddings">
          {embStatus && (
            <div className="mb-4 space-y-0.5">
              <Stat label="Total watches" value={embStatus.total} />
              <Stat label="Embedded" value={embStatus.embedded} />
              <Stat label="Coverage" value={`${embStatus.coveragePct.toFixed(1)}%`} />
            </div>
          )}
          {embStatus && (
            <div className="mb-3 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a96e]" style={{ width: `${embStatus.coveragePct}%` }} />
            </div>
          )}
          {msg['emb'] && <p className="text-green-400 text-xs mb-3">{msg['emb']}</p>}
          {msg['emb-regen'] && <p className="text-green-400 text-xs mb-3">{msg['emb-regen']}</p>}
          <div className="flex gap-2">
            <ActionBtn label={W['emb'] ? 'Generating…' : 'Generate Missing'} onClick={handleGenerateEmbeddings} disabled={W['emb']} />
            <ActionBtn label={W['emb-regen'] ? 'Regenerating…' : 'Regenerate All'} onClick={handleRegenerateEmbeddings} disabled={W['emb-regen']} danger />
          </div>
        </Card>

        <Card title="Query Cache">
          {cacheStatus && (
            <div className="mb-4 space-y-0.5">
              <Stat label="Entries" value={cacheStatus.entries} />
              <Stat label="Size" value={formatBytes(cacheStatus.sizeBytes)} />
              {cacheStatus.message && <Stat label="Status" value={cacheStatus.message} />}
            </div>
          )}
          {msg['cache-seed'] && <p className="text-green-400 text-xs mb-3">{msg['cache-seed']}</p>}
          {msg['cache-clear'] && <p className="text-green-400 text-xs mb-3">{msg['cache-clear']}</p>}
          <div className="flex gap-2">
            <ActionBtn label={W['cache-seed'] ? 'Seeding…' : 'Seed Queries'} onClick={handleSeedCache} disabled={W['cache-seed']} />
            <ActionBtn label={W['cache-clear'] ? 'Clearing…' : 'Clear Cache'} onClick={handleClearCache} disabled={W['cache-clear']} danger />
          </div>
        </Card>

        <Card title="Image Maintenance">
          <div className="space-y-3">
            <div>
              <p className="text-[#444] text-xs mb-2">Fix legacy image URL references → public IDs</p>
              {msg['img-urls'] && <p className="text-green-400 text-xs mb-2">{msg['img-urls']}</p>}
              <ActionBtn label={W['img-urls'] ? 'Running…' : 'Migrate Image URLs'} onClick={handleMigrateUrls} disabled={W['img-urls']} />
            </div>
            <div className="border-t border-[#111] pt-3">
              <p className="text-[#444] text-xs mb-2">Normalize image filenames to brand+model convention</p>
              {msg['img-names'] && <p className="text-green-400 text-xs mb-2">{msg['img-names']}</p>}
              <ActionBtn label={W['img-names'] ? 'Running…' : 'Normalize Image Names'} onClick={handleNormalizeNames} disabled={W['img-names']} />
            </div>
          </div>
        </Card>

        <Card title="Storage Migration">
          <div className="space-y-3">
            <div>
              <p className="text-[#444] text-xs mb-2">Move all Cloudinary-hosted watch images to S3</p>
              {msg['img-s3'] && <p className="text-green-400 text-xs mb-2">{msg['img-s3']}</p>}
              <ActionBtn label={W['img-s3'] ? 'Migrating…' : 'Migrate to S3'} onClick={handleMigrateS3} disabled={W['img-s3']} danger />
            </div>
            <div className="border-t border-[#111] pt-3">
              <p className="text-[#444] text-xs mb-2">Clean Cloudinary assets with no matching watch record</p>
              {msg['img-orphans-dry'] && <p className="text-green-400 text-xs mb-2">{msg['img-orphans-dry']}</p>}
              {msg['img-orphans'] && <p className="text-green-400 text-xs mb-2">{msg['img-orphans']}</p>}
              <div className="flex gap-2">
                <ActionBtn label={W['img-orphans-dry'] ? 'Running…' : 'Dry Run'} onClick={handleCleanOrphansDry} disabled={W['img-orphans-dry']} />
                <ActionBtn label={W['img-orphans'] ? 'Deleting…' : 'Delete Orphans'} onClick={handleCleanOrphans} disabled={W['img-orphans']} danger />
              </div>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
