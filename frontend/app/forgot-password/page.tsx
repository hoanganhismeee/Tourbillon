// Forgot password — three-step flow: email → verify OTP → reset password.
// Card-centered layout. AnimatePresence drives step transitions.
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { forgotPassword, verifyCode, resetPassword } from '@/lib/api';
import { EASE_LUXURY, EASE_ENTER } from '@/lib/motion';

// Underline-animated label + input, consistent with login/register style
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

// Six individual digit boxes — auto-advance, backspace, arrow nav, paste support
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
    <div className="flex gap-3 justify-center py-2">
      {cells.map((digit, i) => (
        <div key={i} className="relative">
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
            className="w-11 h-14 text-center text-2xl font-playfair font-light text-white bg-transparent border-b-2 focus:outline-none transition-colors duration-200"
            style={{ borderColor: digit ? 'rgba(191,166,138,0.65)' : 'rgba(255,255,255,0.15)' }}
          />
        </div>
      ))}
    </div>
  );
}

// Gold gradient CTA button — same shimmer pattern as login/register
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
  enter:  { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0,  transition: { duration: 0.3, ease: EASE_ENTER } },
  exit:   { opacity: 0, x: -24, transition: { duration: 0.2, ease: EASE_ENTER } },
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

  const stepIndex = STEPS.indexOf(step);

  // Countdown ticker — started when code is sent
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

  // Called from OTP onChange (auto-submit) and form submit
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
    <div className="flex justify-center items-center h-[calc(100vh-3rem-50px)] overflow-hidden px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_LUXURY }}
        className="w-full max-w-[420px] bg-white/[0.04] border border-[#bfa68a]/20 rounded-2xl shadow-2xl backdrop-blur-xl p-10"
      >
        {/* Step progress — three dashes */}
        <div className="flex gap-1.5 mb-8">
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
        </div>

        {/* Step content — transitions sideways */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {/* Eyebrow + heading */}
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2">
              {stepLabels[step].eyebrow}
            </p>
            <h1 className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-1.5">
              {stepLabels[step].heading}
            </h1>
            <p className="text-white/35 text-[12px] mb-7 leading-relaxed">
              {stepLabels[step].sub}
            </p>

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="space-y-5">
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
              <form onSubmit={handleVerifySubmit} className="space-y-5">
                <OtpInput
                  value={code}
                  onChange={v => { setCode(v); if (v.length === 6) runVerify(v); }}
                  disabled={loading}
                />
                {error && <p className="text-[#e07575] text-xs text-center">{error}</p>}
                {success && <p className="text-[#bfa68a]/75 text-xs text-center">{success}</p>}

                {/* Verify or resend depending on code state */}
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
                  className="block w-full text-center text-[10px] text-white/25 hover:text-white/45 transition uppercase tracking-[0.2em]"
                >
                  ← Different email
                </button>
              </form>
            )}

            {/* ── Step 3: New password ── */}
            {step === 'reset' && (
              <form onSubmit={handleReset} className="space-y-5">
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
                  {/* Real-time match feedback */}
                  {passwordsMatch && (
                    <p className="text-[10px] text-[#bfa68a]/65 mt-2 tracking-wide">Passwords match</p>
                  )}
                  {passwordsMismatch && (
                    <p className="text-[10px] text-[#e07575]/80 mt-2">Passwords do not match</p>
                  )}
                </div>

                {error && <p className="text-[#e07575] text-xs">{error}</p>}
                {success && <p className="text-[#bfa68a]/75 text-xs">{success}</p>}

                <GoldButton loading={loading} label="Set New Password" loadingLabel="Saving…" />
              </form>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer link */}
        <p className="mt-7 text-[10.5px] text-white/22 text-center">
          Remember your password?{' '}
          <Link href="/auth/start" className="text-[#bfa68a]/65 hover:text-[#bfa68a] transition">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
