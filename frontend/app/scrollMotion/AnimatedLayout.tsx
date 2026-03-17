// Client wrapper for AnimatePresence + MotionMain in the root layout
"use client";
import { AnimatePresence } from "framer-motion";
import MotionMain from "./MotionMain";

export default function AnimatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <MotionMain
        className="relative z-10 pt-[50px]"
        key={typeof window !== 'undefined' ? window.location.pathname : ''}
      >
        {children}
      </MotionMain>
    </AnimatePresence>
  );
}
