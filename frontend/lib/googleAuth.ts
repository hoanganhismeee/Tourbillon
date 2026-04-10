// Google OAuth popup helper.
// Opens a centered popup window for the OAuth flow and notifies the opener via postMessage.

const POPUP_WIDTH  = 480;
const POPUP_HEIGHT = 620;

// Google OAuth should bypass the Next.js backend proxy so ASP.NET owns the full
// external-auth handshake and callback path end-to-end.
export function getGoogleAuthUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const directApiBase = process.env.NEXT_PUBLIC_OAUTH_API_URL
    || (apiBase?.startsWith('/api/backend') ? 'http://localhost:5248/api' : apiBase)
    || 'http://localhost:5248/api';

  return `${directApiBase.replace(/\/$/, '')}/authentication/google`;
}

export interface GoogleAuthSuccessPayload {
  isNewAccount: boolean;
}

export function openGoogleAuthPopup(authUrl: string, onSuccess: (payload: GoogleAuthSuccessPayload) => void): void {
  // Center the popup relative to the current window
  const left = window.screenX + Math.round((window.outerWidth  - POPUP_WIDTH)  / 2);
  const top  = window.screenY + Math.round((window.outerHeight - POPUP_HEIGHT) / 2);

  const popup = window.open(
    `${authUrl}?popup=true`,
    'google-auth',
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
  );

  if (!popup) {
    // Fallback: popup blocked — do a regular redirect instead
    window.location.href = authUrl;
    return;
  }

  const origin = window.location.origin;

  // Listen for the success signal posted by /auth/popup-close
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    if (event.data?.type === 'google-auth-success') {
      cleanup();
      onSuccess({ isNewAccount: event.data?.isNewAccount === true });
    }
  };

  // Detect if the user closes the popup without completing auth
  const pollClosed = setInterval(() => {
    if (popup.closed) cleanup();
  }, 800);

  function cleanup() {
    clearInterval(pollClosed);
    window.removeEventListener('message', handleMessage);
  }

  window.addEventListener('message', handleMessage);
}
