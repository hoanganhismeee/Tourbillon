// Site-wide footer — large wordmark as texture, 3 editorial columns, bottom bar.
// Color system: section heads = #bfa68a, active links = #9a8878 → #f0e6d2, static text = #6a5c50.
'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#0d0b09] border-t border-[#2a211a]">

      {/* Wordmark — dark on dark, purely textural */}
      <div className="py-10 border-b border-[#2a211a] text-center overflow-hidden">
        <span className="font-playfair font-light tracking-[0.4em] uppercase text-[#2e261e] select-none"
          style={{ fontSize: 'clamp(2rem, 8vw, 6rem)' }}>
          Tourbillon
        </span>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[#2a211a]">

        {/* Contact */}
        <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#2a211a]">
          <h3 className="text-[9px] tracking-[0.2em] uppercase text-[#bfa68a] mb-6 font-inter">Contact</h3>
          <Link href="/contact"
            className="block text-sm text-[#9a8878] hover:text-[#f0e6d2] mb-3 transition-colors duration-300 font-inter">
            Book an Advisor
          </Link>
          <p className="text-sm text-[#6a5c50] mb-2 font-inter">contact@tourbillon.com</p>
          <p className="text-sm text-[#6a5c50] font-inter">London · By appointment</p>
        </div>

        {/* Explore */}
        <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#2a211a]">
          <h3 className="text-[9px] tracking-[0.2em] uppercase text-[#bfa68a] mb-6 font-inter">Explore</h3>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Watches', href: '/watches' },
              { label: 'Stories', href: '/stories' },
              { label: 'Smart Search', href: '/smart-search' },
              { label: 'Compare', href: '/compare' },
              { label: 'Trending', href: '/trend' },
              { label: 'Favourites', href: '/favourites' },
            ].map(({ label, href }) => (
              <Link key={href} href={href}
                className="text-sm text-[#9a8878] hover:text-[#f0e6d2] transition-colors duration-300 font-inter">
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="p-8 md:p-10">
          <h3 className="text-[9px] tracking-[0.2em] uppercase text-[#bfa68a] mb-6 font-inter">Newsletter</h3>
          <p className="text-sm text-[#9a8878] mb-4 font-inter">Rare drops. No noise.</p>
          <form className="flex gap-2" onSubmit={e => e.preventDefault()}>
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-[#161210] border border-[#2e2218] px-3 py-2 text-sm text-[#9a8878] placeholder:text-[#4a3c30] focus:outline-none focus:border-[#bfa68a]/30 font-inter"
            />
            <button
              type="submit"
              className="px-4 py-2 border border-[#bfa68a]/30 text-[#bfa68a] text-sm hover:bg-[#bfa68a]/10 transition-colors duration-300 font-inter"
            >
              →
            </button>
          </form>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
            className="block mt-5 text-sm text-[#9a8878] hover:text-[#f0e6d2] transition-colors duration-300 font-inter">
            Instagram
          </a>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="px-8 md:px-10 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
        <p className="text-[11px] text-[#6a5c50] tracking-wide font-inter">
          © 2025 Tourbillon · All rights reserved
        </p>
        <div className="flex gap-6">
          {['Privacy', 'Terms', 'Cookies'].map(label => (
            <Link key={label} href={`/${label.toLowerCase()}`}
              className="text-[11px] text-[#6a5c50] hover:text-[#9a8878] transition-colors duration-300 tracking-wide font-inter">
              {label}
            </Link>
          ))}
        </div>
      </div>

    </footer>
  );
}
