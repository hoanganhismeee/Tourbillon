// Reusable right-sliding panel shell — portal + double-RAF + pure CSS transitions.
// Handles backdrop, panel container, header, and body scroll lock.
// Currently features using this: RegisterInterest and Appointment
// Pass `overlays` for fixed-positioned dropdowns that must render outside the scrollable panel.
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ENTER = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const EXIT  = 'cubic-bezier(0.4, 0, 0.6, 1)';

export const PANEL_EXIT_MS = 420;

interface SlidingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  onPanelScroll?: () => void;
  overlays?: React.ReactNode;
  children: React.ReactNode;
}

export default function SlidingPanel({
  isOpen, onClose, title, ariaLabel, onPanelScroll, overlays, children,
}: SlidingPanelProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible]           = useState(false);

  // Double-RAF: mount → paint invisible → CSS transition to visible
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const r1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(r1);
    } else {
      setVisible(false);
      const t = setTimeout(() => setShouldRender(false), PANEL_EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          backgroundColor: visible ? 'rgba(4,2,0,0.25)' : 'rgba(4,2,0,0)',
          transition: visible
            ? `background-color 400ms ${ENTER}`
            : `background-color 250ms ${EXIT}`,
        }}
      />

      {/* Panel — slides from right */}
      <div
        onClick={e => e.stopPropagation()}
        onScroll={onPanelScroll}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: '100%', maxWidth: 520,
          background: '#1a1613',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: visible
            ? `transform 600ms ${ENTER}`
            : `transform ${PANEL_EXIT_MS}ms ${EXIT}`,
          willChange: 'transform',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <h2 className="font-playfair text-xl text-[#ecddc8]">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/20 hover:text-white/50 transition-colors p-1"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {children}
      </div>

      {/* Overlays — fixed dropdowns rendered outside the scrollable panel */}
      {overlays}
    </div>,
    document.body
  );
}
