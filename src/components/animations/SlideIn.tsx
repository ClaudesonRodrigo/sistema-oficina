"use client";

import { motion, Variants } from "framer-motion";

export default function SlideIn({ 
  children, 
  className,
  direction = "up",
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
}) {
  
  // AQUI ESTÁ A CORREÇÃO: Adicionei o tipo ': Variants'
  const variants: Variants = {
    hidden: { 
      opacity: 0, 
      y: direction === "up" ? 20 : direction === "down" ? -20 : 0,
      x: direction === "left" ? 20 : direction === "right" ? -20 : 0,
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      transition: { duration: 0.4, delay: delay, ease: "easeOut" }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}