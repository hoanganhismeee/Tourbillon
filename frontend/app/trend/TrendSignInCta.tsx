// Guest-only banner on the Trend page, teasing the price alert feature.
// Renders nothing for authenticated users.
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/app/constants/routes';

const TrendSignInCta = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;

  return (
    <section className="mt-20 border-t border-[#bfa68a]/12 pt-12">
      <div className="max-w-3xl border-l border-[#bfa68a]/35 pl-7 md:pl-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-[#bfa68a]/82">
          Sign in
        </p>
        <h2 className="mt-5 font-playfair font-light text-[#f0e6d2]" style={{ fontSize: 'clamp(2rem, 3.6vw, 3.2rem)' }}>
          Keep the trend analysis attached to your account.
        </h2>
        <p className="mt-5 max-w-xl text-[13.5px] leading-[1.85] text-white/45">
          Sign in to let Watch DNA follow your browsing over time, shape the first rows of the catalogue, and carry your signals back into the Trend page.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
      <Link
        href={`${ROUTES.LOGIN}?redirect=${ROUTES.TREND}`}
        className="inline-flex items-center justify-center border border-[#bfa68a]/25 px-10 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
      >
        Sign in
      </Link>
        <Link
          href={ROUTES.WATCHES}
          className="text-[10px] uppercase tracking-[0.3em] text-white/35 transition-colors duration-300 hover:text-[#f0e6d2]"
        >
          Browse the catalogue first
        </Link>
      </div>
    </section>
  );
};

export default TrendSignInCta;
