'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Watch, adminFetchWatchById, adminUpdateWatch, adminUploadWatchImage, UpdateWatchDto } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';

interface WatchEditorModalProps {
    watch: Watch;
    onClose: () => void;
    onSave: () => void;
}

// --- Image Cropper: drag to pan, scroll to zoom, square viewport ---
function ImageCropper({ rawFile, onConfirm, onCancel }: {
    rawFile: File;
    onConfirm: (croppedFile: File) => void;
    onCancel: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [imgSrc, setImgSrc] = useState('');
    const [naturalW, setNaturalW] = useState(0);
    const [naturalH, setNaturalH] = useState(0);

    // Pan & zoom state (in image-pixel space)
    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    const VIEWPORT = 400; // square viewport px

    // Load image from File
    useEffect(() => {
        const url = URL.createObjectURL(rawFile);
        setImgSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [rawFile]);

    // Once image loads, fit the entire image inside the viewport with padding
    const handleImgLoad = () => {
        const img = imgRef.current;
        if (!img) return;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        setNaturalW(nw);
        setNaturalH(nh);

        // Initial scale: fit entire image inside viewport (shorter side = padding)
        const fitScale = Math.min(VIEWPORT / nw, VIEWPORT / nh) * 0.85;
        setScale(fitScale);
        // Center the image
        setOffsetX((VIEWPORT - nw * fitScale) / 2);
        setOffsetY((VIEWPORT - nh * fitScale) / 2);
    };

    // Clamp offsets — image can be smaller than viewport (black padding allowed)
    const clamp = (ox: number, oy: number, s: number) => {
        const imgW = naturalW * s;
        const imgH = naturalH * s;
        // Keep image within viewport bounds (don't let it disappear off-screen)
        const minX = Math.min(0, VIEWPORT - imgW);
        const maxX = Math.max(0, VIEWPORT - imgW);
        const minY = Math.min(0, VIEWPORT - imgH);
        const maxY = Math.max(0, VIEWPORT - imgH);
        return {
            x: Math.min(maxX, Math.max(minX, ox)),
            y: Math.min(maxY, Math.max(minY, oy)),
        };
    };

    // Mouse drag
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const clamped = clamp(dragStart.current.ox + dx, dragStart.current.oy + dy, scale);
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
    };
    const handleMouseUp = () => setDragging(false);

    // Scroll to zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        // Allow zooming out to 50% of fit-inside scale (lots of padding)
        const fitScale = Math.min(VIEWPORT / naturalW, VIEWPORT / naturalH);
        const minScale = fitScale * 0.5;
        const maxScale = fitScale * 6;
        const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const newScale = Math.min(maxScale, Math.max(minScale, scale * zoomFactor));

        // Zoom toward mouse position within container
        const rect = containerRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Adjust offset so the point under the cursor stays fixed
        const newOx = mx - (mx - offsetX) * (newScale / scale);
        const newOy = my - (my - offsetY) * (newScale / scale);
        const clamped = clamp(newOx, newOy, newScale);

        setScale(newScale);
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
    };

    // Render the viewport to canvas — preserves quality, black background for padding
    const handleConfirm = () => {
        if (!naturalW) return;

        // Output at high resolution: use a fixed 1200px canvas for consistent quality
        const OUTPUT = 1200;
        const ratio = OUTPUT / VIEWPORT;

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext('2d')!;

        // Black background (for padding areas when zoomed out)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, OUTPUT, OUTPUT);

        // Map the image position/scale from viewport space to canvas space
        const drawX = offsetX * ratio;
        const drawY = offsetY * ratio;
        const drawW = naturalW * scale * ratio;
        const drawH = naturalH * scale * ratio;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgRef.current!, drawX, drawY, drawW, drawH);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const cropped = new File([blob], rawFile.name.replace(/\.\w+$/, '.png'), { type: 'image/png' });
            onConfirm(cropped);
        }, 'image/png', 1.0);
    };

    return (
        <div>
            <p className="text-sm text-gray-400 mb-2">Drag to reposition, scroll to zoom. Square frame = card crop.</p>
            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-lg border-2 border-[#f0e6d2]/50 cursor-grab active:cursor-grabbing mx-auto"
                style={{ width: VIEWPORT, height: VIEWPORT, background: '#000' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {imgSrc && (
                    <img
                        ref={imgRef}
                        src={imgSrc}
                        alt="Crop preview"
                        onLoad={handleImgLoad}
                        draggable={false}
                        className="absolute select-none"
                        style={{
                            left: offsetX,
                            top: offsetY,
                            width: naturalW * scale,
                            height: naturalH * scale,
                            maxWidth: 'none',
                        }}
                    />
                )}
                {/* Crosshair guides */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15" />
                </div>
            </div>
            <div className="flex gap-3 mt-4 justify-center">
                <button className="px-5 py-2 border border-white/30 rounded hover:bg-white/10 text-sm" onClick={onCancel}>Cancel</button>
                <button className="px-5 py-2 bg-[#f0e6d2] text-black rounded font-medium text-sm" onClick={handleConfirm}>Confirm Crop</button>
            </div>
        </div>
    );
}

// --- Main Modal ---
export default function WatchEditorModal({ watch, onClose, onSave }: WatchEditorModalProps) {
    const [fullWatch, setFullWatch] = useState<Watch | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [price, setPrice] = useState('0');
    const [specsJson, setSpecsJson] = useState('{}');
    const [imagePublicId, setImagePublicId] = useState('');

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

    useEffect(() => {
        const load = async () => {
            try {
                const data = await adminFetchWatchById(watch.id);
                setFullWatch(data);
                setName(data.name);
                setPrice(data.currentPrice.toString());
                setSpecsJson(data.specs || '{}');
                setImagePublicId(data.image || '');

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
        setPendingFile(null);
        setCropMode(false);
        try {
            setUploadingImage(true);
            setUploadError('');
            const slugifiedName = (originalName || name).replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
            const ext = pendingFile.name.split('.').pop() || 'png';
            const cleanFileName = `${slugifiedName}-${Date.now().toString().slice(-4)}.${ext}`;
            const renamedFile = new File([pendingFile], cleanFileName, { type: pendingFile.type });
            const result = await adminUploadWatchImage(renamedFile);
            if (result.success && result.publicId) {
                setImagePublicId(result.publicId);
            }
        } catch (err: unknown) {
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
        setPendingFile(null);
        try {
            setUploadingImage(true);
            setUploadError('');

            const slugifiedName = (originalName || name).replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
            const cleanFileName = `${slugifiedName}-${Date.now().toString().slice(-4)}.png`;
            const renamedFile = new File([croppedFile], cleanFileName, { type: 'image/png' });

            const result = await adminUploadWatchImage(renamedFile);
            if (result.success && result.publicId) {
                setImagePublicId(result.publicId);
            }
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : 'Image upload failed');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveError('');
            const data: UpdateWatchDto = {
                name,
                description: fullWatch?.description || '',
                currentPrice: parseFloat(price),
                image: imagePublicId,
                collectionId: fullWatch?.collectionId || null,
                specs: specsJson
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto pt-20 pb-10"
            onPaste={handlePaste}
            tabIndex={0}
        >
            <div className="bg-[#111] border border-white/20 p-8 rounded-xl max-w-5xl w-full text-white grid grid-cols-2 gap-8 relative my-8">
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
                                        src={imagePublicId.startsWith('http') ? imagePublicId : imageTransformations.detail(imagePublicId)}
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
                        <button className="px-6 py-2 bg-[#f0e6d2] text-black rounded font-medium disabled:opacity-50" onClick={handleSave} disabled={saving || !!pendingFile}>
                            {saving ? 'Saving...' : 'Save Watch Data'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}