// Bridges Lenis smooth scroll with GSAP ScrollTrigger.
// Must be nested inside LenisProvider so useLenis can resolve.
// Registers the ScrollTrigger plugin once and keeps it in sync with Lenis scroll events.
'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLenis } from 'lenis/react';

gsap.registerPlugin(ScrollTrigger);

export function GSAPProvider({ children }: { children: React.ReactNode }) {
  // Feed every Lenis scroll event into ScrollTrigger so pinning + scrub tracks correctly
  useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    // Initial refresh ensures ScrollTrigger measures correct positions after hydration
    ScrollTrigger.refresh();
  }, []);

  return <>{children}</>;
}
