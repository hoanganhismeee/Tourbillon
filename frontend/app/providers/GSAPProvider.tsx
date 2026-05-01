// Bridges Lenis smooth scroll with GSAP ScrollTrigger.
// Must be nested inside LenisProvider so useLenis can resolve.
// Registers the ScrollTrigger plugin once and keeps it in sync with Lenis scroll events.
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLenis } from 'lenis/react';

gsap.registerPlugin(ScrollTrigger);

export function GSAPProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Feed every Lenis scroll event into ScrollTrigger so pinning + scrub tracks correctly
  useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    // Refresh on every route change so ScrollTrigger re-measures element positions
    // after the new page mounts (prevents scroll animations from misfiring).
    ScrollTrigger.refresh();
  }, [pathname]);

  return <>{children}</>;
}
