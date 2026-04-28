// Client wrapper for AnimatePresence + MotionMain in the root layout
"use client";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import MotionMain from "./MotionMain";

export default function AnimatedLayout({ children }: { children: React.ReactNode }) {
  // usePathname updates only when App Router commits the new page —
  // so the key changes only when children is already the new page.
  // mode="sync" runs exit + enter in parallel (no dead gap between them).
  const pathname = usePathname();
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
