// This class was created to debug the login page empty space issue, and transition issue
// Custom layout for login page with fast, smooth transition
"use client";
import { motion } from "framer-motion";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div 
      className="relative z-10 pt-[50px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
} 