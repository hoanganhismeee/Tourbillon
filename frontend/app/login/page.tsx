// Login page — split-panel layout, brand panel left, form right.
// Accepts ?email=... from /auth/start (shows locked email chip + password only).
// Also works standalone (email + password form) for direct navigation.
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { loginUser } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { openGoogleAuthPopup } from '@/lib/googleAuth';
import { EASE_LUXURY, EASE_ENTER, DUR } from '@/lib/motion';

const GOOGLE_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5248/api'}/authentication/google`;

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

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
    <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z" />
    <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z" />
    <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z" />
  </svg>
);

const WatchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ opacity: 0.10 }}>
    <circle cx="16" cy="16" r="13" stroke="#bfa68a" strokeWidth="0.8" />
    <circle cx="16" cy="16" r="1.2" fill="#bfa68a" />
    <line x1="16" y1="16" x2="11.5" y2="10.5" stroke="#bfa68a" strokeWidth="0.8" strokeLinecap="round" />
    <line x1="16" y1="16" x2="21" y2="10" stroke="#bfa68a" strokeWidth="0.6" strokeLinecap="round" />
  </svg>
);

function FocusInput({
  type, value, onChange, placeholder, autoComplete, right
}: {
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete?: string;
  right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={`w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none transition text-sm ${right ? 'pr-12' : ''}`}
      />
      <span
        className="absolute bottom-0 left-0 h-px bg-[#bfa68a]/70 transition-all duration-300 origin-left"
        style={{ width: '100%', transform: focused ? 'scaleX(1)' : 'scaleX(0)' }}
      />
      {right}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  // Pre-filled email from /auth/start — locked chip mode
  const prefilledEmail = searchParams.get('email') ?? '';
  const isSmartFlow = prefilledEmail.length > 0;

  useEffect(() => {
    if (prefilledEmail) setEmail(prefilledEmail);
  }, [prefilledEmail]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser({ email, password });
      await login();
      router.push(redirect || '/');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // Build the "← Change" href back to /auth/start
  const changeEmailHref = `/auth/start${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;

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
          className="relative z-10 flex flex-col justify-center flex-1 py-10 w-full max-w-[460px] px-8 xl:px-10"
        >
          <motion.div variants={fadeUp} className="w-8 h-px bg-[#bfa68a]/50 mb-5" />
          <motion.p variants={fadeUp} className="text-[9px] uppercase tracking-[0.5em] text-[#bfa68a] mb-3">
            Member Access
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-playfair text-[2.75rem] font-light text-[#f0e6d2] leading-[1.1] mb-4 whitespace-nowrap">
            Welcome Back
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/38 text-[13px] leading-relaxed mb-6">
            Access your collection, track orders, and connect with our private advisors.
          </motion.p>

          <motion.div variants={fadeUp} className="space-y-3.5 mb-6">
            {[
              ['Curated Collections', 'Hand-selected timepieces from the Holy Trinity and beyond'],
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
              &ldquo;Give me the perfect oil and I will give you the perfect watch.&rdquo;
            </p>
            <cite className="block text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70 mt-3 not-italic">
              Abraham-Louis Breguet
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
          <motion.p variants={formItem} className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2.5">
            Sign In
          </motion.p>
          <motion.h1 variants={formItem} className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-7">
            Your Account
          </motion.h1>

          {/* Smart flow: locked email chip — only shown when coming from /auth/start */}
          {isSmartFlow && (
            <motion.div variants={formItem} className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
              <span className="text-[13px] text-white/70 truncate">{prefilledEmail}</span>
              <Link
                href={changeEmailHref}
                className="text-[9px] uppercase tracking-[0.22em] text-[#bfa68a]/55 hover:text-[#bfa68a] transition ml-4 shrink-0"
              >
                ← Change
              </Link>
            </motion.div>
          )}

          {/* Google — only shown in standalone mode */}
          {!isSmartFlow && (
            <>
              <motion.div variants={formItem}>
                <button
                  type="button"
                  onClick={() => {
                    if (redirect) sessionStorage.setItem('authRedirect', redirect);
                    openGoogleAuthPopup(GOOGLE_AUTH_URL, () => {
                      login().then(() => {
                        const dest = sessionStorage.getItem('authRedirect') || redirect || '/';
                        sessionStorage.removeItem('authRedirect');
                        router.replace(dest);
                      });
                    });
                  }}
                  className="flex items-center justify-center gap-3 w-full py-3 border border-white/14 text-white/55 hover:border-[#bfa68a]/35 hover:text-white/75 transition text-[9.5px] uppercase tracking-[0.18em] mb-5"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </motion.div>
              <motion.div variants={formItem} className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[8.5px] uppercase tracking-[0.22em] text-white/28">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </motion.div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email field — only in standalone mode */}
            {!isSmartFlow && (
              <motion.div variants={formItem}>
                <label className="block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65 mb-2">
                  Email
                </label>
                <FocusInput
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </motion.div>
            )}

            <motion.div variants={formItem}>
              <label className="block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65 mb-2">
                Password
              </label>
              <FocusInput
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                right={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition text-[8.5px] uppercase tracking-widest"
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                }
              />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#e07575] text-xs"
              >
                {error}
              </motion.p>
            )}

            <motion.div variants={formItem} className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500"
                style={{
                  background: 'linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: '0% 0',
                  color: '#1e1206',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 0'; }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </motion.div>
          </form>

          <motion.div variants={formItem} className="mt-6 space-y-2 text-center">
            {!isSmartFlow && (
              <p className="text-[10.5px] text-white/32">
                No account?{' '}
                <Link
                  href={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                  className="text-[#bfa68a]/75 hover:text-[#bfa68a] transition"
                >
                  Create one
                </Link>
              </p>
            )}
            <p className="text-[10.5px] text-white/22">
              <Link href="/forgot-password" className="hover:text-white/45 transition">
                Forgot password
              </Link>
              <span className="mx-2 opacity-50">·</span>
              <Link
                href={`/login/magic${prefilledEmail ? `?email=${encodeURIComponent(prefilledEmail)}` : ''}${redirect ? `${prefilledEmail ? '&' : '?'}redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="hover:text-white/45 transition"
              >
                Sign in without password
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
