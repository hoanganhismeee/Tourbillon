// Search overlay — zero Framer Motion on the card, pure CSS transitions only.
// Double-RAF pattern: mount → paint initial state → trigger CSS transition.
// This runs 100% on the GPU compositor thread with zero JS per frame.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { SUGGESTIONS } from '@/app/components/WatchFinderSearch';
import { EASE_LUXURY_CSS, EASE_EXIT_CSS } from '@/lib/motion';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENTER = EASE_LUXURY_CSS;
const EXIT  = EASE_EXIT_CSS;

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,       setQuery]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [visible,     setVisible]     = useState(false); // drives CSS transition

  // Double-RAF: mount → paint invisible → transition to visible
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(r2);
      });
      return () => cancelAnimationFrame(r1);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setShouldRender(false);
        setQuery('');
        setLoading(false);
      }, 180); // match exit duration
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handleSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    onClose();
    router.push(`/smart-search?q=${encodeURIComponent(trimmed)}`);
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search watches"
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      {/* Backdrop — only background-color transitions, blur is static */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          backgroundColor: visible ? 'rgba(4,2,0,0.22)' : 'rgba(4,2,0,0)',
          transition: visible
            ? `background-color 300ms ${ENTER}`
            : `background-color 150ms ${EXIT}`,
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
        {/* Card — scale + translate from top-right, pure CSS */}
        <div
          onClick={e => e.stopPropagation()}
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
            // Slides from top-right (icon side) → center
            transformOrigin: 'top right',
            transform: visible
              ? 'scale(1) translate(0px, 0px)'
              : 'scale(0.92) translate(80px, -56px)',
            opacity: visible ? 1 : 0,
            transition: visible
              ? `opacity 320ms ${ENTER}, transform 320ms ${ENTER}`
              : `opacity 160ms ${EXIT},  transform 160ms ${EXIT}`,
            willChange: 'transform, opacity',
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
                  padding: 4, lineHeight: 0, transition: `color 100ms`,
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
                  transition: `color 100ms, opacity 100ms`,
                }}
                onMouseEnter={e => { if (query.trim()) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                {loading ? '…' : '↵'}
              </button>
            </div>

            {/* Suggestions — no animation, appear instantly with the card */}
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
                  Try asking
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
                        transition: `color 100ms, background 100ms`,
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
        </div>
      </div>
    </div>,
    document.body
  );
}
