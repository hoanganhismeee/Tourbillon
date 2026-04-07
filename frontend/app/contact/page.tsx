// Contact page — displays business contact information
// Publicly accessible, no authentication required
'use client';

import { motion } from 'framer-motion';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

const contactItems = [
  {
    label: 'Email',
    value: 'hoanganh31012005@gmail.com',
    href: 'mailto:hoanganh31012005@gmail.com',
  },
  {
    label: 'Phone',
    value: '(+61) 40 606 2737',
    href: null,
  },
  {
    label: 'Address',
    value: 'Sydney',
    href: null,
  },
  {
    label: 'Hours',
    value: 'Monday – Saturday\n10:00 am – 6:00 pm',
    href: null,
  },
];

export default function ContactPage() {
  return (
    <ScrollFade>
      <div className="min-h-screen text-white">

        {/* Hero */}
        <div className="relative flex flex-col justify-end px-10 lg:px-24 pt-44 pb-20 border-b border-white/5">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80 mb-5"
          >
            Get in Touch
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="relative font-playfair font-light text-[#f0e6d2] leading-none mb-6 -ml-[0.06em]"
            style={{ fontSize: 'clamp(3.5rem, 8vw, 7rem)' }}
          >
            Contact Us
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative text-white/35 text-sm max-w-[380px] leading-relaxed text-balance"
          >
            Our advisors are available to assist with acquisitions, valuations,
            and any enquiry about our collection.
          </motion.p>
        </div>

        {/* Contact grid */}
        <div className="px-10 lg:px-24 py-20 grid grid-cols-1 lg:grid-cols-2 gap-0">

          {/* Left — contact details */}
          <div className="lg:border-r border-[#bfa68a]/8 lg:pr-20 pb-16 lg:pb-0">
            <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80 mb-10">Contact Information</p>
            <div>
              {contactItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="flex items-start justify-between py-6 border-b border-white/5 group"
                >
                  <span className="text-[9px] uppercase tracking-[0.35em] text-[#bfa68a]/75 w-20 shrink-0 pt-0.5">
                    {item.label}
                  </span>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-white/60 hover:text-[#f0e6d2] transition text-sm text-right leading-relaxed whitespace-pre-line"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <span className="text-white/60 text-sm text-right leading-relaxed whitespace-pre-line">
                      {item.value}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — advisory note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="lg:pl-20 pt-16 lg:pt-0 flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-[#bfa68a]/80 mb-10">Private Advisory</p>

              <blockquote className="border-l-2 border-[#bfa68a]/60 pl-6 mb-10 py-1">
                <p className="text-[#f0e6d2] font-playfair text-[1.4rem] leading-relaxed italic">
                  &ldquo;Every great timepiece deserves a conversation.&rdquo;
                </p>
              </blockquote>

              <p className="text-white/35 text-sm leading-relaxed mb-10 max-w-sm">
                Reach out for personalised assistance with bespoke acquisitions, watch valuations, or Price on Request timepieces. Our specialists respond within 24 to 48 hours.
              </p>

              <a
                href="mailto:hoanganh31012005@gmail.com"
                className="relative inline-flex items-center justify-center text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] border border-[#bfa68a]/25 px-12 py-4 hover:bg-[#bfa68a]/8 hover:border-[#bfa68a]/40 transition-all duration-500 group overflow-hidden"
              >
                <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
                  Send an Email
                </span>
                <span className="absolute right-8 opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0 text-[14px]">
                  →
                </span>
              </a>
            </div>

          </motion.div>

        </div>
      </div>
    </ScrollFade>
  );
}
