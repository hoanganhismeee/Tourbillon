'use client';

// Editorial introduction — between the video hero and style discovery.
// Uses shadcn Button (via buttonVariants) for CTAs and a framer-motion
// letter-spacing expand animation on the caption label.
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import HeroHeading from './HeroHeading';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

export default function EditorialIntro() {
  return (
    <section className="container mx-auto px-8 pt-36 pb-24">
      <div className="max-w-3xl mx-auto text-center">

        {/* Caption label — letter-spacing expands on entry for a signature reveal */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.05em' }}
          animate={{ opacity: 1, letterSpacing: '0.3em' }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
          className="text-[10px] uppercase text-[#bfa68a] mb-5 font-inter"
        >
          The House of Horology
        </motion.p>

        <h1 className="text-5xl md:text-6xl font-playfair font-light mb-6 tourbillon-text-color leading-tight">
          <HeroHeading />
        </h1>

        <ScrollFade delay={0.15}>
          <p className="text-base mb-12 tourbillon-text-color opacity-60 max-w-xl mx-auto">
            Exceptional timepieces from the world&apos;s finest maisons, curated for the discerning collector.
          </p>
        </ScrollFade>

        <ScrollFade delay={0.25}>
          <div className="flex gap-4 justify-center">
            {/* Primary CTA — gold border, uses shadcn buttonVariants with custom overrides */}
            <Link
              href="/watches"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'border-[#bfa68a] text-[#bfa68a] bg-transparent hover:bg-[#bfa68a]/10 hover:text-[#bfa68a] text-[11px] tracking-[0.12em] uppercase px-7 h-auto py-3.5 rounded-none font-inter gap-2'
              )}
            >
              Explore Watches
              <ArrowRight className="w-3 h-3" />
            </Link>

            {/* Secondary CTA — muted border */}
            <Link
              href="/stories"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'text-white/40 hover:text-white/70 hover:bg-transparent text-[11px] tracking-[0.12em] uppercase px-7 h-auto py-3.5 rounded-none font-inter border border-white/10 hover:border-white/20'
              )}
            >
              Our Story
            </Link>
          </div>
        </ScrollFade>

      </div>
    </section>
  );
}
