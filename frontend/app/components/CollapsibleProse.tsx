'use client';

// Long-form body copy that opens on request. A whole number of lines is shown before the fold,
// the rest is masked out rather than painted over, and copy short enough to fit gets no toggle.
import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const LINE_HEIGHT_REM = 1.8;
const COLLAPSED_LINES = 4;
const COLLAPSED_HEIGHT = `${COLLAPSED_LINES * LINE_HEIGHT_REM}rem`;

export default function CollapsibleProse({ paragraphs }: { paragraphs: string[] }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const panelId = useId();

  // Measure the full copy against the fold; a description that already fits needs no toggle.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const check = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setOverflows(node.scrollHeight > COLLAPSED_LINES * LINE_HEIGHT_REM * rootPx + 4);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [paragraphs]);

  if (paragraphs.length === 0) return null;
  const collapsed = overflows && !open;

  return (
    <div className="max-w-[64ch]">
      <motion.div
        id={panelId}
        initial={false}
        animate={{ height: collapsed ? COLLAPSED_HEIGHT : 'auto' }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`overflow-hidden ${collapsed ? '[mask-image:linear-gradient(to_bottom,black_55%,transparent)]' : ''}`}
      >
        <div ref={contentRef}>
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="mb-5 text-[15px] font-light leading-[1.8rem] text-white/65 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </motion.div>

      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="group mt-5 inline-flex items-center gap-3 text-[#bfa68a] transition-colors duration-300 hover:text-[#f0e6d2] focus-visible:text-[#f0e6d2] focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="h-px w-6 bg-current opacity-60 transition-[width] duration-300 group-hover:w-9"
          />
          <span className="text-[11px] font-light uppercase tracking-[0.28em]">
            {open ? 'Read less' : 'Continue reading'}
          </span>
        </button>
      )}
    </div>
  );
}
