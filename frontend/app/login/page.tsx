// Login page — split-panel layout, brand panel left, form right, unified background
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { loginUser } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const GOOGLE_AUTH_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5248/api'}/authentication/google`;

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
    <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
    <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
    <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
  </svg>
);

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

  // Lock page scroll — no reason to scroll on an auth screen
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

  return (
    <div className="flex h-[calc(100vh-3rem-50px)] overflow-hidden">

      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-center w-[42%] shrink-0 relative border-r border-[#bfa68a]/10 px-16 py-10">
        <div className="w-10 h-px bg-[#bfa68a]/50 mb-7" />
        <p className="text-[10px] uppercase tracking-[0.5em] text-[#bfa68a] mb-4">Member Access</p>
        <h2 className="font-playfair text-[3.5rem] font-light text-[#f0e6d2] leading-[1.1] mb-6">
          Welcome<br />Back
        </h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-[260px] mb-9">
          Access your collection, track orders, and connect with our private advisors.
        </p>

        <div className="space-y-4 mb-10">
          {[
            ['Curated Collections', 'Hand-selected timepieces from the Holy Trinity and beyond'],
            ['Personal Advisors', 'One-on-one guidance from certified horological experts'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3.5">
              <div className="w-px h-10 bg-[#bfa68a]/25 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-[#f0e6d2]/70 font-medium tracking-wide">{title}</p>
                <p className="text-[11px] text-white/25 leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <blockquote className="border-l border-[#bfa68a]/30 pl-5">
          <p className="text-white/30 text-[13px] italic leading-relaxed font-playfair">
            &ldquo;Time is the most valuable thing a man can spend.&rdquo;
          </p>
          <cite className="block text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]/40 mt-2.5 not-italic">
            Theophrastus
          </cite>
        </blockquote>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[340px] relative"
        >
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a] mb-3">Sign In</p>
          <h1 className="font-playfair text-[2rem] font-light text-[#f0e6d2] mb-8">Your Account</h1>

          {/* Google */}
          <a
            href={GOOGLE_AUTH_URL}
            onClick={() => { if (redirect) sessionStorage.setItem('authRedirect', redirect); }}
            className="flex items-center justify-center gap-3 w-full py-3 border border-white/15 text-white/60 hover:border-[#bfa68a]/40 hover:text-white/80 transition text-[10px] uppercase tracking-[0.2em] mb-6"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/70 mb-2.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/70 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/70 mb-2.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/70 transition text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition text-[9px] uppercase tracking-widest"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <p className="text-[#e07575] text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-[10px] uppercase tracking-[0.35em] bg-[#bfa68a] text-[#1e1206] hover:bg-[#cdb99d] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium mt-1"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-7 space-y-2.5 text-center">
            <p className="text-[11px] text-white/35">
              No account?{' '}
              <Link
                href={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="text-[#bfa68a]/80 hover:text-[#bfa68a] transition"
              >
                Create one
              </Link>
            </p>
            <p className="text-[11px] text-white/25">
              <Link href="/forgot-password" className="hover:text-white/50 transition">
                Forgot password
              </Link>
              <span className="mx-2 opacity-50">·</span>
              <Link
                href={`/login/magic${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="hover:text-white/50 transition"
              >
                Sign in without password
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
