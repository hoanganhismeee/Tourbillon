'use client';

// Homepage Watch DNA spotlight — surfaces the platform's personalization feature.
// Three states: unauthenticated / authenticated without profile / authenticated with profile.
// The design aligns with the homepage's floating editorial aesthetic: no boxy cards, 
// using minimal lines, large typography, and staggered grids.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getTasteProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/app/constants/routes';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

const DIMENSIONS = [
  { 
    id: '01',
    label: 'Brand Affinity',  
    desc: 'Tracking your gravitation toward independent artisans or historic maisons.',
    pct: 75, delay: 0 
  },
  { 
    id: '02',
    label: 'Material Language',   
    desc: 'Mapping your choices across classic steel, warm rose gold, or high-tech ceramic.',
    pct: 60, delay: 200 
  },
  { 
    id: '03',
    label: 'Dial Character',  
    desc: 'Analyzing your draw to minimalist layouts versus intricate, open-worked dials.',
    pct: 85, delay: 400 
  },
  { 
    id: '04',
    label: 'Wrist Proportion',      
    desc: 'Finding the exact millimeter sweet spot that offers your perfect wrist presence.',
    pct: 50, delay: 600 
  },
];

export default function WatchDnaSpotlight() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    enabled: isAuthenticated,
    retry: false,
    throwOnError: false,
  });

  const hasProfile =
    !!profile?.behaviorSummary ||
    !!profile?.tasteText ||
    (profile?.preferredBrandIds?.length ?? 0) > 0;

  if (authLoading) return null;

  return (
    <section className="relative w-full overflow-hidden">
      {/* Ambient glow - matches WatchFinderSearch blending */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen"
        style={{ background: 'radial-gradient(ellipse 55% 50% at 25% 50%, rgba(191,166,138,0.06) 0%, transparent 70%)' }}
      />

      <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 max-w-7xl py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-20 items-center">

          {/* Left — text block */}
          <ScrollFade>
            <div className="border-l border-[#bfa68a]/30 pl-8">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#bfa68a]/80 mb-5 font-inter">Watch DNA</p>

              {hasProfile ? (
                <>
                  <h2 className="text-4xl md:text-5xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Your Taste Profile
                  </h2>
                  {profile?.summary && (
                    <p className="text-[15px] text-white/55 font-inter leading-relaxed mb-8 max-w-sm">
                      {profile.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {profile?.preferredMaterials?.slice(0, 3).map(m => (
                      <span key={m} className="text-[9px] tracking-[0.14em] uppercase border border-white/10 text-white/45 px-4 py-1.5 font-inter rounded-full">
                        {m}
                      </span>
                    ))}
                    {profile?.preferredDialColors?.slice(0, 2).map(c => (
                      <span key={c} className="text-[9px] tracking-[0.14em] uppercase border border-white/10 text-white/45 px-4 py-1.5 font-inter rounded-full">
                        {c} dial
                      </span>
                    ))}
                    {profile?.preferredCaseSize && (
                      <span className="text-[9px] tracking-[0.14em] uppercase border border-white/10 text-white/45 px-4 py-1.5 font-inter rounded-full">
                        {profile.preferredCaseSize} case
                      </span>
                    )}
                  </div>
                  <Link
                    href={ROUTES.TREND}
                    className="inline-flex items-center gap-4 text-[10px] tracking-[0.25em] uppercase font-inter text-[#f0e6d2]/70 border border-[#bfa68a]/30 hover:text-[#f0e6d2] hover:border-[#bfa68a]/80 px-8 py-4 transition-all duration-500 relative overflow-hidden group mt-2"
                  >
                    <span className="relative z-10">Open Watch DNA</span>
                    <svg className="w-3.5 h-3.5 relative z-10 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="absolute inset-0 bg-[#bfa68a]/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                  </Link>
                </>
              ) : isAuthenticated ? (
                <>
                  <h2 className="text-4xl md:text-5xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Your eye is forming.
                  </h2>
                  <p className="text-[15px] text-white/45 font-inter leading-relaxed mb-8 max-w-sm">
                    Browse a few watches to sharpen your curation. Your Watch DNA naturally adapts to your evolving tastes.
                  </p>
                  <Link
                    href={ROUTES.TREND}
                    className="inline-flex items-center gap-4 text-[10px] tracking-[0.25em] uppercase font-inter text-[#f0e6d2]/70 border border-[#bfa68a]/30 hover:text-[#f0e6d2] hover:border-[#bfa68a]/80 px-8 py-4 transition-all duration-500 relative overflow-hidden group mt-2"
                  >
                    <span className="relative z-10">Open Watch DNA</span>
                    <svg className="w-3.5 h-3.5 relative z-10 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="absolute inset-0 bg-[#bfa68a]/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-4xl md:text-5xl font-playfair font-light text-[#f0e6d2] mb-6 leading-snug">
                    Watches that know you.
                  </h2>
                  <p className="text-[15px] text-white/45 font-inter leading-relaxed mb-8 max-w-sm">
                    The more you explore, the sharper your curation gets. Watch DNA quietly learns your unparalleled taste to surface pieces you&apos;ll love.
                  </p>
                  <Link
                    href={`${ROUTES.LOGIN}?redirect=${ROUTES.TREND}`}
                    className="inline-flex items-center gap-4 text-[10px] tracking-[0.25em] uppercase font-inter text-[#f0e6d2]/70 border border-[#bfa68a]/30 hover:text-[#f0e6d2] hover:border-[#bfa68a]/80 px-8 py-4 transition-all duration-500 relative overflow-hidden group mt-2"
                  >
                    <span className="relative z-10">Sign in to unlock Watch DNA</span>
                    <svg className="w-3.5 h-3.5 relative z-10 transition-transform duration-500 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="absolute inset-0 bg-[#bfa68a]/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                  </Link>
                </>
              )}
            </div>
          </ScrollFade>

          {/* Right — Dimensional breakdown, non-boxy, staggered grid */}
          <ScrollFade>
            <div className="relative mt-20 lg:mt-0 lg:pl-16">
              
              {/* Subtle ambient intersection glow */}
              <div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-50"
                   style={{ background: 'radial-gradient(circle at 50% 50%, rgba(191,166,138,0.08) 0%, transparent 60%)' }} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16 md:gap-y-8 relative z-10">
                {DIMENSIONS.map((dim, i) => (
                  <div 
                    key={dim.id} 
                    className={`flex flex-col group relative ${i % 2 === 1 ? 'md:mt-24' : ''} ${i % 2 === 0 ? 'md:-mt-10' : ''}`}
                  >
                    {/* Animated height bar representing score or tracking */}
                    <div 
                      className="absolute left-[-1px] top-0 w-[2px] bg-gradient-to-b from-[#bfa68a] to-transparent transition-all duration-1000 ease-out z-10" 
                      style={{ 
                        height: hasProfile && animate ? `${dim.pct}%` : '0%',
                        transitionDelay: `${dim.delay}ms` 
                      }} 
                    />
                    {/* Hover interaction line when no profile */}
                    {!hasProfile && (
                      <div className="absolute left-[-1px] top-0 w-[2px] h-0 bg-[#bfa68a]/40 transition-all duration-700 ease-out group-hover:h-full z-10" />
                    )}

                    <div className="border-l border-white/10 pl-6 h-full flex flex-col justify-center transition-colors duration-500 group-hover:border-white/25">
                      
                      {/* Metric header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] tracking-[0.3em] font-inter text-[#bfa68a]/70">{dim.id}</span>
                          <div className="h-px w-6 bg-[#bfa68a]/30" />
                        </div>
                        {hasProfile && (
                          <span className="text-[10px] tracking-[0.2em] font-inter text-[#bfa68a]">{dim.pct}%</span>
                        )}
                      </div>
                      
                      {/* Dimension Title */}
                      <h4 className="font-playfair text-2xl text-[#f0e6d2] mb-3 leading-tight tracking-wide group-hover:text-white transition-colors duration-500">
                        {dim.label}
                      </h4>
                      
                      {/* Dimension Copy */}
                      <p className="font-inter text-[13px] text-white/40 leading-relaxed font-light group-hover:text-white/60 transition-colors duration-500 pr-2">
                        {dim.desc}
                      </p>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollFade>

        </div>
      </div>
    </section>
  );
}
