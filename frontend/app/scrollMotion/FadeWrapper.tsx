// FadeWrapper.tsx
// Fades its children in when they enter the viewport using framer-motion and react-intersection-observer.
// Use for simple scroll-triggered fade-in effects.
"use client";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

// Animates its children with a fade-in and upward movement when in view
export default function FadeWrapper({ children }: { children: React.ReactNode }) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
