// Site-wide footer — editorial pre-footer CTA, 3-column grid, bottom bar.
// Uses the project's white/X opacity system on the page's warm-brown base.
'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">

      {/* Pre-footer editorial CTA — replaces old amateurish watermark block */}
      <div className="py-20 px-8 md:px-16 text-center border-b border-white/[0.06]">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[#bfa68a] mb-5 font-inter">
          Private Access
        </p>
        <h2
          className="font-playfair font-light text-[#f0e6d2] mb-4 leading-tight"
          style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}
        >
          Begin your collection.
        </h2>
        <p className="text-sm text-white/35 font-inter mb-10 max-w-xs mx-auto">
          Private viewings available in London. By appointment only.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-[#f0e6d2] border border-[#bfa68a]/45 hover:border-[#bfa68a] hover:bg-[#bfa68a]/5 px-8 py-3.5 transition-all duration-300 font-inter"
        >
          Book a Private Viewing
          <span className="text-[#bfa68a]">→</span>
        </Link>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-white/[0.06]">

        {/* Contact */}
        <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <h3 className="text-[9px] tracking-[0.25em] uppercase text-[#bfa68a] mb-6 font-inter">Contact</h3>
          <Link
            href="/contact"
            className="flex items-center gap-2 text-sm text-[#f0e6d2]/80 hover:text-[#f0e6d2] mb-4 transition-colors duration-300 font-inter group"
          >
            Book an Advisor
            <span className="text-[#bfa68a] transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </Link>
          <p className="text-sm text-white/30 mb-2 font-inter">contact@tourbillon.com</p>
          <p className="text-sm text-white/30 font-inter">London · By appointment</p>
        </div>

        {/* Explore */}
        <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <h3 className="text-[9px] tracking-[0.25em] uppercase text-[#bfa68a] mb-6 font-inter">Explore</h3>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Watches', href: '/watches' },
              { label: 'Stories', href: '/stories' },
              { label: 'Smart Search', href: '/smart-search' },
              { label: 'Compare', href: '/compare' },
              { label: 'Trending', href: '/trend' },
              { label: 'Favourites', href: '/favourites' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-white/45 hover:text-white/80 transition-colors duration-300 font-inter"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="p-8 md:p-10">
          <h3 className="text-[9px] tracking-[0.25em] uppercase text-[#bfa68a] mb-6 font-inter">Newsletter</h3>
          <p className="text-sm text-white/40 mb-5 font-inter leading-relaxed max-w-[18rem]">
            Rare releases, curatorial notes, and private event invitations. Never noise.
          </p>
          <form className="flex gap-0 mb-5" onSubmit={e => e.preventDefault()}>
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-white/[0.03] border border-[#bfa68a]/20 border-r-0 px-4 py-2.5 text-sm text-white/50 placeholder:text-white/20 focus:outline-none focus:border-[#bfa68a]/45 font-inter transition-colors duration-300"
            />
            <button
              type="submit"
              className="px-4 py-2.5 border border-[#bfa68a]/20 hover:border-[#bfa68a]/50 text-[#bfa68a] hover:bg-[#bfa68a]/8 text-sm transition-all duration-300 font-inter"
            >
              →
            </button>
          </form>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors duration-300 font-inter"
          >
            Instagram
            <span className="text-xs text-white/25">↗</span>
          </a>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="px-8 md:px-10 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
        <p className="text-[11px] text-white/20 tracking-wide font-inter">
          © 2025 Tourbillon · All rights reserved
        </p>
        <div className="flex gap-6">
          {['Privacy', 'Terms', 'Cookies'].map(label => (
            <Link
              key={label}
              href={`/${label.toLowerCase()}`}
              className="text-[11px] text-white/20 hover:text-white/45 transition-colors duration-300 tracking-wide font-inter"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

    </footer>
  );
}
