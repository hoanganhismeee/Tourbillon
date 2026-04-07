// Scroll Triggered Fade-in Animation (fade in when scrolling through page)
// use ScrollFade for independent animations (from bottom to top)
// use StaggeredFade for animations that require a delay between items (from top to bottom)
"use client";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { EASE_ENTER } from "@/lib/motion";

// Animates its child: fades in on scroll into view, fades out on scroll out of view (both directions)
export default function ScrollFade({ 
  children, 
  className = "",
  delay = 0,
  duration = 0.8,
  threshold = 0.2,
  triggerOnce = false
}: { 
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
}) {
  const { ref, inView } = useInView({
    triggerOnce,
    threshold,
    rootMargin: "0px 0px -50px 0px", // Start animation slightly before element is fully in view
  });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ 
        duration, 
        delay,
        ease: EASE_ENTER,
        opacity: { duration: duration * 0.8 },
        y: { duration: duration }
      }}
      style={{ 
        willChange: "opacity, transform",
        backfaceVisibility: "hidden" // Improves performance
      }}
    >
      {children}
    </motion.div>
  );
}
