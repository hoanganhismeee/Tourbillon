// MotionMain.tsx
// Provides a fade-in and upward motion animation for the main content area on page load or navigation.
// Use for page transition effects.
"use client";
import { motion, HTMLMotionProps } from "framer-motion";

// Animates the main content area with a fade-in and upward movement on mount/unmount
export default function MotionMain({ children, ...props }: HTMLMotionProps<"main">) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 1, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.main>
  );
} 