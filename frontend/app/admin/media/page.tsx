'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminFetchMediaAssets, adminGetVideoPresignedUrl, adminConfirmVideoUpload,
  adminStageOnCloudinary, adminConfirmMediaImageUpload, adminDeleteMediaAsset,
  MediaAsset,
} from '@/lib/api';

type UploadState = { phase: 'idle' | 'staging' | 'uploading' | 'done' | 'error'; progress: number; message: string };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminMediaPage() {
  const { isAdmin } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [lightbox, setLightbox] = useState<MediaAsset | null>(null);
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle', progress: 0, message: '' });
  const [confirmModal, setConfirmModal] = useState<{ cloudinaryUrl: string; publicId: string; fileName: string; size: number } | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAssets(await adminFetchMediaAssets());
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const filtered = assets.filter(a => filter === 'all' || a.mediaType === filter);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUpload({ phase: 'uploading', progress: 0, message: `Getting upload URL for ${file.name}…` });
    try {
      const { presignedUrl, key } = await adminGetVideoPresignedUrl(file.name, file.type);
      setUpload(s => ({ ...s, message: `Uploading ${file.name}…` }));
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) setUpload(s => ({ ...s, progress: Math.round((ev.loaded / ev.total) * 100) }));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Upload error'));
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
      setUpload(s => ({ ...s, message: 'Confirming…', progress: 100 }));
      await adminConfirmVideoUpload(key, file.name, file.type, file.size);
      setUpload({ phase: 'done', progress: 100, message: 'Uploaded successfully' });
      await load();
    } catch (err: unknown) {
      setUpload({ phase: 'error', progress: 0, message: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUpload({ phase: 'staging', progress: 0, message: `Staging ${file.name} on Cloudinary…` });
    try {
      const { cloudinaryPublicId, cloudinaryUrl } = await adminStageOnCloudinary(file);
      setConfirmModal({ cloudinaryUrl, publicId: cloudinaryPublicId, fileName: file.name, size: file.size });
      setUpload({ phase: 'idle', progress: 0, message: '' });
    } catch (err: unknown) {
      setUpload({ phase: 'error', progress: 0, message: err instanceof Error ? err.message : 'Stage failed' });
    }
  };

  const handleConfirmImage = async () => {
    if (!confirmModal) return;
    setUpload({ phase: 'uploading', progress: 0, message: 'Saving image record…' });
    try {
      await adminConfirmMediaImageUpload(confirmModal.cloudinaryUrl, confirmModal.publicId, confirmModal.fileName, confirmModal.size);
      setConfirmModal(null);
      setUpload({ phase: 'done', progress: 100, message: 'Image saved' });
      await load();
    } catch (err: unknown) {
      setUpload({ phase: 'error', progress: 0, message: err instanceof Error ? err.message : 'Confirm failed' });
    }
  };

  const handleDelete = async (a: MediaAsset) => {
    if (!confirm(`Delete "${a.fileName}"?`)) return;
    await adminDeleteMediaAsset(a.id);
    if (selected?.id === a.id) setSelected(null);
    await load();
  };

  if (loading) return <div className="p-8 text-white text-sm">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-white">Media Library</h1>
            <p className="text-[#555] text-xs mt-0.5">{filtered.length} assets</p>
          </div>
          <div className="flex items-center gap-3">
            {upload.phase !== 'idle' && (
              <div className="flex items-center gap-2">
                {upload.phase === 'uploading' && (
                  <div className="w-24 h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div className="h-full bg-[#c9a96e] transition-all" style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
                <span className={`text-xs ${upload.phase === 'error' ? 'text-red-400' : upload.phase === 'done' ? 'text-green-400' : 'text-[#888]'}`}>
                  {upload.message}
                </span>
                {(upload.phase === 'done' || upload.phase === 'error') && (
                  <button onClick={() => setUpload({ phase: 'idle', progress: 0, message: '' })} className="text-[#444] hover:text-[#666] text-xs">✕</button>
                )}
              </div>
            )}
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            <button
              className="bg-white/10 text-gray-300 px-3 py-1.5 rounded text-sm hover:bg-white/20 transition-colors"
              onClick={() => imageRef.current?.click()}
            >+ Image</button>
            <button
              className="bg-[#c9a96e] text-black px-3 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors"
              onClick={() => videoRef.current?.click()}
            >+ Video</button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-6 py-2 border-b border-[#1a1a1a] flex-shrink-0">
          {(['all', 'image', 'video'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs transition-colors capitalize ${filter === f ? 'bg-[#1e1e1e] text-white' : 'text-[#555] hover:text-[#888]'}`}
            >{f === 'all' ? 'All' : f + 's'}</button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-[#444] text-sm text-center pt-16">No assets yet. Upload an image or video to get started.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map(a => (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`group relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${selected?.id === a.id ? 'border-[#c9a96e]' : 'border-transparent hover:border-[#333]'}`}
                >
                  {a.mediaType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.cloudinaryUrl || a.url || ''}
                      alt={a.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#111] flex flex-col items-center justify-center gap-1">
                      <svg className="w-8 h-8 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      <span className="text-[#555] text-[9px] px-1 text-center truncate w-full">{a.fileName}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-64 flex-shrink-0 border-l border-[#1a1a1a] bg-[#0d0d0d] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <span className="text-white text-xs font-medium">Details</span>
            <button onClick={() => setSelected(null)} className="text-[#444] hover:text-[#888] text-sm">✕</button>
          </div>

          <div className="p-4 space-y-4">
            {selected.mediaType === 'image' ? (
              <div
                className="aspect-square rounded overflow-hidden bg-[#111] cursor-zoom-in"
                onClick={() => setLightbox(selected)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.cloudinaryUrl || selected.url || ''} alt={selected.fileName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <video
                src={selected.url || ''}
                controls
                className="w-full rounded bg-black"
              />
            )}

            <div className="space-y-2 text-xs">
              <div>
                <div className="text-[#444] mb-0.5">Filename</div>
                <div className="text-[#888] break-all">{selected.fileName}</div>
              </div>
              <div>
                <div className="text-[#444] mb-0.5">Type</div>
                <div className="text-[#888]">{selected.mimeType}</div>
              </div>
              <div>
                <div className="text-[#444] mb-0.5">Size</div>
                <div className="text-[#888]">{formatBytes(selected.sizeBytes)}</div>
              </div>
              <div>
                <div className="text-[#444] mb-0.5">Uploaded</div>
                <div className="text-[#888]">{formatDate(selected.uploadedAt)}</div>
              </div>
              <div>
                <div className="text-[#444] mb-0.5">Key</div>
                <div className="text-[#666] break-all font-mono text-[10px]">{selected.key}</div>
              </div>
              {selected.cloudinaryPublicId && (
                <div>
                  <div className="text-[#444] mb-0.5">Cloudinary ID</div>
                  <div className="text-[#666] break-all font-mono text-[10px]">{selected.cloudinaryPublicId}</div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {(selected.cloudinaryUrl || selected.url) && (
                <a
                  href={selected.cloudinaryUrl || selected.url || ''}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center bg-white/10 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-white/20 transition-colors"
                >Open original</a>
              )}
              <button
                onClick={() => handleDelete(selected)}
                className="w-full bg-red-900/60 text-red-300 px-3 py-1.5 rounded text-xs hover:bg-red-800 transition-colors"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Cloudinary confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#111] border border-[#1e1e1e] rounded-lg w-full max-w-lg p-6">
            <h2 className="text-white text-base font-semibold mb-3">Edit & Confirm Image</h2>
            <p className="text-[#666] text-xs mb-4">The image has been staged on Cloudinary. Open it to crop/adjust, then confirm to save the asset to the media library.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={confirmModal.cloudinaryUrl} alt={confirmModal.fileName} className="w-full max-h-64 object-contain rounded bg-[#0a0a0a] mb-4" />
            <div className="flex justify-between items-center">
              <a href={confirmModal.cloudinaryUrl} target="_blank" rel="noreferrer" className="text-[#c9a96e] text-xs hover:underline">Edit on Cloudinary</a>
              <div className="flex gap-2">
                <button className="px-4 py-1.5 text-sm text-[#666] hover:text-white transition-colors" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="bg-[#c9a96e] text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors" onClick={handleConfirmImage}>Save to library</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.cloudinaryUrl || lightbox.url || ''} alt={lightbox.fileName} className="max-w-[90vw] max-h-[90vh] object-contain" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
