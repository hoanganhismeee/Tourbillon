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
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/80">
          Watch DNA
        </p>
        <h2 className="mt-5 font-playfair font-light leading-tight text-[#f0e6d2]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
          Sign in to save your Watch DNA.
        </h2>
        <p className="mt-6 max-w-xl text-[13.5px] leading-relaxed text-white/50">
          Keep your taste profile attached to your account so your browsing signals can shape the catalogue and carry back into the Trend page over time.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          href={`${ROUTES.LOGIN}?redirect=${ROUTES.TREND}`}
          className="relative inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/25 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 group hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
        >
          <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
            Sign in
          </span>
          <span className="absolute right-6 opacity-0 -translate-x-4 text-[14px] transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
            →
          </span>
        </Link>
        <Link
          href={ROUTES.WATCHES}
          className="relative inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/25 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 group hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
        >
          <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
            Browse the catalogue first
          </span>
          <span className="absolute right-6 opacity-0 -translate-x-4 text-[14px] transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
            →
          </span>
        </Link>
      </div>
    </section>
  );
};

export default TrendSignInCta;
