// Passwordless magic login: two-step flow.
// Step 1 — user enters email, backend sends a 6-char OTP via SMTP.
// Step 2 — user enters the 6 boxes; on confirm the session cookie is set and they are redirected home.
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { requestMagicLogin, verifyMagicLogin } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import StaggeredFade from '../../scrollMotion/StaggeredFade';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function MagicLoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Count down the resend cooldown every second
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── Step 1: send code ─────────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestMagicLogin(email.trim());
      setStep('code');
      setCooldown(RESEND_COOLDOWN);
      // Focus first box after render
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

  // ── Step 2: OTP boxes ─────────────────────────────────────────────────────
  const handleCharInput = (index: number, value: string) => {
    // Accept only one alphanumeric char; uppercase for consistency
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

  // ── Step 2: verify ────────────────────────────────────────────────────────
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
      await verifyMagicLogin({ email: email.trim(), code });
      await login();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
      setChars(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <StaggeredFade>
      <div className="flex justify-center items-center h-screen overflow-hidden" style={{ height: '100vh' }}>
        <div className="w-full max-w-md p-8 space-y-6 bg-white/5 border border-[#bfa68a] rounded-2xl shadow-lg backdrop-blur-lg transform -translate-y-[25%]">

          {step === 'email' ? (
            <>
              <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Sign in without a password</h1>
              <p className="text-[#bfa68a] text-sm text-center">
                Enter your email and we&apos;ll send you a one-time code.
              </p>
              <form onSubmit={handleSendCode} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full h-10 px-4 rounded-md border border-[#bfa68a] text-[#bfa68a] bg-transparent placeholder-[#bfa68a]/70 focus:outline-none"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition"
                >
                  {loading ? 'Sending...' : 'Send code'}
                </button>
              </form>
              <p className="text-sm text-center text-[#bfa68a]">
                <Link href="/login" className="underline hover:text-[#F9F6F2]">Back to login</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-playfair text-center text-[#F9F6F2]">Enter your code</h1>
              <p className="text-[#bfa68a] text-sm text-center">
                A 6-character code was sent to <span className="text-[#F9F6F2]">{email}</span>
              </p>
              <form onSubmit={handleVerify} className="space-y-6">
                {/* Six individual character boxes */}
                <div className="flex justify-center gap-3" onPaste={handlePaste}>
                  {chars.map((char, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={char}
                      onChange={e => handleCharInput(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      className="w-11 h-14 text-center text-xl font-semibold rounded-md border border-[#bfa68a] text-[#F9F6F2] bg-transparent focus:outline-none focus:border-[#f0e6d2] transition uppercase"
                    />
                  ))}
                </div>

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || chars.some(c => !c)}
                  className="w-full py-2 font-semibold text-[#1e1512] bg-gradient-to-r from-[#bfa68a] to-[#f0e6d2] rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition"
                >
                  {loading ? 'Verifying...' : 'Confirm'}
                </button>
              </form>

              <p className="text-sm text-center text-[#bfa68a]">
                Didn&apos;t receive it?{' '}
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="underline hover:text-[#F9F6F2] disabled:opacity-50 disabled:no-underline cursor-pointer bg-transparent border-none"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </p>
              <p className="text-sm text-center text-[#bfa68a]">
                <button
                  onClick={() => { setStep('email'); setChars(Array(CODE_LENGTH).fill('')); setError(''); }}
                  className="underline hover:text-[#F9F6F2] cursor-pointer bg-transparent border-none"
                >
                  Change email
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </StaggeredFade>
  );
}
