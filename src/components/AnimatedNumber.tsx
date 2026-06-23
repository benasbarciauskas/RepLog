import { useEffect, useRef, useState } from 'react';
import {
  animate,
  useInView,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  /** The target value to count up to. */
  value: number;
  /** Decimal places to display. Default 0. */
  decimals?: number;
  /** Text rendered before the number (e.g. nothing, or a sign). */
  prefix?: string;
  /** Text rendered after the number (e.g. " kg", "%"). */
  suffix?: string;
  /** Count-up duration in seconds. Default 0.9. */
  duration?: number;
  /** Only animate once the element scrolls into view. Default true. */
  animateOnView?: boolean;
  className?: string;
}

/**
 * Count-up number display. Tabular figures so it never reflows mid-count.
 *
 * Respects `prefers-reduced-motion`: when reduced, the final value renders
 * immediately with no animation (per a11y guidance — movement is opt-out,
 * the information is never withheld).
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 0.9,
  animateOnView = true,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(() =>
    reduce ? value : 0,
  );

  const format = (n: number) =>
    `${prefix}${n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  useEffect(() => {
    // Reduced motion: snap to the value, never animate.
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (animateOnView && !inView) return;

    const controls: AnimationPlaybackControls = animate(0, value, {
      duration,
      ease: [0.23, 1, 0.32, 1], // --ease-out-strong
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration, reduce, inView, animateOnView]);

  return (
    <span ref={ref} className={cn('tnum', className)}>
      {format(display)}
    </span>
  );
}
