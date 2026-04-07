// Popup terminator page — reached after Google OAuth completes in a popup window.
// Sends a postMessage to the opener (main window) then closes itself.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PopupClosePage() {
  const router = useRouter();

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'google-auth-success' }, window.location.origin);
      window.close();
    } else {
      // Direct navigation (not in a popup) — just go home
      router.replace('/');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-6 h-6 border-2 border-[var(--primary-brown)]/30 border-t-[var(--primary-brown)] rounded-full animate-spin mb-3" />
        <p className="text-[var(--primary-brown)]/70 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
