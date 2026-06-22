import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/** Visual tone for the ring's arc colour. Maps to the design tokens. */
export type GaugeTone = 'highlight' | 'success' | 'warn' | 'destructive' | 'muted';

const TONE_STROKE: Record<GaugeTone, string> = {
  highlight: 'var(--color-highlight)',
  success: 'var(--color-success)',
  warn: 'var(--color-warn)',
  destructive: 'var(--color-destructive)',
  muted: 'var(--color-muted-foreground)',
};

export interface RingGaugeProps {
  /** Progress value in [0, max]. Drives the arc sweep + (default) the centre number. */
  value: number;
  /** Maximum value the ring represents. Default 100. */
  max?: number;
  /**
   * Diameter in px. Default 200. The stroke + font scale off this so a single
   * size prop keeps the gauge proportionate at any scale.
   */
  size?: number;
  /** Stroke width in px. Defaults to ~9% of `size` (clamped) for a premium thin ring. */
  thickness?: number;
  /** Arc colour token. Default `highlight` (acid-lime — used sparingly, here for the score). */
  tone?: GaugeTone;
  /** Centre hero content. When omitted, the rounded value renders as a `.tnum` number. */
  children?: ReactNode;
  /** Small caption under the centre number (e.g. "Balance" or the area label). */
  label?: string;
  /**
   * Render the centre value as a plain number even without children. Default true.
   * Set false + pass `children` for fully custom centre content.
   */
  showValue?: boolean;
  /** Suffix appended to the auto-rendered centre number (e.g. nothing, or "%"). */
  valueSuffix?: string;
  /** Count-up + arc-sweep duration in seconds. Default 0.9. */
  duration?: number;
  /** Accessible label. Falls back to "<value> out of <max>". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Circular score gauge — the Umax-style hero. Hand-rolled SVG (no recharts dep)
 * so the arc sweep + centre count-up animate together on the project's strong
 * ease-out curve, and snap instantly under reduced motion (information is never
 * withheld). Numbers are the hero: the centre renders a big `.tnum` value.
 *
 * One accent, used sparingly: the default `highlight` tone is the acid-lime; the
 * track is a quiet border-toned ring so the fill reads as the signal.
 */
export function RingGauge({
  value,
  max = 100,
  size = 200,
  thickness,
  tone = 'highlight',
  children,
  label,
  showValue = true,
  valueSuffix = '',
  duration = 0.9,
  ariaLabel,
  className,
}: RingGaugeProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  const target = clamp(value, 0, max);
  const fraction = max > 0 ? target / max : 0;

  // Animated progress fraction [0,1] and displayed number, driven together.
  const [animFraction, setAnimFraction] = useState(reduce ? fraction : 0);
  const [displayValue, setDisplayValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setAnimFraction(fraction);
      setDisplayValue(target);
      return;
    }
    if (!inView) return;
    const controls = animate(0, 1, {
      duration,
      ease: [0.23, 1, 0.32, 1], // --ease-out-strong (matches the design system)
      onUpdate: (t) => {
        setAnimFraction(fraction * t);
        setDisplayValue(target * t);
      },
    });
    return () => controls.stop();
  }, [fraction, target, reduce, inView, duration]);

  const stroke = thickness ?? clamp(Math.round(size * 0.09), 6, 22);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animFraction);

  return (
    <div
      ref={ref}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(target)} out of ${max}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        {/* Track — quiet ring so the coloured arc is the signal. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        {/* Progress arc. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      {/* Centre content — the hero number, or custom children. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        {children ?? (
          showValue ? (
            <span
              className={cn(
                'tnum font-semibold leading-none text-foreground',
                size >= 180 ? 'text-display-md' : size >= 120 ? 'text-display-sm' : 'text-2xl',
              )}
            >
              {Math.round(displayValue)}
              {valueSuffix}
            </span>
          ) : null
        )}
        {label ? (
          <span className="mt-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
