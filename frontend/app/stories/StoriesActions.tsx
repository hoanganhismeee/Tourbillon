// Final chapter actions for the Stories page — "what it's for".
// Three detailed rows that turn the journal back into the platform: browse and
// compare are links, ask opens the concierge via ChatContext. Client-only
// because the concierge is opened through useChat().
'use client';

import Link from 'next/link';
import { useChat } from '@/contexts/ChatContext';

type ActionRow = {
  mark: string;
  label: string;
  phrase: string;
  note: string;
  href?: string;
  opensChat?: boolean;
};

const ROWS: ActionRow[] = [
  {
    mark: 'A',
    label: 'Browse',
    phrase: 'the catalogue, unhurried.',
    note: 'Filter by brand, complication, price, or the feel you are after.',
    href: '/watches',
  },
  {
    mark: 'B',
    label: 'Compare',
    phrase: 'two pieces, side by side.',
    note: 'Hold candidates together and read the differences that matter.',
    href: '/watches',
  },
  {
    mark: 'C',
    label: 'Ask',
    phrase: 'the concierge, anything.',
    note: 'A guided search that listens, then narrows the field for you.',
    opensChat: true,
  },
];

function RowInner({ row }: { row: ActionRow }) {
  return (
    <>
      <span className="flex flex-shrink-0 items-center justify-center self-start pt-1">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#bfa68a]/35 font-playfair text-[12px] text-[#bfa68a]/80 transition-colors duration-500 group-hover:border-[#bfa68a]/70 group-hover:text-[#bfa68a]">
          {row.mark}
        </span>
      </span>
      <span className="flex-1">
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-playfair text-2xl font-light text-[#f0e6d2] transition-colors duration-500 group-hover:text-white md:text-3xl">
            {row.label}
          </span>
          <span className="text-[14px] font-light italic text-white/45">{row.phrase}</span>
        </span>
        <span className="mt-2 block max-w-md text-[12.5px] font-light leading-relaxed text-white/35">
          {row.note}
        </span>
      </span>
      <span className="self-center text-lg text-[#bfa68a]/40 transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-[#bfa68a]">
        →
      </span>
    </>
  );
}

const ROW_CLASS =
  'group flex w-full items-start gap-6 border-t border-[#bfa68a]/12 py-8 text-left';

export default function StoriesActions() {
  const { openChat } = useChat();

  return (
    <div className="mt-12">
      {ROWS.map((row) =>
        row.opensChat ? (
          <button key={row.label} type="button" onClick={openChat} className={ROW_CLASS}>
            <RowInner row={row} />
          </button>
        ) : (
          <Link key={row.label} href={row.href!} className={ROW_CLASS}>
            <RowInner row={row} />
          </Link>
        )
      )}
    </div>
  );
}
