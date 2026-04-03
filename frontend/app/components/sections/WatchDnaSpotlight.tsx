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
  { label: 'Brand affinity',  width: '75%' },
  { label: 'Case material',   width: '60%' },
  { label: 'Dial character',  width: '85%' },
  { label: 'Case proportion', width: '50%' },
  { label: 'Price range',     width: '70%' },
];

function DimensionBars({ filled }: { filled: boolean }) {
  return (
    <div className="space-y-3 w-full max-w-xs">
      {DIMENSIONS.map((dim, i) => (
        <div key={dim.label}>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] tracking-[0.1em] uppercase text-white/40 font-inter">{dim.label}</span>
          </div>
          <div className="h-px w-full bg-white/10 relative overflow-hidden">
            <div
              className="h-full bg-[#bfa68a] transition-all duration-1000"
              style={{
                width: filled ? dim.width : '0%',
                transitionDelay: `${i * 120}ms`,
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
    // 404 means no profile yet — treat as null, don't error
    throwOnError: false,
  });

  const hasProfile = !!profile?.summary || (profile?.preferredBrandIds?.length ?? 0) > 0;

  if (authLoading) return null;

  return (
    <section className="relative w-full overflow-hidden">
      {/* Subtle radial glow behind content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(191,166,138,0.06) 0%, transparent 70%)' }}
      />

      <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 max-w-7xl py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Left — text block */}
          <ScrollFade>
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a] mb-4 font-inter">Watch DNA</p>

              {hasProfile ? (
                <>
                  <h2 className="text-4xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Your taste profile
                  </h2>
                  {profile?.summary && (
                    <p className="text-base text-white/60 font-inter leading-relaxed mb-8 max-w-sm">
                      {profile.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {profile?.preferredMaterials?.slice(0, 3).map(m => (
                      <span key={m} className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/50 px-3 py-1 font-inter">
                        {m}
                      </span>
                    ))}
                    {profile?.preferredDialColors?.slice(0, 2).map(c => (
                      <span key={c} className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/50 px-3 py-1 font-inter">
                        {c} dial
                      </span>
                    ))}
                    {profile?.preferredCaseSize && (
                      <span className="text-[10px] tracking-[0.1em] uppercase border border-white/15 text-white/50 px-3 py-1 font-inter">
                        {profile.preferredCaseSize} case
                      </span>
                    )}
                  </div>
                  <Link
                    href="/watches"
                    className="inline-flex items-center gap-3 text-sm tracking-[0.15em] uppercase text-[#f0e6d2] border border-[#bfa68a]/50 hover:border-[#bfa68a] px-6 py-3 transition-colors duration-300 font-inter"
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
                    className="inline-flex items-center gap-3 text-sm tracking-[0.15em] uppercase text-[#f0e6d2] border border-[#bfa68a]/50 hover:border-[#bfa68a] px-6 py-3 transition-colors duration-300 font-inter"
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
                    className="inline-flex items-center gap-3 text-sm tracking-[0.15em] uppercase text-[#f0e6d2] border border-[#bfa68a]/50 hover:border-[#bfa68a] px-6 py-3 transition-colors duration-300 font-inter"
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

          {/* Right — decorative dimension bars */}
          <ScrollFade>
            <div className="flex flex-col gap-6 md:pl-8 md:border-l border-white/8">
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-inter">
                {hasProfile ? 'Your preferences' : 'Your taste fingerprint'}
              </p>
              <DimensionBars filled={hasProfile} />
              <p className="text-[10px] text-white/20 font-inter leading-relaxed max-w-[200px]">
                {hasProfile
                  ? 'Profile active — watches are ranked by affinity'
                  : 'Builds automatically as you explore'}
              </p>
            </div>
          </ScrollFade>

        </div>
      </div>
    </section>
  );
}
