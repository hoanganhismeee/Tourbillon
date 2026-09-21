// What the concierge is doing while a reply is being written. Three dots alone read as "possibly
// broken" on a reply that takes four seconds, so the line says which stage the wait is in.
'use client';

import { useEffect, useState } from 'react';

// The phases follow the measured pipeline: the message is classified and the brief parsed first
// (about a second), then retrieval, then the wording and the follow-up chips in parallel (about
// three). The line is a report of where the turn is, not a spinner with words on it.
const PHASES: { from: number; lines: string[] }[] = [
  { from: 0, lines: ['reading your message', 'taking in the details'] },
  { from: 1400, lines: ['searching the catalogue', 'pulling the closest references'] },
  { from: 3000, lines: ['weighing the shortlist', 'comparing the picks'] },
  { from: 5000, lines: ['writing', 'choosing the words'] },
  { from: 9000, lines: ['still writing', 'almost there'] },
];

const LINE_MS = 2200;
const TICK_MS = 300;

function statusLine(elapsedMs: number): string {
  const phase = [...PHASES].reverse().find(p => elapsedMs >= p.from) ?? PHASES[0];
  const index = Math.floor(elapsedMs / LINE_MS) % phase.lines.length;
  return phase.lines[index];
}

export default function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-2.5 rounded-2xl rounded-bl-md px-4 py-3 text-sm"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <span aria-hidden className="flex items-center gap-1">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#bfa68a]/60 motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        {/* Polite, so a screen reader hears the stage without losing the reply when it arrives. */}
        <span role="status" aria-live="polite" className="text-[0.8rem] leading-none text-white/45">
          Tourbillon is {statusLine(elapsed)}
          <span aria-hidden className="tracking-[0.2em]">…</span>
        </span>
      </div>
    </div>
  );
}
