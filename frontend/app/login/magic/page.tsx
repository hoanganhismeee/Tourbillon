// Passwordless magic login: two-step flow.
// Step 1 — user enters email, backend sends a 6-char OTP via SMTP.
// Step 2 — user enters the 6 boxes; on confirm the session cookie is set and they are redirected home.
// Now using the split-panel design for consistency.
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { requestMagicLogin, verifyMagicLogin } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { EASE_LUXURY, EASE_ENTER, DUR } from '@/lib/motion';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.mid, ease: EASE_LUXURY } },
};

const formContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const formItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_ENTER } },
};

const WatchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ opacity: 0.10 }}>
    <circle cx="16" cy="16" r="13" stroke="#bfa68a" strokeWidth="0.8"/>
    <circle cx="16" cy="16" r="1.2" fill="#bfa68a"/>
    <line x1="16" y1="16" x2="11.5" y2="10.5" stroke="#bfa68a" strokeWidth="0.8" strokeLinecap="round"/>
    <line x1="16" y1="16" x2="21" y2="10" stroke="#bfa68a" strokeWidth="0.6" strokeLinecap="round"/>
  </svg>
);

export default function MagicLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [step, setStep] = useState<'email' | 'code'>('email');
  // Initialize email with parameter if present
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestMagicLogin(email.trim());
      setStep('code');
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setChars(Array(CODE_LENGTH).fill(''));
    try {
      await requestMagicLogin(email.trim());
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setError('Failed to resend. Please try again.');
    }
  };

  const handleCharInput = (index: number, value: string) => {
    const char = value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    const next = [...chars];
    next[index] = char;
    setChars(next);
    setError('');
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setChars(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = chars.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please enter all 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyMagicLogin({ email: email.trim(), code });
      await login(result.isNewAccount ? 'new-account' : 'existing-account');
      router.replace(redirect || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
      setChars(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem-50px)] overflow-hidden">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col items-center w-[40%] shrink-0 relative border-r border-[#bfa68a]/10 overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420, height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(191,166,138,0.055) 0%, transparent 70%)',
          }}
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col justify-center flex-1 py-10 w-full max-w-[420px] px-8 xl:px-12"
        >
          <motion.div variants={fadeUp} className="w-8 h-px bg-[#bfa68a]/50 mb-5" />
          <motion.p variants={fadeUp} className="text-[9px] uppercase tracking-[0.5em] text-[#bfa68a] mb-3">
            Member Access
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-playfair text-[2.75rem] font-light text-[#f0e6d2] leading-[1.1] mb-4 whitespace-nowrap">
            Magic Login
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/38 text-[13px] leading-relaxed mb-6">
            Quick, secure, passwordless access to your collection and private advisory.
          </motion.p>

          <motion.div variants={fadeUp} className="space-y-3.5 mb-6">
            {[
              ['Seamless Entry', 'No passwords to remember, just a secure one-time code'],
              ['Personal Advisors', 'One-on-one guidance from certified horological experts'],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3">
                <div className="w-px h-9 bg-[#bfa68a]/22 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10.5px] text-[#f0e6d2]/65 font-medium tracking-wide">{title}</p>
                  <p className="text-[10.5px] text-white/22 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.blockquote variants={fadeUp} className="border-l-2 border-[#bfa68a]/60 pl-6 py-1 mt-2">
            <p className="text-[#f0e6d2] font-playfair text-[1.4rem] leading-relaxed italic">
              &ldquo;Simplicity is the ultimate sophistication.&rdquo;
            </p>
            <cite className="block text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70 mt-3 not-italic">
              Leonardo Da Vinci
            </cite>
          </motion.blockquote>
        </motion.div>

        <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
          <WatchIcon />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-8 lg:px-12 xl:px-20">
        <motion.div
          variants={formContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[400px]"
        >
          {step === 'email' ? (
            <>
              <motion.p variants={formItem} className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2.5">
                Passwordless
              </motion.p>
              <motion.h1 variants={formItem} className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-7 whitespace-nowrap">
                Sign in without password
              </motion.h1>
              <motion.p variants={formItem} className="text-white/35 text-[12px] mb-7 leading-relaxed">
                Enter your email and we&apos;ll send you a secure one-time code.
              </motion.p>

              <form onSubmit={handleSendCode} className="space-y-5" noValidate>
                <motion.div variants={formItem}>
                  <label className="block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoFocus
                      required
                      className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none transition text-sm"
                    />
                    <span
                      className="absolute bottom-0 left-0 h-px bg-[#bfa68a]/70 transition-all duration-300 origin-left"
                      style={{ width: '100%', transform: 'scaleX(1)' }}
                    />
                  </div>
                </motion.div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[#e07575] text-xs">
                    {error}
                  </motion.p>
                )}

                <motion.div variants={formItem} className="pt-1">
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-500"
                    style={{
                      background: 'linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)',
                      backgroundSize: '200% 100%',
                      backgroundPosition: '0% 0',
                      color: '#1e1206',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 0'; }}
                  >
                    {loading ? 'Sending...' : 'Send Code'}
                  </button>
                </motion.div>
              </form>
            </>
          ) : (
            <>
              <motion.p variants={formItem} className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2.5">
                Verification
              </motion.p>
              <motion.h1 variants={formItem} className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-4">
                Enter Code
              </motion.h1>
              <motion.p variants={formItem} className="text-white/35 text-[12px] mb-7 leading-relaxed">
                A 6-character code was sent to <span className="text-[#f0e6d2]">{email}</span>
              </motion.p>

              <form onSubmit={handleVerify} className="space-y-6" noValidate>
                <motion.div variants={formItem} className="flex justify-between gap-2" onPaste={handlePaste}>
                  {chars.map((char, i) => (
                    <div key={i} className="relative w-10">
                      <input
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="text"
                        maxLength={1}
                        value={char}
                        onChange={e => handleCharInput(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        className="w-full h-12 text-center text-xl font-playfair font-light text-white bg-transparent border-b-2 focus:outline-none transition-colors duration-200 uppercase"
                        style={{ borderColor: char ? 'rgba(191,166,138,0.65)' : 'rgba(255,255,255,0.15)' }}
                      />
                    </div>
                  ))}
                </motion.div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[#e07575] text-xs">
                    {error}
                  </motion.p>
                )}

                <motion.div variants={formItem} className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || chars.some(c => !c)}
                    className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-500 mb-4"
                    style={{
                      background: 'linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)',
                      backgroundSize: '200% 100%',
                      backgroundPosition: '0% 0',
                      color: '#1e1206',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 0'; }}
                  >
                    {loading ? 'Verifying...' : 'Confirm'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                    className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium border border-white/12 text-white/45 hover:border-[#bfa68a]/35 hover:text-white/70 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                  </button>
                </motion.div>
              </form>
            </>
          )}

          <motion.div variants={formItem} className="mt-6 text-center space-y-2">
            <p className="text-[10.5px] text-white/22">
              <button
                onClick={() => {
                  if (step === 'code') {
                    setStep('email');
                    setChars(Array(CODE_LENGTH).fill(''));
                    setError('');
                  } else {
                    router.push('/login');
                  }
                }}
                className="hover:text-white/45 transition"
              >
                {step === 'code' ? 'Change email' : 'Back to password login'}
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
