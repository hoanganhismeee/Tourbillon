// Reusable right-sliding panel shell — portal + Framer Motion AnimatePresence.
// Handles backdrop, panel container, header, and body scroll lock.
// Currently features using this: RegisterInterest and Appointment
// Pass `overlays` for fixed-positioned dropdowns that must render outside the scrollable panel.
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_ENTER, EASE_EXIT, DUR, PANEL_EXIT_MS } from '@/lib/motion';

// Re-export for consumers that time form-state resets to the panel exit duration
export { PANEL_EXIT_MS };

interface SlidingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  maxWidth?: number | string;
  onPanelScroll?: () => void;
  overlays?: React.ReactNode;
  children: React.ReactNode;
}

export default function SlidingPanel({
  isOpen, onClose, title, ariaLabel, maxWidth = 520, onPanelScroll, overlays, children,
}: SlidingPanelProps) {
  // SSR guard — createPortal requires document.body
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel ?? title}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        >
          {/* Backdrop — enters slower than panel, exits faster (dissolves before panel finishes sliding) */}
          <motion.div
            key="backdrop"
            onClick={onClose}
            data-lenis-prevent="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_EXIT } }}
            transition={{ duration: 0.4, ease: EASE_ENTER }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              backgroundColor: 'rgba(4,2,0,0.25)',
              overscrollBehavior: 'none',
            }}
          />

          {/* Panel — slides from right */}
          <motion.div
            key="panel"
            data-lenis-prevent="true"
            onClick={e => e.stopPropagation()}
            onScroll={onPanelScroll}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { duration: PANEL_EXIT_MS / 1000, ease: EASE_EXIT } }}
            transition={{ duration: DUR.mid, ease: EASE_ENTER }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
              width: '100%', maxWidth,
              background: '#1a1613',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
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
          </motion.div>

          {/* Overlays — fixed dropdowns rendered outside the scrollable panel */}
          {overlays}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
