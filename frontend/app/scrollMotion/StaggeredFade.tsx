// Scroll Triggered Staggered Fade-in Animation (fade in when scrolling through page by MotionMain)
// use ScrollFade for independent animations (from bottom to top)
// use StaggeredFade for animations that require a delay between items (from top to bottom)
"use client";
import React from 'react';
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { EASE_ENTER, DUR } from "@/lib/motion";

interface StaggeredFadeProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
  // When true: odd items enter from right (x: 30), even from left (x: -30)
  directional?: boolean;
}

export default function StaggeredFade({
  children,
  className = "",
  staggerDelay = 0.1,
  duration = DUR.mid,
  threshold = 0,
  triggerOnce = true,
  directional = false,
}: StaggeredFadeProps) {
  const { ref, inView } = useInView({
    threshold,
    triggerOnce,
    rootMargin: "0px 0px -100px 0px",
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  // Directional mode: alternate left/right per index via `custom` prop
  const itemVariants = directional
    ? {
        hidden: (i: number) => ({
          opacity: 0,
          x: i % 2 === 0 ? -30 : 30,
        }),
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration, ease: EASE_ENTER },
        },
      }
    : {
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: EASE_ENTER },
        },
      };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      style={{ willChange: "opacity, transform", backfaceVisibility: "hidden" }}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          custom={index}
          variants={itemVariants}
          style={{ willChange: "opacity, transform", backfaceVisibility: "hidden" }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
} 