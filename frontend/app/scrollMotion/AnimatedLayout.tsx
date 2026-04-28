// Client wrapper for AnimatePresence + MotionMain in the root layout
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useLenis } from "lenis/react";
import MotionMain from "./MotionMain";

// Shared key with useScrollRestore — checked to avoid overriding back-nav restoration.
const NAV_STORAGE_KEY = 'tourbillon-nav';

export default function AnimatedLayout({ children }: { children: React.ReactNode }) {
  // usePathname updates only when App Router commits the new page —
  // so the key changes only when children is already the new page.
  // mode="sync" runs exit + enter in parallel (no dead gap between them).
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    // If useScrollRestore has a back-nav checkpoint for this exact path, let it
    // handle the position. clearNavigationState() is async (setState → effect),
    // so sessionStorage still has the entry when this effect runs after children mount.
    try {
      const raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.path === window.location.pathname + window.location.search) return;
      }
    } catch { /* ignore */ }

    // Forward navigation — jump to top instantly, bypassing Lenis easing.
    lenis?.scrollTo(0, { immediate: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence mode="sync">
      <MotionMain
        className="relative z-10 pt-[50px]"
        key={pathname}
      >
        {children}
      </MotionMain>
    </AnimatePresence>
  );
}
