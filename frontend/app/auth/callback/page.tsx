// OAuth callback landing page reached after the backend sets the session cookie.
// Refreshes auth state with the correct anonymous-tracking policy, then redirects.
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authMode = searchParams.get('newAccount') === '1' ? 'new-account' : 'existing-account';

  useEffect(() => {
    login(authMode).then(() => {
      const dest = sessionStorage.getItem('authRedirect') || '/';
      sessionStorage.removeItem('authRedirect');
      router.replace(dest);
    });
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
