// Popup terminator page reached after Google OAuth completes in a popup window.
// Posts the auth result back to the opener so it can finish the correct Watch DNA sync flow.
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PopupClosePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewAccount = searchParams.get('newAccount') === '1';

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'google-auth-success', isNewAccount }, window.location.origin);
      window.close();
    } else {
      router.replace('/');
    }
  }, [isNewAccount, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-6 h-6 border-2 border-[var(--primary-brown)]/30 border-t-[var(--primary-brown)] rounded-full animate-spin mb-3" />
        <p className="text-[var(--primary-brown)]/70 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
