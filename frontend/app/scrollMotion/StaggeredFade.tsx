// Scroll Triggered Staggered Fade-in Animation (fade in when scrolling through page by MotionMain)
// use ScrollFade for independent animations (from bottom to top)
// use StaggeredFade for animations that require a delay between items (from top to bottom)
"use client";
import React from 'react';
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

interface StaggeredFadeProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
}

export default function StaggeredFade({ 
  children, 
  className = "",
  staggerDelay = 0.1, // delay between items
  duration = 0.6, // duration of the animation
  threshold = 0.1, // animation starts when 10% of the element is visible
  triggerOnce = true // animation only plays once
}: StaggeredFadeProps) {
  const { ref, inView } = useInView({
    threshold,
    triggerOnce,
    rootMargin: "0px 0px -100px 0px",
  });

  const containerVariants = { // animation for the container
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = { // animation for each item
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  return ( // container for the animation
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      style={{ 
        willChange: "opacity, transform",
        backfaceVisibility: "hidden"
      }}
    >
      {React.Children.map(children, (child, index) => ( // each item in the container
        <motion.div
          key={index}
          variants={itemVariants}
          style={{ 
            willChange: "opacity, transform",
            backfaceVisibility: "hidden"
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
} 