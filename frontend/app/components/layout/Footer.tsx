// Site-wide footer with a stronger editorial brand lead and restrained utility navigation.
// Keeps the warm metallic palette, avoids dead links, and leaves visual room for the concierge pill.
import Link from 'next/link';
import { ROUTES } from '@/app/constants/routes';

const navigationColumns = [
  {
    title: 'Explore',
    links: [
      { label: 'Watches', href: ROUTES.WATCHES, description: 'Browse the full collection.' },
      { label: 'Stories', href: ROUTES.STORIES, description: 'Read editorial notes and horology pieces.' },
      { label: 'Smart Search', href: '/#smart-search', description: 'Describe a brief and start from the homepage finder.' },
      { label: 'Compare', href: '/compare', description: 'Review details side by side.' },
    ],
  },
  {
    title: 'Client Services',
    links: [
      { label: 'Watch DNA', href: '/#watch-dna', description: 'See how taste signals shape the homepage curation.' },
      { label: 'Favourites', href: '/favourites', description: 'Keep saved references within reach.' },
      { label: 'Sign In', href: ROUTES.LOGIN, description: 'Access your account and saved activity.' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/hoanganhchu/', description: 'Follow the project and its builder.' },
    ],
  },
];

function FooterNavLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  const isExternal = href.startsWith('http');

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="group block border-b border-white/6 pb-4 transition-colors duration-300 hover:border-[#bfa68a]/18"
    >
      <span className="relative inline-flex w-fit text-[1.02rem] font-inter text-white/68 transition-colors duration-300 group-hover:text-[#f0e6d2]">
        {label}
        <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[#bfa68a]/60 transition-transform duration-300 group-hover:scale-x-100" />
      </span>
      <span className="mt-2 block text-[12px] leading-relaxed text-white/24 font-inter transition-colors duration-300 group-hover:text-white/34">
        {description}
      </span>
    </Link>
  );
}

function FooterCta({
  href,
  label,
  variant = 'gold',
}: {
  href: string;
  label: string;
  variant?: 'gold' | 'muted';
}) {
  const baseClassName =
    'relative inline-flex w-fit items-center justify-center overflow-hidden border px-10 py-4 text-[10px] uppercase tracking-[0.3em] transition-all duration-500 group whitespace-nowrap';
  const variantClassName =
    variant === 'gold'
      ? 'border-[#bfa68a]/25 text-[#bfa68a] hover:bg-[#bfa68a]/8 hover:border-[#bfa68a]/40'
      : 'border-white/12 text-white/42 hover:border-[#bfa68a]/28 hover:bg-[#bfa68a]/[0.03] hover:text-[#f0e6d2]/82';

  return (
    <Link href={href} className={`${baseClassName} ${variantClassName}`}>
      <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
        {label}
      </span>
      <span className="absolute right-6 opacity-0 -translate-x-4 text-[14px] transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.012)_0%,rgba(255,255,255,0.004)_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            background:
              'radial-gradient(ellipse 58% 54% at 20% 10%, rgba(191,166,138,0.06) 0%, transparent 64%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, rgba(191,166,138,0) 0%, rgba(191,166,138,0.32) 50%, rgba(191,166,138,0) 100%)',
          }}
        />
      </div>

      <div className="relative px-8 sm:px-10 lg:px-16 xl:px-20">
        <div className="grid grid-cols-1 border-b border-white/[0.06] lg:grid-cols-2">
          <div className="py-11 sm:py-12 lg:pr-14 xl:pr-16">
            <p className="mb-6 text-[9px] uppercase tracking-[0.38em] text-[#bfa68a] font-inter">
              Tourbillon
            </p>
            <div className="max-w-xl border-l border-[#bfa68a]/28 pl-6 sm:pl-8">
              <h2 className="font-playfair text-[2.25rem] font-light leading-[0.95] text-[#f0e6d2] sm:text-[2.75rem]">
                Curated watches for collectors who value restraint.
              </h2>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/42 font-inter sm:text-[15px]">
                Private sourcing, considered storytelling, and a quieter way to discover modern
                horology.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <FooterCta href={ROUTES.CONTACT} label="Book an Advisor" />
            </div>
          </div>

          <div className="border-t border-white/[0.06] py-11 sm:py-12 lg:border-l lg:border-t-0 lg:pl-14 xl:pl-16">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-12 xl:gap-x-16">
            {navigationColumns.map(column => (
              <div key={column.title}>
                <p className="mb-6 text-[9px] uppercase tracking-[0.38em] text-[#bfa68a] font-inter">
                  {column.title}
                </p>
                <div className="flex flex-col gap-5">
                  {column.links.map(link => (
                    <FooterNavLink
                      key={link.label}
                      href={link.href}
                      label={link.label}
                      description={link.description}
                    />
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-6 text-[11px] tracking-[0.14em] text-white/22 font-inter md:py-7 lg:pr-56 xl:pr-64">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>Copyright {currentYear} Tourbillon. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>Private viewings in London</span>
              <span className="h-1 w-1 rounded-full bg-[#bfa68a]/35" />
              <span>Concierge-led discovery</span>
              <span className="h-1 w-1 rounded-full bg-[#bfa68a]/35" />
              <span>Price on Request available</span>
            </div>
          </div>
          <p className="text-white/18 tracking-[0.08em]">
            All images and video assets are used for portfolio and demonstration purposes only. No commercial use is intended.
          </p>
        </div>
      </div>
    </footer>
  );
}
