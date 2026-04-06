// Search overlay — AnimatePresence handles mount/unmount and transitions.
// No manual shouldRender/visible state or double-RAF required.
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SUGGESTIONS } from '@/app/components/WatchFinderSearch';
import { EASE_LUXURY, EASE_EXIT } from '@/lib/motion';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Focus input after entrance animation settles
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      setQuery('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    onClose();
    router.push(`/smart-search?q=${encodeURIComponent(trimmed)}`);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search watches"
          onKeyDown={e => e.key === 'Escape' && onClose()}
        >
          {/* Backdrop */}
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_LUXURY }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(4,2,0,0.22)',
            }}
          />

          {/* Centering shell */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 201,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {/* Card — slides from top-right (search icon origin) */}
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, x: 80, y: -56 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, x: 80, y: -56, transition: { duration: 0.16, ease: EASE_EXIT } }}
              transition={{ duration: 0.32, ease: EASE_LUXURY }}
              style={{
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: 700,
                margin: '0 20px',
                borderRadius: 22,
                background: 'rgba(255,255,255,0.082)',
                boxShadow: [
                  'inset 0 0 0 0.5px rgba(255,255,255,0.13)',
                  '0 1px 4px rgba(0,0,0,0.18)',
                  '0 12px 32px rgba(0,0,0,0.26)',
                  '0 40px 80px rgba(0,0,0,0.20)',
                ].join(', '),
                transformOrigin: 'top right',
              }}
            >
              <div style={{ padding: '28px 32px 26px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{
                      fontFamily: 'var(--font-playfair-display)',
                      fontSize: 24,
                      fontWeight: 500,
                      color: '#ecddc8',
                      lineHeight: 1,
                      letterSpacing: '-0.01em',
                    }}>
                      Find Your Watch
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-inter)',
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.30)',
                      background: 'rgba(255,255,255,0.07)',
                      padding: '3px 6px',
                      borderRadius: 99,
                    }}>
                      AI
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.20)',
                      padding: 4, lineHeight: 0, transition: 'color 100ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.50)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.20)')}
                    aria-label="Close"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* Input */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  borderRadius: 13,
                  background: 'rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.11)',
                  marginBottom: 18,
                }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') onClose();
                      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(query); }
                    }}
                    placeholder="Describe what you're looking for…"
                    disabled={loading}
                    style={{
                      flex: 1, minWidth: 0,
                      background: 'transparent', border: 'none',
                      padding: '14px 18px',
                      fontFamily: 'var(--font-inter)',
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.82)',
                      outline: 'none',
                      opacity: loading ? 0.4 : 1,
                    }}
                  />
                  <button
                    onClick={() => handleSubmit(query)}
                    disabled={loading || !query.trim()}
                    style={{
                      flexShrink: 0, marginRight: 8,
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none', borderRadius: 9,
                      padding: '7px 12px',
                      fontFamily: 'var(--font-inter)',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                      cursor: loading || !query.trim() ? 'default' : 'pointer',
                      opacity: loading || !query.trim() ? 0.3 : 1,
                      transition: 'color 100ms, opacity 100ms',
                    }}
                    onMouseEnter={e => { if (query.trim()) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                  >
                    {loading ? '…' : '↵'}
                  </button>
                </div>

                {/* Suggestions */}
                {!loading && (
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-inter)',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.20)',
                      marginBottom: 10,
                    }}>
                      Explore ideas
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => { setQuery(s); handleSubmit(s); }}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.09)',
                            border: 'none', borderRadius: 99,
                            padding: '6px 14px',
                            fontFamily: 'var(--font-inter)',
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.40)',
                            cursor: 'pointer',
                            transition: 'color 100ms, background 100ms',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = 'rgba(255,255,255,0.72)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
