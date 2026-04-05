'use client';

// Homepage Watch DNA spotlight — surfaces the platform's personalization feature.
// Three states: unauthenticated / authenticated without profile / authenticated with profile.
// Adapts copy and CTA to guide the user toward building or viewing their taste profile.
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getTasteProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

// The 5 taste dimensions shown as a decorative bar visual
const DIMENSIONS = [
  { label: 'Brand affinity',  width: '75%', pct: '75' },
  { label: 'Case material',   width: '60%', pct: '60' },
  { label: 'Dial character',  width: '85%', pct: '85' },
  { label: 'Case proportion', width: '50%', pct: '50' },
  { label: 'Price range',     width: '70%', pct: '70' },
];

function DimensionBars({ filled }: { filled: boolean }) {
  return (
    <div className="space-y-4 w-full max-w-xs relative">
      {/* Decorative watch-dial circle behind the bars */}
      <div
        className="absolute -right-8 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full border border-white/[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(191,166,138,0.02) 0%, transparent 70%)' }}
      />
      <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-36 h-36 rounded-full border border-white/[0.03] pointer-events-none" />

      {DIMENSIONS.map((dim, i) => (
        <div key={dim.label} className="relative">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] tracking-[0.12em] uppercase text-white/40 font-inter">{dim.label}</span>
            <span className="text-[10px] text-white/20 font-inter tabular-nums">{filled ? dim.pct : '—'}</span>
          </div>
          {/* Track: h-[2px] for visibility */}
          <div className="h-[2px] w-full bg-white/8 relative overflow-hidden">
            <div
              className="h-full bg-[#bfa68a] transition-all duration-1000"
              style={{
                width: filled ? dim.width : '0%',
                transitionDelay: `${i * 120}ms`,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WatchDnaSpotlight() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['taste-profile'],
    queryFn: getTasteProfile,
    enabled: isAuthenticated,
    retry: false,
    throwOnError: false,
  });

  const hasProfile = !!profile?.summary || (profile?.preferredBrandIds?.length ?? 0) > 0;

  if (authLoading) return null;

  return (
    <section className="relative w-full overflow-hidden border-y border-white/[0.06]">
      {/* Subtle glow — very faint, just enough to anchor the left column */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 55% at 20% 50%, rgba(191,166,138,0.04) 0%, transparent 70%)' }}
      />

      <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 max-w-7xl py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Left — text block with gold accent line */}
          <ScrollFade>
            <div className="border-l-2 border-[#bfa68a]/20 pl-8">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-5 font-inter">Watch DNA</p>

              {hasProfile ? (
                <>
                  <h2 className="text-4xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Your taste profile
                  </h2>
                  {profile?.summary && (
                    <p className="text-base text-white/55 font-inter leading-relaxed mb-8 max-w-sm">
                      {profile.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {profile?.preferredMaterials?.slice(0, 3).map(m => (
                      <span key={m} className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/45 px-3 py-1 font-inter">
                        {m}
                      </span>
                    ))}
                    {profile?.preferredDialColors?.slice(0, 2).map(c => (
                      <span key={c} className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/45 px-3 py-1 font-inter">
                        {c} dial
                      </span>
                    ))}
                    {profile?.preferredCaseSize && (
                      <span className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/45 px-3 py-1 font-inter">
                        {profile.preferredCaseSize} case
                      </span>
                    )}
                  </div>
                  <Link
                    href="/watches"
                    className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[#f0e6d2] border border-[#bfa68a]/45 hover:border-[#bfa68a] px-6 py-3.5 transition-colors duration-300 font-inter"
                  >
                    Explore Your Collection
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </>
              ) : isAuthenticated ? (
                <>
                  <h2 className="text-4xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Build your taste profile
                  </h2>
                  <p className="text-base text-white/50 font-inter leading-relaxed mb-8 max-w-sm">
                    Browse a few watches and we&apos;ll start learning your preferences — or generate your profile instantly from your activity.
                  </p>
                  <Link
                    href="/account/edit-details"
                    className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[#f0e6d2] border border-[#bfa68a]/45 hover:border-[#bfa68a] px-6 py-3.5 transition-colors duration-300 font-inter"
                  >
                    Generate Profile
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Watches that learn your taste
                  </h2>
                  <p className="text-base text-white/50 font-inter leading-relaxed mb-8 max-w-sm">
                    Your browsing builds a silent preference map. Sign in and the collection reorders around you — surfacing the brands, materials, and complications you actually gravitate toward.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[#f0e6d2] border border-[#bfa68a]/45 hover:border-[#bfa68a] px-6 py-3.5 transition-colors duration-300 font-inter"
                  >
                    Discover Your Profile
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </>
              )}
            </div>
          </ScrollFade>

          {/* Right — dimension bars with decorative dial circle behind them */}
          <ScrollFade>
            <div className="flex flex-col gap-5 md:pl-8 md:border-l border-white/[0.06]">
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-inter">
                {hasProfile ? 'Your preferences' : 'Your taste fingerprint'}
              </p>
              <DimensionBars filled={hasProfile} />
              <p className="text-[10px] text-white/18 font-inter leading-relaxed max-w-[200px]">
                {hasProfile
                  ? 'Profile active — watches ranked by affinity'
                  : 'Builds automatically as you explore'}
              </p>
            </div>
          </ScrollFade>

        </div>
      </div>
    </section>
  );
}
