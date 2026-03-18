'use client';

// Modal for manually adding a new watch to the database
import React, { useState, useRef } from 'react';
import { Brand, Collection, adminCreateWatch, adminUploadWatchImage } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import ImageCropper from './ImageCropper';

interface AddWatchModalProps {
    brands: Brand[];
    collections: Collection[];
    onClose: () => void;
    onSave: () => void;
}

const DEFAULT_SPECS = '{"productionStatus":null,"dial":{},"case":{},"movement":{},"strap":{}}';

export default function AddWatchModal({ brands, collections, onClose, onSave }: AddWatchModalProps) {
    const [brandId, setBrandId] = useState<number | ''>('');
    const [collectionId, setCollectionId] = useState<number | ''>('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('0');
    const [specsJson, setSpecsJson] = useState(DEFAULT_SPECS);
    const [imagePublicId, setImagePublicId] = useState('');

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [cropMode, setCropMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredCollections = collections.filter(c => !brandId || c.brandId === brandId);

    const stageFile = (file: File) => {
        setUploadError('');
        setPendingFile(file);
        setCropMode(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) stageFile(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) { stageFile(file); return; }
            }
        }
    };

    const uploadFile = async (file: File) => {
        setUploadingImage(true);
        setUploadError('');
        try {
            const slugifiedName = (name || 'watch').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
            const ext = file.name.split('.').pop() || 'png';
            const cleanFileName = `${slugifiedName}-${Date.now().toString().slice(-4)}.${ext}`;
            const renamedFile = new File([file], cleanFileName, { type: file.type });
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

    const handleUseAsIs = async () => {
        if (!pendingFile) return;
        const file = pendingFile;
        setPendingFile(null);
        setCropMode(false);
        await uploadFile(file);
    };

    const handleCropConfirm = async (croppedFile: File) => {
        setPendingFile(null);
        await uploadFile(croppedFile);
    };

    const handleSave = async () => {
        if (!brandId) { setSaveError('Please select a brand'); return; }
        if (!name.trim()) { setSaveError('Name is required'); return; }
        try {
            setSaving(true);
            setSaveError('');
            await adminCreateWatch({
                name: name.trim(),
                description: description.trim(),
                currentPrice: parseFloat(price) || 0,
                image: imagePublicId,
                brandId: brandId as number,
                collectionId: collectionId ? collectionId as number : null,
                specs: specsJson,
            });
            onSave();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to create watch');
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto"
            onPaste={handlePaste}
            tabIndex={0}
            onClick={onClose}
        >
            <div className="flex min-h-full items-center justify-center p-6 pt-24">
            <div className="bg-[#111] border border-white/20 p-8 rounded-xl max-w-5xl w-full text-white grid grid-cols-2 gap-8 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl">&times;</button>

                {/* Left Column: Image */}
                <div>
                    <h2 className="text-2xl font-bold mb-4 font-playfair text-[#f0e6d2]">Watch Image</h2>

                    {pendingFile && cropMode ? (
                        <ImageCropper
                            rawFile={pendingFile}
                            onConfirm={handleCropConfirm}
                            onCancel={() => { setPendingFile(null); setCropMode(false); }}
                        />
                    ) : pendingFile && !cropMode ? (
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
                        <>
                            <div className="bg-black/50 p-4 border border-white/10 rounded-lg flex flex-col items-center justify-center mb-6 h-[400px]">
                                {imagePublicId ? (
                                    <img
                                        src={imagePublicId.startsWith('http') ? imagePublicId : imageTransformations.detail(imagePublicId)}
                                        alt="Preview"
                                        className="object-contain max-h-full max-w-full rounded"
                                    />
                                ) : (
                                    <div className="text-gray-500 italic">No image yet</div>
                                )}
                            </div>

                            {imagePublicId && (
                                <div className="mb-4">
                                    <p className="text-sm text-gray-400 mb-1">Public ID:</p>
                                    <input className="w-full bg-black/50 border border-white/20 p-2 text-sm text-gray-300 rounded" value={imagePublicId} readOnly />
                                </div>
                            )}

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

                {/* Right Column: Watch Data */}
                <div className="flex flex-col h-full overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4 font-playfair text-[#f0e6d2]">Watch Details</h2>

                    {saveError && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4">{saveError}</div>}

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Brand <span className="text-red-400">*</span></label>
                        <select
                            className="w-full bg-black/60 border border-white/20 rounded p-2 text-white focus:outline-none focus:border-[#f0e6d2] transition-colors"
                            value={brandId}
                            onChange={e => { setBrandId(e.target.value ? Number(e.target.value) : ''); setCollectionId(''); }}
                        >
                            <option value="">Select brand...</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Collection</label>
                        <select
                            className="w-full bg-black/60 border border-white/20 rounded p-2 text-white focus:outline-none focus:border-[#f0e6d2] transition-colors disabled:opacity-50"
                            value={collectionId}
                            onChange={e => setCollectionId(e.target.value ? Number(e.target.value) : '')}
                            disabled={!brandId}
                        >
                            <option value="">No collection</option>
                            {filteredCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Reference Number (Name) <span className="text-red-400">*</span></label>
                        <input type="text" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" placeholder="e.g. 5711/1A-010" value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <input type="text" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" placeholder="2-3 sentences about this watch's character and highlights" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Price in AUD (0 = Price on Request)</label>
                        <input type="number" step="0.01" min="0" className="w-full bg-black/60 border border-white/20 rounded p-2 text-white" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>

                    <div className="mb-6 flex-grow flex flex-col">
                        <label className="text-sm text-gray-400 mb-1 flex justify-between">
                            <span>Specs JSON</span>
                            <span className="text-[#f0e6d2] cursor-pointer hover:underline" onClick={() => setSpecsJson(DEFAULT_SPECS)}>Reset</span>
                        </label>
                        <textarea
                            className="w-full h-48 bg-black/60 border border-white/20 rounded p-2 text-white font-mono text-sm resize-none"
                            value={specsJson}
                            onChange={e => setSpecsJson(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-4 mt-auto">
                        <button className="px-6 py-2 border border-white/30 rounded hover:bg-white/10" onClick={onClose}>Cancel</button>
                        <button
                            className="px-6 py-2 bg-[#f0e6d2] text-black rounded font-medium disabled:opacity-50"
                            onClick={handleSave}
                            disabled={saving || !!pendingFile || uploadingImage}
                        >
                            {saving ? 'Creating...' : 'Add Watch'}
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
