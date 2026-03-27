"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

/**
 * PageTransition — wraps page content with a fade + upward slide enter animation.
 *
 * Design spec: opacity 0→1, y 8px→0, duration 200ms.
 * Respects prefers-reduced-motion: instant rendering, no animation.
 * Re-triggers on pathname change via the `key` prop on the motion container.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
