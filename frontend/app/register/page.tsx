// Register page — split-panel layout matching login
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { registerUser } from '@/lib/api';
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

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

const Field = ({
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
}) => (
  <div>
    <label className="block text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/70 mb-2.5">
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputMode={inputMode}
      pattern={pattern}
      autoComplete={type === 'password' ? 'new-password' : undefined}
      className="w-full bg-transparent border-b border-white/20 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/70 transition text-sm"
    />
  </div>
);

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [formData, setFormData] = useState<FormData>({
    firstName: '', lastName: '', email: '',
    phoneNumber: '', password: '', confirmPassword: '', agreeToTerms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Lock page scroll — no reason to scroll on an auth screen
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
      <div className="hidden lg:flex flex-col justify-center w-[38%] shrink-0 relative border-r border-[#bfa68a]/10 px-16 py-10">
        <div className="w-10 h-px bg-[#bfa68a]/50 mb-7" />
        <p className="text-[10px] uppercase tracking-[0.5em] text-[#bfa68a]/70 mb-4">New Member</p>
        <h2 className="font-playfair text-[3.5rem] font-light text-[#f0e6d2] leading-[1.1] mb-6">
          Join<br />Tourbillon
        </h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-[260px] mb-9">
          Explore exclusive collections, save favourites, and speak with our private advisors.
        </p>

        <div className="space-y-4 mb-10">
          {[
            ['Exclusive Access', 'Browse over 500 timepieces from 13 prestige manufactures'],
            ['Watch DNA Profile', "Tell us your style — we'll curate pieces that match"],
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
            &ldquo;A watch is more than a timepiece — it is a statement of values.&rdquo;
          </p>
        </blockquote>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[420px] relative"
        >
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/80 mb-2">Create Account</p>
          <h1 className="font-playfair text-[2rem] font-light text-[#f0e6d2] mb-6">Your Details</h1>

          {/* Google */}
          <a
            href={GOOGLE_AUTH_URL}
            className="flex items-center justify-center gap-3 w-full py-[11px] border border-white/12 text-white/55 hover:border-[#bfa68a]/30 hover:text-white/75 transition text-[10px] uppercase tracking-[0.2em] mb-5"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/22">or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-5">
              <Field label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First" />
              <Field label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" />
              <Field label="Phone" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+1 212 555 0192" inputMode="numeric" pattern="[0-9]*" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />
              <Field label="Confirm" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" />
            </div>

            {error && <p className="text-[#d97070]/90 text-xs pt-1">{error}</p>}

            {/* Terms */}
            <div className="flex items-start gap-3 pt-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={formData.agreeToTerms}
                onClick={() => setFormData(prev => ({ ...prev, agreeToTerms: !prev.agreeToTerms }))}
                className={`w-4 h-4 mt-0.5 shrink-0 border transition ${formData.agreeToTerms ? 'bg-[#bfa68a] border-[#bfa68a]' : 'border-[#bfa68a]/22 bg-transparent'}`}
              >
                {formData.agreeToTerms && (
                  <svg viewBox="0 0 12 12" className="w-full h-full p-[2px]">
                    <path d="M1 6l4 4 6-7" stroke="#1a100c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
              </button>
              <span className="text-[11px] text-white/28 leading-relaxed">
                I agree to the{' '}
                <Link href="#" className="text-[#bfa68a]/60 hover:text-[#bfa68a] transition underline underline-offset-2">
                  Terms of Service
                </Link>
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-[10px] uppercase tracking-[0.35em] bg-[#bfa68a] text-[#1a100c] hover:bg-[#cdb99d] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium mt-1"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-[11px] text-white/22 text-center">
            Already a member?{' '}
            <Link
              href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="text-[#bfa68a]/65 hover:text-[#bfa68a] transition"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
