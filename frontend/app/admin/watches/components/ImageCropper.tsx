'use client';

import React, { useState, useEffect, useRef } from 'react';

// Drag-to-pan, scroll-to-zoom square image cropper
export default function ImageCropper({ rawFile, onConfirm, onCancel }: {
    rawFile: File;
    onConfirm: (croppedFile: File) => void;
    onCancel: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [imgSrc, setImgSrc] = useState('');
    const [naturalW, setNaturalW] = useState(0);
    const [naturalH, setNaturalH] = useState(0);

    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    const VIEWPORT = 400;

    useEffect(() => {
        const url = URL.createObjectURL(rawFile);
        setImgSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [rawFile]);

    const handleImgLoad = () => {
        const img = imgRef.current;
        if (!img) return;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        setNaturalW(nw);
        setNaturalH(nh);
        const fitScale = Math.min(VIEWPORT / nw, VIEWPORT / nh) * 0.85;
        setScale(fitScale);
        setOffsetX((VIEWPORT - nw * fitScale) / 2);
        setOffsetY((VIEWPORT - nh * fitScale) / 2);
    };

    const clamp = (ox: number, oy: number, s: number) => {
        const imgW = naturalW * s;
        const imgH = naturalH * s;
        const minX = Math.min(0, VIEWPORT - imgW);
        const maxX = Math.max(0, VIEWPORT - imgW);
        const minY = Math.min(0, VIEWPORT - imgH);
        const maxY = Math.max(0, VIEWPORT - imgH);
        return {
            x: Math.min(maxX, Math.max(minX, ox)),
            y: Math.min(maxY, Math.max(minY, oy)),
        };
    };

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

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const fitScale = Math.min(VIEWPORT / naturalW, VIEWPORT / naturalH);
        const minScale = fitScale * 0.5;
        const maxScale = fitScale * 6;
        const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const newScale = Math.min(maxScale, Math.max(minScale, scale * zoomFactor));
        const rect = containerRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const newOx = mx - (mx - offsetX) * (newScale / scale);
        const newOy = my - (my - offsetY) * (newScale / scale);
        const clamped = clamp(newOx, newOy, newScale);
        setScale(newScale);
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
    };

    const handleConfirm = () => {
        if (!naturalW) return;
        const OUTPUT = 1200;
        const ratio = OUTPUT / VIEWPORT;
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, OUTPUT, OUTPUT);
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
