'use client';

// Full-screen video hero with resilient source fallback.
// If video loading fails, fall back to a branded static hero instead of a blank viewport.
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { videoUrl } from '@/lib/cloudinary';

gsap.registerPlugin(ScrollTrigger);

const HERO_VIDEO_SOURCES = [
  videoUrl('tourbillon'),
];

export default function VideoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasVideoFailed, setHasVideoFailed] = useState(false);

  useGSAP(() => {
    if (!sectionRef.current || !scrollHintRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Pin section briefly so the hero owns the first viewport.
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=200',
      pin: true,
    });

    // Scroll hint fades as the user begins to move.
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasVideoFailed) return;

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        // Chrome can reject the first autoplay attempt before metadata settles.
      }
    };

    video.muted = true;
    video.defaultMuted = true;

    const handleLoadedData = () => { void tryPlay(); };
    const handleCanPlay = () => { void tryPlay(); };

    const handleError = () => {
      setSourceIndex((current) => {
        const next = current + 1;
        if (next >= HERO_VIDEO_SOURCES.length) {
          setHasVideoFailed(true);
          return current;
        }

        return next;
      });
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    video.load();
    void tryPlay();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [sourceIndex, hasVideoFailed]);

  const activeSource = HERO_VIDEO_SOURCES[sourceIndex];

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100vh + 3rem + 50px)', marginTop: 'calc(-3rem - 50px)' }}
    >
      <div className="absolute inset-0 bg-[#1e1512]" />

      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 18%, rgba(214, 190, 161, 0.18), transparent 22%),
            radial-gradient(circle at 20% 75%, rgba(191, 166, 138, 0.10), transparent 28%),
            radial-gradient(circle at 80% 78%, rgba(191, 166, 138, 0.08), transparent 28%),
            linear-gradient(135deg, #261b17 0%, #1c1411 45%, #2a1e18 100%)
          `,
        }}
      />

      {!hasVideoFailed ? (
        <video
          key={activeSource}
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-label="Tourbillon hero video"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={activeSource} type="video/mp4" />
        </video>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-[#1e1512]" />

      <div
        ref={scrollHintRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 select-none text-xs uppercase tracking-[0.2em] text-white/40 animate-bounce"
      >
        scroll
      </div>
    </section>
  );
}
