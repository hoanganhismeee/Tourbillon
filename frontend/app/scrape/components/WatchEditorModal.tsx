'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Watch, adminFetchWatchById, adminUpdateWatch, adminUploadWatchImage, UpdateWatchDto } from '@/lib/api';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import ImageCropper from './ImageCropper';

interface WatchEditorModalProps {
    watch: Watch;
    onClose: () => void;
    onSave: () => void;
}

// --- Main Modal ---
export default function WatchEditorModal({ watch, onClose, onSave }: WatchEditorModalProps) {
    const queryClient = useQueryClient();
    const [fullWatch, setFullWatch] = useState<Watch | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Allowed production status values
    const PRODUCTION_STATUSES = ['', 'Current production', 'Discontinued', 'Limited edition'] as const;

    // Form fields
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('0');
    const [productionStatus, setProductionStatus] = useState('');
    const [specsJson, setSpecsJson] = useState('{}');
    const [imagePublicId, setImagePublicId] = useState('');
    // After upload, store Cloudinary version to bust CDN cache via versioned URL (/v{version}/ path)
    const [imageVersion, setImageVersion] = useState<number | null>(null);
    // Local blob URL for instant preview after upload (bypasses CDN cache entirely)
    const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

    // Scraped values for comparison
    const [originalSpecs, setOriginalSpecs] = useState('{}');
    const [originalName, setOriginalName] = useState('');
    const [originalPrice, setOriginalPrice] = useState('0');

    // Pending file states: 'preview' shows use-as-is vs crop choice, 'crop' enters cropper
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropMode, setCropMode] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [saveError, setSaveError] = useState('');

    // Revoke blob URL on unmount to prevent memory leaks
    useEffect(() => {
        return () => { if (localBlobUrl) URL.revokeObjectURL(localBlobUrl); };
    }, [localBlobUrl]);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await adminFetchWatchById(watch.id);
                setFullWatch(data);
                setName(data.name);
                setDescription(data.description || '');
                setPrice(data.currentPrice.toString());
                const specsStr = data.specs || '{}';
                setSpecsJson(specsStr);
                try {
                    const parsed = JSON.parse(specsStr);
                    setProductionStatus(parsed.productionStatus ?? '');
                } catch { /* leave blank on bad JSON */ }
                setImagePublicId(data.image || '');
                setImageVersion(data.imageVersion ?? null);

                setOriginalName(data.name);
                setOriginalPrice(data.currentPrice.toString());
                setOriginalSpecs(data.specs || '{}');
                setLoading(false);
            } catch (err) {
                console.error(err);
            }
        };
        load();
    }, [watch.id]);

    // Stage file for preview (choose: use as-is or crop)
    const stageFile = (file: File) => {
        setUploadError('');
        setPendingFile(file);
        setCropMode(false);
    };

    // Upload original file directly — zero quality loss
    const handleUseAsIs = async () => {
        if (!pendingFile) return;
        // Capture blob URL before clearing pendingFile for instant preview
        const blobUrl = URL.createObjectURL(pendingFile);
        setPendingFile(null);
        setCropMode(false);
        try {
            setUploadingImage(true);
            setUploadError('');
            const rawExt = pendingFile.name.includes('.') ? pendingFile.name.split('.').pop()! : 'png';
            const safeFile = new File([pendingFile], `upload.${rawExt}`, { type: pendingFile.type });
            const result = await adminUploadWatchImage(watch.id, safeFile);
            if (result.success && result.publicId) {
                setImagePublicId(result.publicId);
                setImageVersion(result.version ?? null);
                setLocalBlobUrl(blobUrl);
                queryClient.invalidateQueries({ queryKey: ['watch', watch.id] });
            } else {
                URL.revokeObjectURL(blobUrl);
            }
        } catch (err: unknown) {
            URL.revokeObjectURL(blobUrl);
            setUploadError(err instanceof Error ? err.message : 'Image upload failed');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) stageFile(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        // Don't intercept paste if user is typing in a text input or textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    stageFile(file);
                    return;
                }
            }
        }
    };

    // After cropping, upload the result
    const handleCropConfirm = async (croppedFile: File) => {
        const blobUrl = URL.createObjectURL(croppedFile);
        setPendingFile(null);
        try {
            setUploadingImage(true);
            setUploadError('');

            const safeFile = new File([croppedFile], 'upload.png', { type: 'image/png' });
            const result = await adminUploadWatchImage(watch.id, safeFile);
            if (result.success && result.publicId) {
                setImagePublicId(result.publicId);
                setImageVersion(result.version ?? null);
                setLocalBlobUrl(blobUrl);
                queryClient.invalidateQueries({ queryKey: ['watch', watch.id] });
            } else {
                URL.revokeObjectURL(blobUrl);
            }
        } catch (err: unknown) {
            URL.revokeObjectURL(blobUrl);
            setUploadError(err instanceof Error ? err.message : 'Image upload failed');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveError('');
            // Merge productionStatus back into the specs JSON before saving
            let mergedSpecs = specsJson;
            try {
                const parsed = JSON.parse(specsJson);
                parsed.productionStatus = productionStatus || null;
                mergedSpecs = JSON.stringify(parsed);
            } catch { /* leave specsJson as-is if it's invalid JSON */ }
            const data: UpdateWatchDto = {
                name,
                description,
                currentPrice: parseFloat(price),
                image: imagePublicId,
                collectionId: fullWatch?.collectionId || null,
                specs: mergedSpecs
            };
            await adminUpdateWatch(watch.id, data);
            onSave();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save watch');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="text-white text-xl">Loading Review Studio...</div>
            </div>
        );
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const tag = (e.target as HTMLElement).tagName;
            if (tag !== 'TEXTAREA' && !saving && !pendingFile) {
                handleSave();
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto"
            data-lenis-prevent="true"
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            onClick={onClose}
        >
            <div className="flex min-h-full items-center justify-center p-6 pt-24">
            <div className="bg-[#111] border border-white/20 p-8 rounded-xl max-w-5xl w-full text-white grid grid-cols-2 gap-8 relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl"
                >
                    &times;
                </button>

                {/* Left Column: Image */}
                <div>
                    <h2 className="text-2xl font-bold mb-4 font-playfair text-[#f0e6d2]">Image Review</h2>

                    {pendingFile && cropMode ? (
                        // Crop mode — drag/zoom to reframe
                        <ImageCropper
                            rawFile={pendingFile}
                            onConfirm={handleCropConfirm}
                            onCancel={() => { setPendingFile(null); setCropMode(false); }}
                        />
                    ) : pendingFile && !cropMode ? (
                        // File staged — preview with choice
                        <>
                            <div className="bg-black/50 p-4 border border-white/10 rounded-lg flex flex-col items-center justify-center mb-4 h-[350px]">
                                <img
                                    src={URL.createObjectURL(pendingFile)}
                                    alt="Staged preview"
                                    className="object-contain max-h-full max-w-full rounded"
                                />
                            </div>
                            <p className="text-sm text-gray-400 mb-3 text-center">Image ready. Upload directly or adjust framing first.</p>
                            <div className="flex gap-3 justify-center mb-3">
                                <button className="px-4 py-2 border border-white/30 rounded hover:bg-white/10 text-sm" onClick={() => { setPendingFile(null); setCropMode(false); }}>Cancel</button>
                                <button className="px-4 py-2 border border-[#f0e6d2]/50 rounded hover:bg-[#f0e6d2]/10 text-sm text-[#f0e6d2]" onClick={() => setCropMode(true)}>Crop & Adjust</button>
                                <button className="px-4 py-2 bg-[#f0e6d2] text-black rounded font-medium text-sm" onClick={handleUseAsIs}>Use as-is</button>
                            </div>
                            {uploadError && <p className="text-red-400 text-sm mt-2">{uploadError}</p>}
                        </>
                    ) : (
                        // Normal preview — current image from DB
                        <>
                            <div className="bg-black/50 p-4 border border-white/10 rounded-lg flex flex-col items-center justify-center mb-6 h-[400px]">
                                {imagePublicId ? (
                                    <img
                                        src={localBlobUrl || (() => {
                                            if (imagePublicId.startsWith('http')) return imagePublicId;
                                            const base = getOptimizedImageUrl(imagePublicId, { width: 1200, height: 1200, crop: 'fit' });
                                            return imageVersion ? base.replace('/image/upload/', `/image/upload/v${imageVersion}/`) : base;
                                        })()}
                                        alt="Preview"
                                        className="object-contain max-h-full max-w-full rounded"
                                    />
                                ) : (
                                    <div className="text-gray-500 italic">No image stored</div>
                                )}
                            </div>

                            <div>
                                <p className="text-sm text-gray-400 mb-1">Public ID:</p>
                                <input className="w-full bg-black/50 border border-white/20 p-2 text-sm text-gray-300 rounded mb-4" value={imagePublicId} readOnly />
                            </div>

                            <div
                                className="border border-dashed border-white/30 rounded-lg p-6 text-center hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {uploadingImage ? 'Uploading to Cloudinary...' : 'Click to Upload or Paste Image (Ctrl+V)'}
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                            </div>
                            {uploadError && <p className="text-red-400 text-sm mt-2">{uploadError}</p>}
                        </>
                    )}
                </div>

                {/* Right Column: Text Replacements */}
                <div className="flex flex-col h-full overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4 font-playfair text-[#f0e6d2]">Data Editing</h2>

                    {saveError && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4">{saveError}</div>}

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Name / Title (Current: {originalName})</label>
                        <input type="text" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <input type="text" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Production Status</label>
                        <select
                            className="w-full bg-black/60 border border-white/20 rounded p-2 text-white focus:outline-none focus:border-[#f0e6d2] transition-colors"
                            value={productionStatus}
                            onChange={e => setProductionStatus(e.target.value)}
                        >
                            {PRODUCTION_STATUSES.map(s => (
                                <option key={s} value={s}>{s || '— Not set —'}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Price in AUD (Current: {originalPrice === '0' ? 'Price on request' : originalPrice})</label>
                        <input type="number" step="0.01" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>

                    <div className="mb-6 flex-grow flex flex-col">
                        <label className="text-sm text-gray-400 mb-1 flex justify-between">
                            <span>Raw Specs JSON</span>
                            <span className="text-[#f0e6d2] cursor-pointer hover:underline" onClick={() => setSpecsJson(originalSpecs)}>Reset</span>
                        </label>
                        <textarea
                            className="w-full h-48 bg-black/60 border border-white/20 rounded p-2 text-white font-mono text-sm resize-none"
                            value={specsJson}
                            onChange={e => setSpecsJson(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-4 mt-auto">
                        <button className="px-6 py-2 border border-white/30 rounded hover:bg-white/10" onClick={onClose}>Cancel</button>
                        <button className="px-6 py-2 bg-[#f0e6d2] text-black rounded font-medium disabled:opacity-50" onClick={handleSave} disabled={saving || !!pendingFile || uploadingImage}>
                            {saving ? 'Saving...' : 'Save Watch Data'}
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}