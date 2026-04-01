// Page Transition Animation (fade in when page loads)
// use ScrollFade for independent animations (from bottom to top)
// use StaggeredFade for animations that require a delay between items (from top to bottom)
"use client";
import { motion, HTMLMotionProps } from "framer-motion";
import { EASE_ENTER, DUR } from "@/lib/motion";

// Animates the main content area with a fade-in and upward movement on mount/unmount
export default function MotionMain({ children, ...props }: HTMLMotionProps<"main">) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: DUR.fast, ease: EASE_ENTER }}
      {...props}
    >
      {children}
    </motion.main>
  );
} 