// Sliding "Register Your Interest" panel — portal + double-RAF + pure CSS transitions.
// Same animation pattern as AppointmentPanel; single-scroll form (no accordion).
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { submitRegisterInterest } from '@/lib/api';

interface RegisterInterestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  watchId?: number;
  brandName?: string;
  collectionName?: string;
  watchDescription?: string;
  watchReference?: string;
  watchImageUrl?: string;
  watchPrice?: number;
}

// Easing curves — same as AppointmentPanel
const ENTER = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EXIT  = 'cubic-bezier(0.4, 0, 1, 1)';

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr'];

const PHONE_REGIONS = [
  { code: '+61', label: 'Australia' },
  { code: '+93', label: 'Afghanistan' },
  { code: '+355', label: 'Albania' },
  { code: '+213', label: 'Algeria' },
  { code: '+1', label: 'United States' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+33', label: 'France' },
  { code: '+49', label: 'Germany' },
  { code: '+39', label: 'Italy' },
  { code: '+34', label: 'Spain' },
  { code: '+351', label: 'Portugal' },
  { code: '+41', label: 'Switzerland' },
  { code: '+43', label: 'Austria' },
  { code: '+32', label: 'Belgium' },
  { code: '+31', label: 'Netherlands' },
  { code: '+46', label: 'Sweden' },
  { code: '+47', label: 'Norway' },
  { code: '+45', label: 'Denmark' },
  { code: '+358', label: 'Finland' },
  { code: '+48', label: 'Poland' },
  { code: '+420', label: 'Czech Republic' },
  { code: '+36', label: 'Hungary' },
  { code: '+40', label: 'Romania' },
  { code: '+30', label: 'Greece' },
  { code: '+90', label: 'Turkey' },
  { code: '+7', label: 'Russia' },
  { code: '+380', label: 'Ukraine' },
  { code: '+81', label: 'Japan' },
  { code: '+82', label: 'South Korea' },
  { code: '+86', label: 'China' },
  { code: '+852', label: 'Hong Kong' },
  { code: '+886', label: 'Taiwan' },
  { code: '+65', label: 'Singapore' },
  { code: '+60', label: 'Malaysia' },
  { code: '+66', label: 'Thailand' },
  { code: '+84', label: 'Vietnam' },
  { code: '+62', label: 'Indonesia' },
  { code: '+63', label: 'Philippines' },
  { code: '+91', label: 'India' },
  { code: '+92', label: 'Pakistan' },
  { code: '+880', label: 'Bangladesh' },
  { code: '+971', label: 'UAE' },
  { code: '+966', label: 'Saudi Arabia' },
  { code: '+974', label: 'Qatar' },
  { code: '+972', label: 'Israel' },
  { code: '+20', label: 'Egypt' },
  { code: '+27', label: 'South Africa' },
  { code: '+234', label: 'Nigeria' },
  { code: '+254', label: 'Kenya' },
  { code: '+55', label: 'Brazil' },
  { code: '+54', label: 'Argentina' },
  { code: '+56', label: 'Chile' },
  { code: '+52', label: 'Mexico' },
  { code: '+57', label: 'Colombia' },
  { code: '+64', label: 'New Zealand' },
  { code: '+353', label: 'Ireland' },
  { code: '+354', label: 'Iceland' },
  { code: '+352', label: 'Luxembourg' },
  { code: '+377', label: 'Monaco' },
];

export default function RegisterInterestPanel({
  isOpen, onClose,
  watchId, brandName, collectionName, watchReference, watchImageUrl, watchPrice,
}: RegisterInterestPanelProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible]           = useState(false);

  // Form state
  const [salutation, setSalutation]           = useState('');
  const [salutationOpen, setSalutationOpen]   = useState(false);
  const [salutationRect, setSalutationRect]   = useState<DOMRect | null>(null);
  const salutationBtnRef = useRef<HTMLButtonElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [phoneRegion, setPhoneRegion]         = useState('+61');
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [regionDropdownRect, setRegionDropdownRect] = useState<DOMRect | null>(null);
  const regionBtnRef = useRef<HTMLButtonElement>(null);

  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Double-RAF: mount -> paint invisible -> transition to visible
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const r1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(r1);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setShouldRender(false);
        setSalutation('');
        setSalutationOpen(false);
        setSalutationRect(null);
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setPhoneRegion('+61');
        setRegionDropdownOpen(false);
        setRegionDropdownRect(null);
        setMessage('');
        setSubmitting(false);
        setSubmitted(false);
        setError(null);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Auto-fill from authenticated user
  useEffect(() => {
    if (isOpen && user) {
      setFirstName(prev => prev || user.firstName || '');
      setLastName(prev => prev || user.lastName || '');
      setEmail(user.email || '');
      setPhone(prev => prev || user.phoneNumber || '');
    }
  }, [isOpen, user]);

  const canSubmit = salutation !== '' && firstName.trim() !== '' && lastName.trim() !== '' && email.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRegisterInterest({
        salutation,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        phoneRegionCode: phone.trim() ? phoneRegion : undefined,
        message: message.trim() || undefined,
        watchId,
        brandName,
        collectionName,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeAllDropdowns = () => {
    setSalutationOpen(false);
    setRegionDropdownOpen(false);
  };

  if (!shouldRender) return null;

  const priceStr = watchPrice != null
    ? (watchPrice === 0 ? 'Price on Request' : `$${watchPrice.toLocaleString('en-US', { minimumFractionDigits: 0 })}`)
    : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Register your interest"
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
        onScroll={closeAllDropdowns}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: '100%', maxWidth: 520,
          background: '#1a1613',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: visible
            ? `transform 500ms ${ENTER}`
            : `transform 350ms ${EXIT}`,
          willChange: 'transform',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <h2 className="font-playfair text-xl text-[#ecddc8]">
            {submitted ? 'Interest Registered' : 'Register Your Interest'}
          </h2>
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

        {submitted ? (
          /* Success State */
          <div className="flex flex-col items-center text-center px-8 pt-8 pb-8">
            <div className="w-16 h-16 rounded-full border-2 border-[#bfa68a] flex items-center justify-center mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bfa68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h3 className="text-white/90 text-lg font-medium mb-2">
              Thank you, {firstName}
            </h3>
            {brandName && (
              <p className="text-white/60 text-sm mb-1">
                We have received your interest in <span className="text-white/80">{brandName}</span>.
              </p>
            )}
            <p className="text-white/40 text-sm mt-4">
              A confirmation has been sent to {email}.
            </p>
            <p className="text-white/40 text-sm mt-1">
              Our advisors will personally reach out within 24–48 hours.
            </p>
            <button
              onClick={onClose}
              className="mt-10 py-3.5 px-12 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-8 pb-10">
            {/* Sign-in prompt for guests */}
            {!authLoading && !isAuthenticated && (
              <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-white/50 text-sm">Already joined Tourbillon?</span>
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/watches/${watchId}`)}`}
                  className="text-[#bfa68a] hover:text-[#d4c4a8] text-sm font-medium transition-colors"
                >
                  Sign in
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {/* Salutation */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Salutation *</label>
                <div className="flex-shrink-0">
                  <button
                    ref={salutationBtnRef}
                    type="button"
                    onClick={() => {
                      if (salutationBtnRef.current) setSalutationRect(salutationBtnRef.current.getBoundingClientRect());
                      setSalutationOpen(prev => !prev);
                      setRegionDropdownOpen(false);
                    }}
                    className="flex items-center justify-between gap-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm hover:border-white/20 focus:outline-none focus:border-[#bfa68a]/50 transition-colors"
                  >
                    <span className={salutation ? 'text-white' : 'text-white/30'}>
                      {salutation || 'Select salutation'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/40 flex-shrink-0">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* First / Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-2">First Name *</label>
                  <input
                    type="text" value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors text-sm"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Last Name *</label>
                  <input
                    type="text" value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors text-sm"
                    placeholder="Last name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Email *</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  readOnly={isAuthenticated && !!user?.email}
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors text-sm ${
                    isAuthenticated && user?.email ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  placeholder="Email address"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Mobile Number <span className="text-white/30">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-shrink-0">
                    <button
                      ref={regionBtnRef}
                      type="button"
                      onClick={() => {
                        if (regionBtnRef.current) setRegionDropdownRect(regionBtnRef.current.getBoundingClientRect());
                        setRegionDropdownOpen(prev => !prev);
                        setSalutationOpen(false);
                      }}
                      className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm hover:border-white/20 focus:outline-none focus:border-[#bfa68a]/50 transition-colors min-w-[90px]"
                    >
                      <span>{phoneRegion}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/40 ml-auto">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                  </div>
                  <input
                    type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors text-sm"
                    placeholder="Mobile number"
                  />
                </div>
              </div>

              {/* Your Request */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Your Request</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition-colors text-sm resize-none"
                  placeholder="Tell us what captivates you about this timepiece — its complications, craftsmanship, or the story behind its creation. Our advisors will personally reach out to assist you."
                />
                <p className="text-white/20 text-xs text-right mt-1">{message.length}/2000</p>
              </div>

              {/* Watch of Interest — read-only product card */}
              {(brandName || collectionName || watchReference) && (
                <div className="rounded-xl bg-white/5 border border-white/8 p-4 opacity-70">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Watch of Interest</p>
                  <div className="flex gap-3">
                    {watchImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={watchImageUrl} alt={watchReference || ''} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-white/5" />
                    )}
                    <div>
                      {brandName && <p className="text-white/70 text-sm font-medium">{brandName}</p>}
                      {collectionName && <p className="text-white/50 text-sm">{collectionName}</p>}
                      {watchReference && <p className="text-white/40 text-xs font-mono mt-1">Ref. {watchReference}</p>}
                      {priceStr && <p className="text-white/50 text-xs mt-1">{priceStr}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation note */}
              <p className="text-white/40 text-sm text-center pt-1">
                A confirmation will be sent to your email address.
              </p>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-full py-3 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Register Interest'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Salutation dropdown — fixed, outside scroll container */}
      {salutationOpen && salutationRect && (
        <div
          style={{
            position: 'fixed',
            top: salutationRect.bottom + 4,
            left: salutationRect.left,
            width: salutationRect.width,
            background: '#252220',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 300,
          }}
        >
          {SALUTATIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { setSalutation(s); setSalutationOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', fontSize: 14, border: 'none', cursor: 'pointer',
                background: salutation === s ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: salutation === s ? '#ecddc8' : 'rgba(255,255,255,0.7)',
                fontWeight: salutation === s ? 600 : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Phone region dropdown — fixed, outside scroll container, appears left of button */}
      {regionDropdownOpen && regionDropdownRect && (
        <div
          style={{
            position: 'fixed',
            top: regionDropdownRect.top,
            left: regionDropdownRect.left - 248,
            width: 240,
            maxHeight: 208,
            overflowY: 'auto',
            background: '#252220',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 300,
          }}
        >
          {PHONE_REGIONS.map(r => (
            <button
              key={r.code + r.label}
              type="button"
              onClick={() => { setPhoneRegion(r.code); setRegionDropdownOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', fontSize: 14, border: 'none', cursor: 'pointer',
                background: phoneRegion === r.code ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: phoneRegion === r.code ? '#ecddc8' : 'rgba(255,255,255,0.7)',
                fontWeight: phoneRegion === r.code ? 600 : 400,
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.code}</span>{' '}
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
