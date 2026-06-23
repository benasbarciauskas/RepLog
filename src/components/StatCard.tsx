import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './AnimatedNumber';

export interface StatCardProps {
  /** Small label above the value, e.g. "Bench Press" or "Est. 1RM". */
  label: string;
  /** Numeric hero value. When provided, it count-up animates. */
  value?: number;
  /** Decimals for the animated value. */
  decimals?: number;
  /** Unit / suffix shown after the value (e.g. " kg"). */
  suffix?: string;
  /** Alternative to `value` — render arbitrary content as the hero (e.g. "BW"). */
  display?: ReactNode;
  /** Secondary line under the value (date, context). */
  hint?: string;
  /** Optional lucide icon shown top-right. */
  icon?: ComponentType<LucideProps>;
  /** Visual emphasis. `highlight` tints the value with the accent (use for PRs). */
  tone?: 'default' | 'highlight';
  /** Makes the whole card feel interactive (hover lift, pointer). */
  interactive?: boolean;
  /** Click handler — when set, the card becomes a button. */
  onClick?: () => void;
  className?: string;
}

/**
 * The dashboard hero unit. A big tabular number with a label and a hint.
 * `tone="highlight"` paints the number in the accent for personal records.
 * Hover lift + active press feedback when `interactive`.
 */
export function StatCard({
  label,
  value,
  decimals = 0,
  suffix,
  display,
  hint,
  icon: Icon,
  tone = 'default',
  interactive = false,
  onClick,
  className,
}: StatCardProps) {
  const reduce = useReducedMotion();
  const isButton = Boolean(onClick);

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon
            className={cn(
              'size-4 shrink-0',
              tone === 'highlight' ? 'text-highlight' : 'text-muted-foreground',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
      </div>
      <div
        className={cn(
          'text-display-sm font-semibold sm:text-display-md',
          tone === 'highlight' ? 'text-highlight' : 'text-foreground',
        )}
      >
        {display !== undefined ? (
          <span className="tnum">{display}</span>
        ) : (
          <AnimatedNumber
            value={value ?? 0}
            decimals={decimals}
            suffix={suffix}
          />
        )}
      </div>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </>
  );

  const classes = cn(
    'flex min-h-32 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors',
    interactive &&
      'hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    className,
  );

  if (isButton) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={classes}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={reduce ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      >
        {content}
      </motion.button>
    );
  }

  return <div className={classes}>{content}</div>;
}
