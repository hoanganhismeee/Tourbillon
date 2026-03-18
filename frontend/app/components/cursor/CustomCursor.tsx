// Custom cursor renderer — follows mouse position and renders chosen cursor style
// Hides native cursor and draws a luxury watch-themed replacement
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCursor, CursorStyle } from '@/contexts/CursorContext';

// SVG shapes for each cursor option (rendered at 32×32, hotspot center)
const CursorShape = ({ style, angle }: { style: CursorStyle; angle: number }) => {
  switch (style) {
    case 'crown':
      // Watch winding crown — three knurled ridges on a cylinder
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          {/* Crown body */}
          <rect x="8" y="11" width="12" height="8" rx="2" fill="rgba(191,166,138,0.15)" stroke="#bfa68a" strokeWidth="1.2"/>
          {/* Knurled ridges */}
          <line x1="12" y1="11" x2="12" y2="19" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.6"/>
          <line x1="14" y1="11" x2="14" y2="19" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.6"/>
          <line x1="16" y1="11" x2="16" y2="19" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.6"/>
          {/* Crown stem */}
          <rect x="19.5" y="13.5" width="4" height="3" rx="1" fill="#bfa68a" fillOpacity="0.6"/>
          {/* Crown tip dot (hotspot indicator) */}
          <circle cx="14" cy="14" r="1.2" fill="#f0e6d2" fillOpacity="0.9"/>
        </svg>
      );

    case 'tourbillon':
      // Tourbillon cage — concentric rotating ring with spokes
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ transform: `rotate(${angle}deg)` }}>
          {/* Outer cage ring */}
          <circle cx="16" cy="16" r="12" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7" fill="none" strokeDasharray="3 2"/>
          {/* Inner ring */}
          <circle cx="16" cy="16" r="7" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.5" fill="none"/>
          {/* Spokes */}
          <line x1="16" y1="4" x2="16" y2="9" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="16" y1="23" x2="16" y2="28" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="4" y1="16" x2="9" y2="16" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          <line x1="23" y1="16" x2="28" y2="16" stroke="#bfa68a" strokeWidth="1" strokeOpacity="0.7"/>
          {/* Center jewel */}
          <circle cx="16" cy="16" r="2.5" fill="#bfa68a" fillOpacity="0.4" stroke="#f0e6d2" strokeWidth="0.8"/>
          <circle cx="16" cy="16" r="1" fill="#f0e6d2"/>
        </svg>
      );

    case 'crosshair':
      // Dial precision crosshair — minute track markers around a center dot
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          {/* Outer tick marks at cardinal points */}
          <line x1="16" y1="2" x2="16" y2="8" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="16" y1="24" x2="16" y2="30" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="2" y1="16" x2="8" y2="16" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          <line x1="24" y1="16" x2="30" y2="16" stroke="#f0e6d2" strokeWidth="1.5" strokeOpacity="0.8"/>
          {/* Small diagonal tick marks */}
          <line x1="5" y1="5" x2="8" y2="8" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5"/>
          <line x1="24" y1="5" x2="27" y2="8" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5" transform="scale(-1,1) translate(-32,0)"/>
          <line x1="5" y1="27" x2="8" y2="24" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5" transform="scale(1,-1) translate(0,-32)"/>
          <line x1="27" y1="27" x2="24" y2="24" stroke="#bfa68a" strokeWidth="0.8" strokeOpacity="0.5"/>
          {/* Thin circle */}
          <circle cx="16" cy="16" r="9" stroke="#bfa68a" strokeWidth="0.7" strokeOpacity="0.35" fill="none"/>
          {/* Center dot */}
          <circle cx="16" cy="16" r="2" fill="#f0e6d2" fillOpacity="0.9"/>
          <circle cx="16" cy="16" r="1" fill="white"/>
        </svg>
      );

    case 'lumed':
      // Glowing lume pip — like the luminous dot on a watch hand
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {/* Outer glow rings */}
          <circle cx="12" cy="12" r="10" fill="rgba(173,216,130,0.04)"/>
          <circle cx="12" cy="12" r="7" fill="rgba(173,216,130,0.07)"/>
          <circle cx="12" cy="12" r="4.5" fill="rgba(173,216,130,0.15)" stroke="rgba(173,216,130,0.4)" strokeWidth="0.8"/>
          {/* Core pip */}
          <circle cx="12" cy="12" r="2.5" fill="rgba(180,230,140,0.9)"/>
          <circle cx="11" cy="11" r="0.8" fill="rgba(220,255,200,0.8)"/>
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
      // Spin tourbillon
      if (cursor === 'tourbillon') {
        angleRef.current = (angleRef.current + 0.8) % 360;
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

  const size = cursor === 'tourbillon' ? 32 : cursor === 'lumed' ? 24 : cursor === 'crosshair' ? 32 : 28;
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
