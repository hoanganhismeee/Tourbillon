// OAuth callback landing page — reached after Google (or magic login) sets the session cookie.
// Refreshes auth state then redirects home. No UI needed; spinner keeps it from feeling broken.
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    login().then(() => router.replace('/'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--primary-brown)]/30 border-t-[var(--primary-brown)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--primary-brown)]/70 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
