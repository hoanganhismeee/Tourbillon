// Chapter 04 actions for the Stories page — "what it's for".
// Three quiet rows that turn the journal back into the platform: browse and
// compare are links, ask opens the concierge via ChatContext. Client-only
// because the concierge is opened through useChat().
'use client';

import Link from 'next/link';
import { useChat } from '@/contexts/ChatContext';

type ActionRow = { label: string; phrase: string; href?: string; opensChat?: boolean };

const ROWS: ActionRow[] = [
  { label: 'Browse', phrase: 'the catalogue, unhurried.', href: '/watches' },
  { label: 'Compare', phrase: 'two pieces, side by side.', href: '/watches' },
  { label: 'Ask', phrase: 'the concierge, anything.', opensChat: true },
];

function RowInner({ label, phrase }: { label: string; phrase: string }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="font-playfair text-2xl font-light text-[#f0e6d2] transition-colors duration-500 group-hover:text-white md:text-3xl">
          {label}
        </span>
        <span className="text-[14px] font-light italic text-white/45">{phrase}</span>
      </span>
      <span className="text-lg text-[#bfa68a]/40 transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-[#bfa68a]">
        →
      </span>
    </>
  );
}

const ROW_CLASS =
  'group flex w-full items-center justify-between gap-6 border-t border-[#bfa68a]/12 py-7 text-left';

export default function StoriesActions() {
  const { openChat } = useChat();

  return (
    <div className="mt-12">
      {ROWS.map((row) =>
        row.opensChat ? (
          <button key={row.label} type="button" onClick={openChat} className={ROW_CLASS}>
            <RowInner label={row.label} phrase={row.phrase} />
          </button>
        ) : (
          <Link key={row.label} href={row.href!} className={ROW_CLASS}>
            <RowInner label={row.label} phrase={row.phrase} />
          </Link>
        )
      )}
    </div>
  );
}
