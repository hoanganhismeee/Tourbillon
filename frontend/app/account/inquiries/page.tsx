// User-facing page showing all submitted inquiries, appointments, and interest registrations.
// Status auto-advances from Received to In Review after 30 minutes via Hangfire.
"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { DYNAMIC_ROUTES, ROUTES } from "@/app/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { imageTransformations } from "@/lib/cloudinary";
import { DUR, EASE_ENTER, EASE_LUXURY } from "@/lib/motion";
import { withReturnTo } from "@/lib/returnNavigation";
import {
  getMyAppointments,
  getMyRegisterInterests,
  MyAppointment,
  MyRegisterInterest,
} from "@/lib/api";

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.mid, ease: EASE_LUXURY } },
};

function prettifyEnum(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function statusBorderStyle(status: string): CSSProperties {
  const s = status.toLowerCase().replace(/\s+/g, "");
  if (s === "confirmed" || s === "completed") return { borderLeftColor: "#bfa68a" };
  if (s === "inreview") return { borderLeftColor: "rgba(255,255,255,0.28)" };
  if (s === "cancelled" || s === "rejected") return { borderLeftColor: "rgba(224,117,117,0.55)" };
  return { borderLeftColor: "rgba(255,255,255,0.12)" };
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/\s+/g, "");
  let cls = "bg-white/[0.07] text-white/45 border-white/15";
  if (s === "confirmed" || s === "completed") cls = "bg-[#bfa68a]/15 text-[#bfa68a] border-[#bfa68a]/35";
  if (s === "inreview") cls = "bg-white/[0.07] text-white/55 border-white/20";
  if (s === "cancelled" || s === "rejected") cls = "bg-red-400/10 text-red-400/75 border-red-400/25";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BookmarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

function WatchMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ opacity: 0.12 }}>
      <circle cx="16" cy="16" r="13" stroke="#bfa68a" strokeWidth="0.8" />
      <circle cx="16" cy="16" r="1.2" fill="#bfa68a" />
      <line x1="16" y1="16" x2="11.5" y2="10.5" stroke="#bfa68a" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="16" y1="16" x2="21" y2="10" stroke="#bfa68a" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}

export default function InquiriesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [interests, setInterests] = useState<MyRegisterInterest[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getMyAppointments(), getMyRegisterInterests()])
      .then(([a, r]) => {
        setAppointments(a);
        setInterests(r);
      })
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  const empty = !fetching && appointments.length === 0 && interests.length === 0;
  const returnTo = ROUTES.ACCOUNT_INQUIRIES;

  return (
    <div className="min-h-[calc(100vh-3rem-50px)]">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-6 py-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-10 lg:py-16 xl:gap-16">
        <motion.aside
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <motion.div variants={fadeUp} className="mb-5 h-px w-8 bg-[#bfa68a]/50" />
          <motion.p variants={fadeUp} className="mb-3 text-[9px] uppercase tracking-[0.5em] text-[#bfa68a]">
            Account
          </motion.p>
          <motion.h1 variants={fadeUp} className="font-playfair text-[3rem] font-light leading-none text-[#f0e6d2]">
            My Inquiries
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-[280px] text-[13px] leading-[1.85] text-white/38">
            Track your boutique appointments and watch interest registrations.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 space-y-5 border-l border-[#bfa68a]/22 pl-6">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/60">Appointments</p>
              <p className="mt-1.5 font-playfair text-[2rem] font-light leading-none text-[#f0e6d2]">
                {fetching ? "-" : appointments.length}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/60">Watch Interests</p>
              <p className="mt-1.5 font-playfair text-[2rem] font-light leading-none text-[#f0e6d2]">
                {fetching ? "-" : interests.length}
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 hidden lg:block">
            <WatchMark />
          </motion.div>
        </motion.aside>

        <motion.main
          className="min-w-0 border-t border-white/10 pt-9 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.mid, ease: EASE_LUXURY, delay: 0.18 }}
        >
          <AnimatePresence mode="wait">
            {fetching ? (
              <motion.p
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="pt-2 text-sm text-[#bfa68a]/60"
              >
                Loading...
              </motion.p>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DUR.mid, ease: EASE_ENTER, delay: 0.05 }}
              >
                {empty && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-white/30">No inquiries yet.</p>
                    <p className="mt-1 text-xs text-white/20">
                      Browse timepieces and contact our advisors to get started.
                    </p>
                  </div>
                )}

                {appointments.length > 0 && (
                  <Section title="Appointments" icon={<CalendarIcon />}>
                    {appointments.map(a => (
                      <InquiryCard key={a.id} status={a.status}>
                        <CardPrimary
                          title={a.brandName || a.boutiqueName}
                          subtitle={prettifyEnum(a.visitPurpose)}
                          badge={<StatusBadge status={a.status} />}
                        />
                        <CardMeta
                          items={[
                            { label: "Boutique", value: a.boutiqueName },
                            { label: "Date", value: formatDate(a.appointmentDate) },
                            { label: "Submitted", value: formatDate(a.createdAt) },
                          ]}
                        />
                      </InquiryCard>
                    ))}
                  </Section>
                )}

                {interests.length > 0 && (
                  <Section title="Register Interest" icon={<BookmarkIcon />}>
                    {interests.map(r => (
                      <InquiryCard key={r.id} status={r.status}>
                        <div className="flex gap-3">
                          {r.watchSlug && r.watchImage && (
                            <Link
                              href={withReturnTo(DYNAMIC_ROUTES.WATCH_DETAIL(r.watchSlug), returnTo)}
                              className="group shrink-0"
                              title="View timepiece"
                            >
                              <div className="h-[60px] w-[60px] overflow-hidden rounded-lg border border-[#bfa68a]/20 bg-white/[0.04] transition-colors group-hover:border-[#bfa68a]/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageTransformations.thumbnail(r.watchImage)}
                                  alt={r.watchDescription || r.watchReference || "Watch"}
                                  className="h-full w-full object-contain p-1"
                                />
                              </div>
                            </Link>
                          )}
                          <div className="min-w-0 flex-1">
                            <CardPrimary
                              title={
                                <BrandCollectionLinks
                                  brandName={r.brandName}
                                  brandSlug={r.brandSlug}
                                  collectionName={r.collectionName}
                                  collectionSlug={r.collectionSlug}
                                  returnTo={returnTo}
                                />
                              }
                              reference={r.watchReference}
                              subtitle={r.watchDescription}
                              badge={<StatusBadge status={r.status} />}
                              watchSlug={r.watchSlug}
                              returnTo={returnTo}
                            />
                            <CardMeta items={[{ label: "Submitted", value: formatDate(r.createdAt) }]} />
                          </div>
                        </div>
                      </InquiryCard>
                    ))}
                  </Section>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.main>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center gap-2.5 border-b border-[#bfa68a]/20 pb-2.5">
        {icon && <span className="text-[#bfa68a]/55">{icon}</span>}
        <h2 className="font-playfair text-base text-[#ecddc8]">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InquiryCard({ status, children }: { status: string; children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-[#bfa68a]/15 bg-white/[0.04] py-4 pl-4 pr-5"
      style={{ borderLeftWidth: 3, ...statusBorderStyle(status) }}
    >
      {children}
    </div>
  );
}

function CardPrimary({
  title,
  reference,
  subtitle,
  badge,
  watchSlug,
  returnTo,
}: {
  title: ReactNode;
  reference?: string;
  subtitle?: string;
  badge?: ReactNode;
  watchSlug?: string;
  returnTo?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[#ecddc8]">{title}</div>
        {reference && (
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-[#bfa68a]/65">
            {watchSlug ? (
              <Link
                href={withReturnTo(DYNAMIC_ROUTES.WATCH_DETAIL(watchSlug), returnTo)}
                className="hover:text-[#bfa68a] transition-colors"
              >
                {reference}
              </Link>
            ) : (
              reference
            )}
          </p>
        )}
        {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{subtitle}</p>}
      </div>
      {badge && <div className="mt-0.5 shrink-0">{badge}</div>}
    </div>
  );
}

function BrandCollectionLinks({
  brandName,
  brandSlug,
  collectionName,
  collectionSlug,
  returnTo,
}: {
  brandName?: string;
  brandSlug?: string | null;
  collectionName?: string;
  collectionSlug?: string | null;
  returnTo: string;
}) {
  if (!brandName && !collectionName) return <>Watch Interest</>;

  return (
    <>
      {brandName &&
        (brandSlug ? (
          <Link href={withReturnTo(DYNAMIC_ROUTES.BRAND_DETAIL(brandSlug), returnTo)} className="hover:text-[#bfa68a] transition-colors">
            {brandName}
          </Link>
        ) : (
          <span>{brandName}</span>
        ))}
      {brandName && collectionName && <span className="px-1 text-[#bfa68a]/55">·</span>}
      {collectionName &&
        (collectionSlug ? (
          <Link href={withReturnTo(DYNAMIC_ROUTES.COLLECTION_DETAIL(collectionSlug), returnTo)} className="hover:text-[#bfa68a] transition-colors">
            {collectionName}
          </Link>
        ) : (
          <span>{collectionName}</span>
        ))}
    </>
  );
}

function CardMeta({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
      {items.map(({ label, value }) => (
        <span key={label} className="text-xs">
          <span className="text-[#bfa68a]/55">{label} </span>
          <span className="text-white/50">{value}</span>
        </span>
      ))}
    </div>
  );
}
