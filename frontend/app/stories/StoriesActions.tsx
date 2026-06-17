// Capability cards for the Stories page (Chapter 03) — "in the boutique".
// A tidy feature grid, the way an e-commerce site surfaces what you can do.
// "Ask" opens the concierge via ChatContext, so this stays a client component.
'use client';

import Link from 'next/link';
import { useChat } from '@/contexts/ChatContext';

type Capability = { term: string; note: string; href?: string; opensChat?: boolean };

const CAPABILITIES: Capability[] = [
  { term: 'Search', note: 'Describe the watch you have in mind, in plain English.', href: '/smart-search' },
  { term: 'Compare', note: 'Hold pieces side by side, differences surfaced.', href: '/compare' },
  { term: 'Save', note: 'Keep a shortlist worth returning to.', href: '/favourites' },
  { term: 'Concierge', note: 'Ask for guidance whenever you want it.', opensChat: true },
];

const CARD =
  'group relative flex flex-col gap-2.5 border border-[#bfa68a]/15 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5 text-left transition-all duration-500 hover:border-[#bfa68a]/40 hover:from-white/[0.08]';

function Inner({ c }: { c: Capability }) {
  return (
    <>
      <span className="flex items-center justify-between">
        <span className="font-playfair text-xl font-light text-[#f0e6d2] transition-colors duration-500 group-hover:text-white">
          {c.term}
        </span>
        <span className="text-[#bfa68a]/45 transition-all duration-500 group-hover:translate-x-1 group-hover:text-[#bfa68a]">
          →
        </span>
      </span>
      <span className="text-[13px] font-light leading-relaxed text-white/55">{c.note}</span>
    </>
  );
}

export default function StoriesActions() {
  const { openChat } = useChat();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CAPABILITIES.map((c) =>
        c.opensChat ? (
          <button key={c.term} type="button" onClick={openChat} className={CARD}>
            <Inner c={c} />
          </button>
        ) : (
          <Link key={c.term} href={c.href!} className={CARD}>
            <Inner c={c} />
          </Link>
        )
      )}
    </div>
  );
}
