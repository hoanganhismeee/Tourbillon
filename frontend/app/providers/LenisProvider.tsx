// Site-wide smooth scroll provider using Lenis.
// lerp: 0.08 — tuned for Windows trackpads (0.05 feels sluggish; go to 0.12 if lag reported).
// Wraps the entire app so all scroll events go through Lenis.
'use client';

import { ReactLenis } from 'lenis/react';

export function LenisProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.08,
        duration: 1.2,
        smoothWheel: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
