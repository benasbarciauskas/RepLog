import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps a route's content with an enter/exit transition. Mount this INSIDE an
 * <AnimatePresence mode="wait"> keyed by the route, so exits complete before
 * the next page enters.
 *
 * Motion is purposeful here (spatial continuity between routes). Under
 * `prefers-reduced-motion` it degrades to a plain opacity fade — no movement.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
