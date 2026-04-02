// Auth entry point — user types their email, system detects login vs register.
// Redirects to /login?email=... or /register?email=... accordingly.
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { checkEmailExists } from '@/lib/api';
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
    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
    <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
    <path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
    <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
  </svg>
);

const WatchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ opacity: 0.10 }}>
    <circle cx="16" cy="16" r="13" stroke="#bfa68a" strokeWidth="0.8"/>
    <circle cx="16" cy="16" r="1.2" fill="#bfa68a"/>
    <line x1="16" y1="16" x2="11.5" y2="10.5" stroke="#bfa68a" strokeWidth="0.8" strokeLinecap="round"/>
    <line x1="16" y1="16" x2="21" y2="10" stroke="#bfa68a" strokeWidth="0.6" strokeLinecap="round"/>
  </svg>
);

function FocusInput({
  type = 'text', value, onChange, placeholder, autoFocus
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoFocus?: boolean;
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
        autoFocus={autoFocus}
        required
        className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none transition text-sm"
      />
      <span
        className="absolute bottom-0 left-0 h-px bg-[#bfa68a]/70 transition-all duration-300 origin-left"
        style={{ width: '100%', transform: focused ? 'scaleX(1)' : 'scaleX(0)' }}
      />
    </div>
  );
}

export default function AuthStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    setError('');
    setLoading(true);
    try {
      const exists = await checkEmailExists(email.trim());
      const redirectParam = redirect ? `&redirect=${encodeURIComponent(redirect)}` : '';
      const destination = exists
        ? `/login?email=${encodeURIComponent(email.trim())}${redirectParam}`
        : `/register?email=${encodeURIComponent(email.trim())}${redirectParam}`;
      router.push(destination);
    } catch {
      setError('Unable to verify email. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem-50px)] overflow-hidden">

      {/* Left brand panel — centered within 40% */}
      <div className="hidden lg:flex flex-col items-center w-[40%] shrink-0 relative border-r border-[#bfa68a]/10 overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 340, height: 340,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(191,166,138,0.055) 0%, transparent 70%)',
          }}
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col justify-center flex-1 py-10 w-[290px]"
        >
          <motion.div variants={fadeUp} className="w-8 h-px bg-[#bfa68a]/50 mb-5" />
          <motion.p variants={fadeUp} className="text-[9px] uppercase tracking-[0.5em] text-[#bfa68a] mb-3">
            Tourbillon
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-playfair text-[3.5rem] font-light text-[#f0e6d2] leading-[1.0] mb-5">
            Welcome.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/38 text-[13.5px] leading-[1.85] mb-8 max-w-[250px]">
            A sanctuary for the discerning collector — where mastery, heritage, and precision converge.
          </motion.p>

          <motion.div variants={fadeUp} className="flex items-end gap-8 mb-8">
            <div>
              <p className="font-playfair text-[2.4rem] font-light text-[#f0e6d2]/75 leading-none">500+</p>
              <p className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/50 mt-2">Timepieces</p>
            </div>
            <div className="w-px h-10 bg-[#bfa68a]/15 mb-1" />
            <div>
              <p className="font-playfair text-[2.4rem] font-light text-[#f0e6d2]/75 leading-none">13</p>
              <p className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/50 mt-2">Maisons</p>
            </div>
          </motion.div>

          <motion.blockquote variants={fadeUp} className="border-l border-[#bfa68a]/28 pl-4">
            <p className="text-white/30 text-[13px] italic leading-relaxed font-playfair">
              &ldquo;Time is the most valuable thing a man can spend.&rdquo;
            </p>
            <cite className="block text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/35 mt-2 not-italic">
              Theophrastus
            </cite>
          </motion.blockquote>
        </motion.div>

        <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
          <WatchIcon />
        </div>
      </div>

      {/* Right form panel — centered within 60% */}
      <div className="flex-1 flex items-center justify-center px-12">
        <motion.div
          variants={formContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[400px]"
        >
          <motion.p variants={formItem} className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a] mb-2.5">
            Access
          </motion.p>
          <motion.h1 variants={formItem} className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-2">
            Sign In or Register
          </motion.h1>
          <motion.p variants={formItem} className="text-white/35 text-[12px] mb-7 leading-relaxed">
            Enter your email to continue
          </motion.p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <motion.div variants={formItem}>
              <label className="block text-[8.5px] uppercase tracking-[0.28em] text-[#bfa68a]/65 mb-2">
                Email Address
              </label>
              <FocusInput
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
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
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </motion.div>
          </form>

          {/* OAuth divider */}
          <motion.div variants={formItem} className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[8.5px] uppercase tracking-[0.22em] text-white/28">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </motion.div>

          <motion.div variants={formItem}>
            <a
              href={GOOGLE_AUTH_URL}
              onClick={() => { if (redirect) sessionStorage.setItem('authRedirect', redirect); }}
              className="flex items-center justify-center gap-3 w-full py-3 border border-white/14 text-white/55 hover:border-[#bfa68a]/35 hover:text-white/75 transition text-[9.5px] uppercase tracking-[0.18em]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
