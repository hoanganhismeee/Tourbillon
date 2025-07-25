// ScrollFade.tsx
// Fades its child in when it enters the viewport and fades it out when it leaves, with smooth motion.
// Use for scroll-triggered section or item animations.
"use client";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

// Animates its child: fades in on scroll into view, fades out on scroll out of view (both directions)
export default function ScrollFade({ children }: { children: React.ReactNode }) {
  const { ref, inView } = useInView({
    triggerOnce: false, // allow animation both ways
    threshold: 0.1,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
