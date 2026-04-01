// Guest-only banner on the Trend page, teasing the price alert feature.
// Renders nothing for authenticated users.
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const TrendSignInCta = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;

  return (
    <div className="mt-10 rounded-2xl border border-[#bfa68a]/20 px-6 py-5"
      style={{
        background: 'linear-gradient(160deg, rgba(38,29,24,0.6) 0%, rgba(26,18,14,0.65) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-sm font-inter text-white/55 mb-1">
        Sign in to unlock price alerts
      </p>
      <p className="text-xs font-inter text-white/30 mb-4">
        Follow watches and receive email notifications whenever their price changes.
      </p>
      <Link
        href="/login?redirect=/trend"
        className="inline-block px-5 py-2 rounded-lg bg-[#bfa68a]/15 border border-[#bfa68a]/30 text-xs font-inter font-semibold text-[#bfa68a] hover:bg-[#bfa68a]/25 hover:text-[#d4b896] transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
};

export default TrendSignInCta;
