// Homepage hero heading with GSAP word-by-word scroll reveal.
// Each word fades in from y:30 with a stagger as the section enters the viewport.
'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const LINES = [
  ['Thirteen', 'Maisons.'],
  ['Endless', 'Discovery.'],
];

export default function HeroHeading() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    const words = containerRef.current.querySelectorAll<HTMLSpanElement>('[data-word]');

    gsap.fromTo(
      words,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          once: true,
        },
      }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="overflow-hidden">
      {LINES.map((words, li) => (
        <div key={li} className="block">
          {words.map((word, wi) => (
            <span
              key={wi}
              data-word
              className="inline-block mr-[0.25em] last:mr-0"
              style={{ opacity: 0 }}
            >
              {word}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
