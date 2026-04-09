// Register page — split-panel layout matching login
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { registerUser } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getGoogleAuthUrl, openGoogleAuthPopup } from '@/lib/googleAuth';
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

// Input with animated gold underline on focus
function FocusInput({
  label, type = 'text', name, value, onChange, placeholder, inputMode, pattern
}: {
  label: string;
  type?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
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
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          inputMode={inputMode}
          pattern={pattern}
          autoComplete={type === 'password' ? 'new-password' : undefined}
          className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none transition text-sm"
        />
        <span
          className="absolute bottom-0 left-0 h-px bg-[#bfa68a]/70 transition-all duration-300 origin-left"
          style={{ width: '100%', transform: focused ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </div>
    </div>
  );
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  // Pre-filled email from /auth/start — locked chip mode
  const prefilledEmail = searchParams.get('email') ?? '';
  const isSmartFlow = prefilledEmail.length > 0;

  const [formData, setFormData] = useState<FormData>({
    firstName: '', lastName: '', email: prefilledEmail,
    phoneNumber: '', password: '', confirmPassword: '', agreeToTerms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const changeEmailHref = `/auth/start${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = name === 'phoneNumber'
      ? value.replace(/[^0-9]/g, '')
      : type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
    if (error) setError('');
  };

  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim())
      return setError('Please enter your full name'), false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      return setError('Please enter a valid email'), false;
    if (!formData.phoneNumber.trim())
      return setError('Please enter your phone number'), false;
    if (!formData.password)
      return setError('Please enter a password'), false;
    if (formData.password !== formData.confirmPassword)
      return setError('Passwords do not match'), false;
    if (!formData.agreeToTerms)
      return setError('Please agree to the Terms of Service'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await registerUser({
        email: formData.email, password: formData.password,
        firstName: formData.firstName, lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
      });
      await login();
      router.push(redirect || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem-50px)] overflow-hidden">

      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col items-center w-[40%] shrink-0 relative border-r border-[#bfa68a]/10 overflow-hidden">

        {/* Ambient radial glow */}
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

        {/* Fixed-width content block */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col justify-center flex-1 py-10 w-full max-w-[420px] px-8 xl:px-12"
        >
          <motion.div variants={fadeUp} className="w-8 h-px bg-[#bfa68a]/50 mb-5" />
          <motion.p variants={fadeUp} className="text-[9px] uppercase tracking-[0.5em] text-[#bfa68a]/70 mb-3">
            Register
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-playfair text-[2.75rem] font-light text-[#f0e6d2] leading-[1.1] mb-4 whitespace-nowrap">
            Welcome
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/38 text-[13px] leading-relaxed max-w-[240px] mb-6">
            Explore exclusive collections, save favourites, and speak with our private advisors.
          </motion.p>

          <motion.div variants={fadeUp} className="space-y-3.5 mb-6">
            {[
              ['Exclusive Access', 'Browse over 500 timepieces from 13 prestige manufactures'],
              ['Watch DNA Profile', "Tell us your style — we'll curate pieces that match"],
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

          <motion.blockquote variants={fadeUp} className="border-l-2 border-[#bfa68a]/60 pl-6 py-1">
            <p className="text-[#f0e6d2] font-playfair text-[1.4rem] leading-relaxed italic">
              &ldquo;A watch is more than a timepiece — it is a statement of values.&rdquo;
            </p>
          </motion.blockquote>
        </motion.div>

        {/* Watch icon pinned to bottom */}
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
          className="w-full max-w-[460px]"
        >
          <motion.p variants={formItem} className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a]/80 mb-2">
            Create Account
          </motion.p>
          <motion.h1 variants={formItem} className="font-playfair text-[1.85rem] font-light text-[#f0e6d2] mb-5">
            Your Details
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
                    openGoogleAuthPopup(getGoogleAuthUrl(), () => {
                      login().then(() => {
                        const dest = sessionStorage.getItem('authRedirect') || redirect || '/';
                        sessionStorage.removeItem('authRedirect');
                        router.replace(dest);
                      });
                    });
                  }}
                  className="flex items-center justify-center gap-3 w-full py-[11px] border border-white/12 text-white/55 hover:border-[#bfa68a]/30 hover:text-white/75 transition text-[9.5px] uppercase tracking-[0.18em] mb-4"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </motion.div>
              <motion.div variants={formItem} className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[8.5px] uppercase tracking-[0.22em] text-white/22">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </motion.div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <motion.div variants={formItem} className="grid grid-cols-2 gap-5">
              <FocusInput label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First" />
              <FocusInput label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last" />
            </motion.div>
            {isSmartFlow ? (
              <motion.div variants={formItem}>
                <FocusInput label="Phone" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+1 212 555 0192" inputMode="numeric" pattern="[0-9]*" />
              </motion.div>
            ) : (
              <motion.div variants={formItem} className="grid grid-cols-2 gap-5">
                <FocusInput label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" />
                <FocusInput label="Phone" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+1 212 555 0192" inputMode="numeric" pattern="[0-9]*" />
              </motion.div>
            )}
            <motion.div variants={formItem} className="grid grid-cols-2 gap-5">
              <FocusInput label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />
              <FocusInput label="Confirm" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#d97070]/90 text-xs pt-1"
              >
                {error}
              </motion.p>
            )}

            {/* Terms */}
            <motion.div variants={formItem} className="flex items-start gap-3 pt-0.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={formData.agreeToTerms}
                onClick={() => setFormData(prev => ({ ...prev, agreeToTerms: !prev.agreeToTerms }))}
                className={`w-4 h-4 mt-0.5 shrink-0 border transition ${formData.agreeToTerms ? 'bg-[#bfa68a] border-[#bfa68a]' : 'border-[#bfa68a]/22 bg-transparent'}`}
              >
                {formData.agreeToTerms && (
                  <svg viewBox="0 0 12 12" className="w-full h-full p-[2px]">
                    <path d="M1 6l4 4 6-7" stroke="#1a100c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
              </button>
              <span className="text-[10.5px] text-white/28 leading-relaxed">
                I agree to the{' '}
                <Link href="#" className="text-[#bfa68a]/60 hover:text-[#bfa68a] transition underline underline-offset-2">
                  Terms of Service
                </Link>
              </span>
            </motion.div>

            <motion.div variants={formItem} className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-[9.5px] uppercase tracking-[0.32em] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500"
                style={{
                  background: 'linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: '0% 0',
                  color: '#1a100c',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '100% 0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundPosition = '0% 0'; }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </motion.div>
          </form>

          <motion.p variants={formItem} className="mt-4 text-[10.5px] text-white/22 text-center">
            Already a member?{' '}
            <Link
              href={isSmartFlow
                ? `/login?email=${encodeURIComponent(prefilledEmail)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`
                : `/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="text-[#bfa68a]/65 hover:text-[#bfa68a] transition"
            >
              Sign in
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
