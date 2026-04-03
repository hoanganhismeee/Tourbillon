'use client';

// Full-screen video hero for the homepage landing experience.
// Pins for 200px of scroll while a TOURBILLON wordmark fades in with letter-spacing expansion.
// After the pin, the page resumes normal scroll.
import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function VideoSection() {
  const sectionRef    = useRef<HTMLElement>(null);
  const wordmarkRef   = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current || !wordmarkRef.current || !scrollHintRef.current) return;

    // Skip pin animation for users who prefer reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(wordmarkRef.current, { opacity: 1, letterSpacing: '0.3em' });
      return;
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=200',
        pin: true,
        scrub: 1,
      },
    });

    // Wordmark fades up while letter-spacing expands from tight to wide
    tl.fromTo(
      wordmarkRef.current,
      { opacity: 0, letterSpacing: '0.02em', y: 16 },
      { opacity: 1, letterSpacing: '0.4em', y: 0, ease: 'power2.out' }
    );

    // Scroll hint fades out as wordmark comes in
    tl.to(scrollHintRef.current, { opacity: 0, duration: 0.3 }, 0);
  }, { scope: sectionRef });

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100vh + 3rem + 50px)', marginTop: 'calc(-3rem - 50px)' }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/tourbillon.mp4" type="video/mp4" />
      </video>

      {/* Wordmark overlay — revealed by GSAP scroll pin animation */}
      <div
        ref={wordmarkRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 0 }}
      >
        <span
          className="font-playfair font-light uppercase text-[#f0e6d2]/80 select-none"
          style={{ fontSize: 'clamp(2rem, 8vw, 7rem)', letterSpacing: '0.02em' }}
        >
          Tourbillon
        </span>
      </div>

      {/* Fade into page background so the section below feels seamless */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-black" />

      {/* Scroll hint — fades out as wordmark appears */}
      <div
        ref={scrollHintRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.2em] uppercase select-none animate-bounce"
      >
        scroll
      </div>
    </section>
  );
}
