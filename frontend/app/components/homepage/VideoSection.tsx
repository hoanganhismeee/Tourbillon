'use client';

// Full-screen video hero. Pins briefly while scroll hint fades out.
// Wordmark removed — the video footage speaks for itself.
import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function VideoSection() {
  const sectionRef    = useRef<HTMLElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current || !scrollHintRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Pin section briefly so the video fills the viewport on landing
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=200',
      pin: true,
    });

    // Scroll hint fades as user begins scrolling
    gsap.to(scrollHintRef.current, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=150',
        scrub: 1,
      },
    });
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
        <source src="https://res.cloudinary.com/dcd9lcdoj/video/upload/tourbillon/videos/tourbillon.mp4" type="video/mp4" />
      </video>

      {/* Fades into the page's dark-brown base — avoids black-to-brown jump */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-[#1e1512]" />

      {/* Scroll hint — fades out as user begins to scroll */}
      <div
        ref={scrollHintRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.2em] uppercase select-none animate-bounce"
      >
        scroll
      </div>
    </section>
  );
}
