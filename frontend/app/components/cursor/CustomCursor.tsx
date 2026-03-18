// Custom cursor renderer — follows mouse position and renders chosen cursor style
// Hides native cursor and draws a luxury watch-themed replacement
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCursor, CursorStyle } from '@/contexts/CursorContext';

// SVG shapes for each cursor option, centered on hotspot
const CursorShape = ({ style, angle }: { style: CursorStyle; angle: number }) => {
  switch (style) {
    case 'tourbillon':
      // Tourbillon cage — concentric rotating ring with spokes
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ transform: `rotate(${angle % 360}deg)` }}>
          <circle cx="16" cy="16" r="12" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7" fill="none" strokeDasharray="3 2"/>
          <circle cx="16" cy="16" r="7" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.5" fill="none"/>
          <line x1="16" y1="4" x2="16" y2="9" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="16" y1="23" x2="16" y2="28" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="4" y1="16" x2="9" y2="16" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="23" y1="16" x2="28" y2="16" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <circle cx="16" cy="16" r="2.5" fill="#bfa68a" fillOpacity="0.4" stroke="#f0e6d2" strokeWidth="0.8"/>
          <circle cx="16" cy="16" r="1" fill="#f0e6d2"/>
        </svg>
      );

    case 'crosshair':
      // Dial precision crosshair — minute track markers around a center dot
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <line x1="16" y1="2" x2="16" y2="8" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="16" y1="24" x2="16" y2="30" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="2" y1="16" x2="8" y2="16" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="24" y1="16" x2="30" y2="16" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="5" y1="5" x2="8" y2="8" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5"/>
          <line x1="24" y1="5" x2="27" y2="8" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5" transform="scale(-1,1) translate(-32,0)"/>
          <line x1="5" y1="27" x2="8" y2="24" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5" transform="scale(1,-1) translate(0,-32)"/>
          <line x1="27" y1="27" x2="24" y2="24" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5"/>
          <circle cx="16" cy="16" r="9" stroke="#bfa68a" strokeWidth="0.7" strokeOpacity="0.35" fill="none"/>
          <circle cx="16" cy="16" r="2" fill="#f0e6d2" fillOpacity="0.9"/>
          <circle cx="16" cy="16" r="1" fill="white"/>
        </svg>
      );

    case 'lumed':
      // Warm lume pip — vintage Super-LumiNova patina
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="rgba(240,200,100,0.04)"/>
          <circle cx="12" cy="12" r="7" fill="rgba(240,205,110,0.07)"/>
          <circle cx="12" cy="12" r="4.5" fill="rgba(240,210,115,0.16)" stroke="rgba(240,210,120,0.45)" strokeWidth="0.8"/>
          <circle cx="12" cy="12" r="2.5" fill="rgba(245,218,128,0.92)"/>
          <circle cx="11" cy="11" r="0.8" fill="rgba(255,242,200,0.8)"/>
        </svg>
      );

    case 'hand':
      // Elegant sword hand — watch hand pointing up from pivot center
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          {/* Main needle body */}
          <path d="M14 3L15.3 17.5H12.7Z" fill="#bfa68a" fillOpacity="0.85" stroke="#bfa68a" strokeWidth="0.4"/>
          {/* Counterweight */}
          <path d="M14 17.5L16 22H12Z" fill="#bfa68a" fillOpacity="0.4"/>
          {/* Lume pip near tip */}
          <circle cx="14" cy="6.5" r="1.3" fill="rgba(245,218,128,0.9)"/>
          {/* Center pivot bearing */}
          <circle cx="14" cy="17.5" r="2.8" fill="rgba(191,166,138,0.12)" stroke="#bfa68a" strokeWidth="0.8"/>
          <circle cx="14" cy="17.5" r="1" fill="#f0e6d2"/>
        </svg>
      );

    case 'bezel':
      // Rotating bezel ring with pip and quarter markers
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          {/* Outer bezel ring */}
          <circle cx="16" cy="16" r="13.5" stroke="#bfa68a" strokeWidth="1.2" strokeOpacity="0.65" fill="none"/>
          {/* 12 o'clock pip */}
          <rect x="14.5" y="1.5" width="3" height="5.5" rx="1" fill="#bfa68a" fillOpacity="0.85"/>
          {/* Quarter markers */}
          <rect x="27" y="14.5" width="4" height="3" rx="0.8" fill="#bfa68a" fillOpacity="0.35"/>
          <rect x="14.5" y="27" width="3" height="4" rx="0.8" fill="#bfa68a" fillOpacity="0.35"/>
          <rect x="1" y="14.5" width="4" height="3" rx="0.8" fill="#bfa68a" fillOpacity="0.35"/>
          {/* Minute tick marks */}
          <circle cx="16" cy="3" r="0.6" fill="#bfa68a" fillOpacity="0.4"/>
          <circle cx="26.4" cy="7.6" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          <circle cx="29" cy="16" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          <circle cx="26.4" cy="24.4" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          <circle cx="5.6" cy="24.4" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          <circle cx="3" cy="16" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          <circle cx="5.6" cy="7.6" r="0.5" fill="#bfa68a" fillOpacity="0.3"/>
          {/* Inner ring */}
          <circle cx="16" cy="16" r="8.5" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.2" fill="none"/>
          {/* Center bearing */}
          <circle cx="16" cy="16" r="2" fill="rgba(191,166,138,0.12)" stroke="#bfa68a" strokeWidth="0.8"/>
          <circle cx="16" cy="16" r="0.8" fill="#f0e6d2"/>
        </svg>
      );

    case 'compass':
      // Navigation compass rose — inspired by travel watches (VC Overseas, IWC Pilot)
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          {/* Outer ring */}
          <circle cx="16" cy="16" r="13.5" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.3" fill="none"/>
          {/* N point — bright */}
          <path d="M16 3L18.5 14L16 16L13.5 14Z" fill="#bfa68a"/>
          {/* E point */}
          <path d="M29 16L18 18.5L16 16L18 13.5Z" fill="#bfa68a" fillOpacity="0.35"/>
          {/* S point */}
          <path d="M16 29L13.5 18L16 16L18.5 18Z" fill="#bfa68a" fillOpacity="0.25"/>
          {/* W point */}
          <path d="M3 16L14 13.5L16 16L14 18.5Z" fill="#bfa68a" fillOpacity="0.55"/>
          {/* Diagonal minor points */}
          <path d="M25.4 6.6L18 13.5L16 12L21.5 5.5Z" fill="#bfa68a" fillOpacity="0.13"/>
          <path d="M25.4 25.4L18.5 18L20 16L25.5 21Z" fill="#bfa68a" fillOpacity="0.13"/>
          <path d="M6.6 25.4L13.5 18.5L12 20L6.5 25.5Z" fill="#bfa68a" fillOpacity="0.13"/>
          <path d="M6.6 6.6L14 13.5L12 16L6.5 10.5Z" fill="#bfa68a" fillOpacity="0.13"/>
          {/* N label ring indicator */}
          <circle cx="16" cy="5" r="1.5" fill="rgba(191,166,138,0.2)" stroke="#bfa68a" strokeWidth="0.6"/>
          {/* Center jewel */}
          <circle cx="16" cy="16" r="2" fill="rgba(191,166,138,0.15)" stroke="#bfa68a" strokeWidth="0.8"/>
          <circle cx="16" cy="16" r="0.8" fill="#f0e6d2"/>
        </svg>
      );

    case 'sapphire':
      // Sapphire crystal gem — hexagonal faceted stone
      return (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          {/* Hexagonal girdle */}
          <polygon points="15,2 26,8.5 26,21.5 15,28 4,21.5 4,8.5"
            stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7" fill="rgba(191,166,138,0.06)"/>
          {/* Upper crown facets */}
          <line x1="15" y1="2" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.5"/>
          <line x1="26" y1="8.5" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.5"/>
          <line x1="4" y1="8.5" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.5"/>
          {/* Lower pavilion facets */}
          <line x1="15" y1="28" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.25"/>
          <line x1="26" y1="21.5" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.25"/>
          <line x1="4" y1="21.5" x2="15" y2="14" stroke="#bfa68a" strokeWidth="0.5" strokeOpacity="0.25"/>
          {/* Table outline */}
          <polyline points="4,8.5 15,2 26,8.5" stroke="#bfa68a" strokeWidth="0.9" strokeOpacity="0.55" fill="none"/>
          {/* Table sparkle */}
          <circle cx="15" cy="14" r="1.8" fill="rgba(240,230,200,0.88)"/>
          <circle cx="13" cy="12" r="0.6" fill="rgba(255,252,240,0.7)"/>
        </svg>
      );

    case 'rotor':
      // Automatic winding rotor — half-disc with eccentric mass
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ transform: `rotate(${(angle * 0.5) % 360}deg)` }}>
          {/* Rotor half-disc body */}
          <path d="M16 16 L4 16 A12 12 0 0 1 28 16 Z"
            fill="rgba(191,166,138,0.18)" stroke="#bfa68a" strokeWidth="1"/>
          {/* Eccentric mass (thick arc) */}
          <path d="M4 16 A12 12 0 0 1 28 16"
            stroke="#bfa68a" strokeWidth="3.5" strokeOpacity="0.5" fill="none" strokeLinecap="round"/>
          {/* Spokes */}
          <line x1="16" y1="16" x2="10" y2="10" stroke="#bfa68a" strokeWidth="0.7" strokeOpacity="0.4"/>
          <line x1="16" y1="16" x2="22" y2="10" stroke="#bfa68a" strokeWidth="0.7" strokeOpacity="0.4"/>
          <line x1="16" y1="16" x2="16" y2="5" stroke="#bfa68a" strokeWidth="0.7" strokeOpacity="0.4"/>
          {/* Center bearing */}
          <circle cx="16" cy="16" r="3.5" fill="rgba(191,166,138,0.12)" stroke="#bfa68a" strokeWidth="0.9"/>
          <circle cx="16" cy="16" r="1.3" fill="#f0e6d2"/>
        </svg>
      );

    default:
      return null;
  }
};

const CustomCursor = () => {
  const { cursor } = useCursor();
  const posRef = useRef({ x: -100, y: -100 });
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [angle, setAngle] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);

  // Smooth cursor follow using requestAnimationFrame
  useEffect(() => {
    if (cursor === 'default') return;

    const move = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    const tick = () => {
      setPos({ ...posRef.current });
      if (cursor === 'tourbillon' || cursor === 'rotor') {
        angleRef.current = angleRef.current + 0.8;
        setAngle(angleRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    document.addEventListener('mousemove', move);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('mousemove', move);
    };
  }, [cursor]);

  useEffect(() => {
    if (cursor === 'default') {
      document.documentElement.classList.remove('custom-cursor');
      return;
    }
    document.documentElement.classList.add('custom-cursor');
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    document.addEventListener('mouseenter', show);
    document.addEventListener('mouseleave', hide);
    return () => {
      document.documentElement.classList.remove('custom-cursor');
      document.removeEventListener('mouseenter', show);
      document.removeEventListener('mouseleave', hide);
    };
  }, [cursor]);

  if (cursor === 'default') return null;

  const sizeMap: Partial<Record<CursorStyle, number>> = {
    tourbillon: 32, crosshair: 32, lumed: 24,
    hand: 28, bezel: 32, compass: 32, sapphire: 30, rotor: 32,
  };
  const size = sizeMap[cursor] ?? 32;
  const half = size / 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x - half,
        top: pos.y - half,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 99999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s',
        willChange: 'transform',
      }}
    >
      <CursorShape style={cursor} angle={angle} />
    </div>
  );
};

export default CustomCursor;
