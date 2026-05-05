// Account details and security settings.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { EASE_ENTER, EASE_LUXURY, DUR } from "@/lib/motion";
import UpdateDetailsForm from "./UpdateDetailsForm";
import SignInMethodsCard from "./SignInMethodsCard";
import DeleteAccountForm from "./DeleteAccountForm";

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.mid, ease: EASE_LUXURY } },
};

const formItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_ENTER } },
};

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

export default function EditDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Collector";
  const signInCount = [user.hasPassword, user.hasGoogle, true].filter(Boolean).length;

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
            Edit Profile
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-[280px] text-[13px] leading-[1.85] text-white/38">
            Manage your account details, recovery options, and sign-in methods in one place.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 space-y-5 border-l border-[#bfa68a]/22 pl-6">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/60">Signed in as</p>
              <p className="mt-2 text-sm text-[#f0e6d2]/85">{displayName}</p>
              <p className="mt-1 text-xs text-white/32">{user.email}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#bfa68a]/60">Security</p>
              <p className="mt-2 text-sm text-[#f0e6d2]/85">{signInCount} active sign-in methods</p>
              <p className="mt-1 text-xs text-white/32">
                Password {user.hasPassword ? "enabled" : "not set"} - Magic link active
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 hidden lg:block">
            <WatchMark />
          </motion.div>
        </motion.aside>

        <motion.main
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="min-w-0 border-t border-white/10 pt-9 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
        >
          <motion.div variants={formItem}>
            <UpdateDetailsForm user={user} />
          </motion.div>

          <motion.div variants={formItem} className="mt-11">
            <SignInMethodsCard user={user} />
          </motion.div>

          <motion.div variants={formItem} className="mt-11">
            <DeleteAccountForm />
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}
