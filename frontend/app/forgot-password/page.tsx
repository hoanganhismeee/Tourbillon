// Forgot password — three-step flow: email → verify OTP → reset password.
// Now using the split-panel luxury design.
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { forgotPassword, verifyCode, resetPassword } from '@/lib/api';
import { EASE_LUXURY, EASE_ENTER, DUR } from '@/lib/motion';

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

function FieldInput({
  label, type = 'text', value, onChange, placeholder, right, autoFocus,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  right?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required
          className={`w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none transition text-sm ${right ? 'pr-12' : ''}`}
        />
        <span
          className="absolute bottom-0 left-0 h-px bg-[#bfa68a]/70 transition-all duration-300 origin-left"
          style={{ width: '100%', transform: focused ? 'scaleX(1)' : 'scaleX(0)' }}
        />
        {right}
      </div>
    </div>
  );
}

function OtpInput({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const focus = (i: number) => refs.current[i]?.focus();

  const buildValue = (i: number, char: string) => {
    const next = [...cells];
    next[i] = char;
    return next.join('');
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    onChange(buildValue(i, char));
    if (char && i < 5) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (cells[i]) { onChange(buildValue(i, '')); }
      else if (i > 0) { onChange(buildValue(i - 1, '')); focus(i - 1); }
    } else if (e.key === 'ArrowLeft' && i > 0) focus(i - 1);
    else if (e.key === 'ArrowRight' && i < 5) focus(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(digits);
    focus(Math.min(digits.length, 5));
  };

  return (
    <div className="flex justify-between gap-2 py-2">
      {cells.map((digit, i) => (
        <div key={i} className="relative w-10">
          <input
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            autoFocus={i === 0}
            className="w-full h-12 text-center text-xl font-playfair font-light text-white bg-transparent border-b-2 focus:outline-none transition-colors duration-200"
            style={{ borderColor: digit ? 'rgba(191,166,138,0.65)' : 'rgba(255,255,255,0.15)' }}
          />
        </div>
      ))}
    </div>
  );
}

function GoldButton({ loading, label, loadingLabel, disabled }: {
  loading: boolean;
  label: string;
  loadingLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
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
      {loading ? loadingLabel : label}
    </button>
  );
}

const STEPS = ['email', 'verify', 'reset'] as const;
type Step = typeof STEPS[number];

const stepVariants = {
  enter:  { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0,  transition: { duration: 0.35, ease: EASE_ENTER } },
  exit:   { opacity: 0, x: -20, transition: { duration: 0.25, ease: EASE_ENTER } },
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const startCountdown = (secs = 30) => {
    setCountdown(secs);
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(tick); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await forgotPassword({ email });
      setStep('verify');
      startCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      await forgotPassword({ email });
      setSuccess('New code sent.');
      startCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const runVerify = async (codeValue: string) => {
    if (codeValue.length !== 6 || loading) return;
    setError(''); setLoading(true);
    try {
      await verifyCode({ email, code: codeValue });
      setStep('reset');
    } catch {
      setError('Incorrect or expired code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runVerify(code);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword({ email, code, newPassword });
      setSuccess('Password updated. Redirecting…');
      setTimeout(() => router.push('/auth/start'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels: Record<Step, { eyebrow: string; heading: string; sub: string }> = {
    email:  { eyebrow: 'Recovery', heading: 'Reset Password',     sub: 'Enter your email and we\'ll send a verification code.' },
    verify: { eyebrow: 'Verification', heading: 'Enter Code',     sub: `Code sent to ${email}` },
    reset:  { eyebrow: 'New Password', heading: 'Set New Password', sub: 'Choose a password at least 8 characters long.' },
  };

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

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
            Account Access
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-playfair text-[2.75rem] font-light text-[#f0e6d2] leading-[1.1] mb-4 whitespace-nowrap">
            Secure Recovery
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/38 text-[13px] leading-relaxed mb-6">
            Regain access to your Tourbillon vault and private advisory.
          </motion.p>

          <motion.div variants={fadeUp} className="space-y-3.5 mb-6">
            {[
              ['Secure Process', 'Protected by multi-factor authentication'],
              ['Privacy First', 'Your collection data remains safely encrypted'],
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
              &ldquo;Time is the most valuable thing a man can spend.&rdquo;
            </p>
            <cite className="block text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70 mt-3 not-italic">
              Theophrastus
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
          {/* Progress bar */}
          <motion.div variants={formItem} className="flex gap-1.5 mb-8">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className="h-px transition-all duration-500"
                style={{
                  flex: i === stepIndex ? '2' : '1',
                  background: i < stepIndex
                    ? 'rgba(191,166,138,0.45)'
                    : i === stepIndex
                    ? 'rgba(191,166,138,0.85)'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="min-h-[220px]"
            >
              <p className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2.5">
                {stepLabels[step].eyebrow}
              </p>
              <h1 className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-3">
                {stepLabels[step].heading}
              </h1>
              <p className="text-white/35 text-[12px] mb-7 leading-relaxed">
                {stepLabels[step].sub}
              </p>

              {/* ── Step 1: Email ── */}
              {step === 'email' && (
                <form onSubmit={handleSendCode} className="space-y-6" noValidate>
                  <FieldInput
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                  />
                  {error && <p className="text-[#e07575] text-xs">{error}</p>}
                  <GoldButton loading={loading} label="Send Code" loadingLabel="Sending…" />
                </form>
              )}

              {/* ── Step 2: OTP ── */}
              {step === 'verify' && (
                <form onSubmit={handleVerifySubmit} className="space-y-6" noValidate>
                  <OtpInput
                    value={code}
                    onChange={v => { setCode(v); if (v.length === 6) runVerify(v); }}
                    disabled={loading}
                  />
                  
                  {error && <p className="text-[#e07575] text-xs">{error}</p>}
                  {success && <p className="text-[#bfa68a]/75 text-xs">{success}</p>}

                  <div className="pt-2 space-y-4">
                    {code.length === 6 ? (
                      <GoldButton loading={loading} label="Verify Code" loadingLabel="Verifying…" />
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading || countdown > 0}
                        className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium border border-white/12 text-white/45 hover:border-[#bfa68a]/35 hover:text-white/70 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300"
                      >
                        {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setStep('email'); setCode(''); setError(''); setSuccess(''); }}
                      className="block w-full text-center text-[9px] uppercase tracking-[0.2em] text-white/25 hover:text-white/45 transition"
                    >
                      ← Different email
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step 3: New password ── */}
              {step === 'reset' && (
                <form onSubmit={handleReset} className="space-y-5" noValidate>
                  <FieldInput
                    label="New Password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    right={
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        tabIndex={-1}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition text-[8.5px] uppercase tracking-widest"
                      >
                        {showNew ? 'Hide' : 'Show'}
                      </button>
                    }
                  />
                  <div>
                    <FieldInput
                      label="Confirm Password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      right={
                        <button
                          type="button"
                          onClick={() => setShowConfirm(v => !v)}
                          tabIndex={-1}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition text-[8.5px] uppercase tracking-widest"
                        >
                          {showConfirm ? 'Hide' : 'Show'}
                        </button>
                      }
                    />
                    {passwordsMatch && (
                      <p className="text-[10px] text-[#bfa68a]/65 mt-2 tracking-wide">Passwords match</p>
                    )}
                    {passwordsMismatch && (
                      <p className="text-[10px] text-[#e07575]/80 mt-2">Passwords do not match</p>
                    )}
                  </div>

                  {error && <p className="text-[#e07575] text-xs pt-1">{error}</p>}
                  {success && <p className="text-[#bfa68a]/75 text-xs pt-1">{success}</p>}

                  <div className="pt-2">
                    <GoldButton loading={loading} label="Set New Password" loadingLabel="Saving…" />
                  </div>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer link */}
          <motion.div variants={formItem} className="mt-8 text-center">
            <p className="text-[10.5px] text-white/22">
              Remember your password?{' '}
              <Link href="/login" className="text-[#bfa68a]/65 hover:text-[#bfa68a] transition">
                Sign In
              </Link>
            </p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}
