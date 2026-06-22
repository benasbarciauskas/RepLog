import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { SplitCanonical, TrainingBlock } from '@/types/models';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Short readable split name for the strip labels. */
const SPLIT_LABELS: Record<SplitCanonical, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  'chest-back': 'Chest & Back',
  'chest-tris': 'Chest & Tris',
  'back-bis': 'Back & Bis',
  shoulders: 'Shoulders',
  arms: 'Arms',
  'full-body': 'Full Body',
  cardio: 'Cardio',
  unknown: 'Mixed',
};

/**
 * Split → chart color var. Lime (chart-1) stays the accent and is reserved for
 * push (the most common starting split); the rest cycle the other chart hues so
 * adjacent blocks stay distinguishable. Unknown reads muted.
 */
const SPLIT_COLOR: Record<SplitCanonical, string> = {
  push: 'var(--color-chart-1)',
  pull: 'var(--color-chart-2)',
  legs: 'var(--color-chart-3)',
  upper: 'var(--color-chart-4)',
  lower: 'var(--color-chart-5)',
  'chest-back': 'var(--color-chart-2)',
  'chest-tris': 'var(--color-chart-3)',
  'back-bis': 'var(--color-chart-4)',
  shoulders: 'var(--color-chart-5)',
  arms: 'var(--color-chart-4)',
  'full-body': 'var(--color-chart-3)',
  cardio: 'var(--color-chart-2)',
  unknown: 'var(--color-muted-foreground)',
};

function days(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  // Inclusive span; a single-day block still has weight 1.
  return Math.max(1, Math.round((b - a) / MS_PER_DAY) + 1);
}

export interface SplitHistoryStripProps {
  blocks: TrainingBlock[];
  className?: string;
}

/**
 * Horizontal timeline of training blocks, proportional to each block's span and
 * colored by split. A block too thin to hold its own label still shows on hover
 * via its title; the legend below names every split present.
 */
export function SplitHistoryStrip({ blocks, className }: SplitHistoryStripProps) {
  const reduce = useReducedMotion();
  const spans = blocks.map((b) => days(b.startDate, b.endDate));
  const total = spans.reduce((sum, s) => sum + s, 0) || 1;

  // Unique splits present, in first-seen order, for the legend.
  const seen = new Set<SplitCanonical>();
  const legend: SplitCanonical[] = [];
  for (const b of blocks) {
    if (!seen.has(b.splitCanonical)) {
      seen.add(b.splitCanonical);
      legend.push(b.splitCanonical);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-sm',
        className,
      )}
    >
      <div
        className="flex h-12 w-full gap-1 overflow-hidden rounded-lg"
        role="list"
        aria-label="Training blocks over time"
      >
        {blocks.map((block, i) => {
          const pct = (spans[i] / total) * 100;
          const label = SPLIT_LABELS[block.splitCanonical] ?? block.splitCanonical;
          return (
            <motion.div
              key={block.id}
              role="listitem"
              title={block.label}
              className="flex h-full min-w-1.5 items-center justify-center overflow-hidden rounded-md px-1.5"
              style={{
                flexGrow: spans[i],
                flexBasis: 0,
                backgroundColor: SPLIT_COLOR[block.splitCanonical] ?? SPLIT_COLOR.unknown,
              }}
              initial={reduce ? false : { opacity: 0, scaleX: 0.95 }}
              whileInView={reduce ? undefined : { opacity: 1, scaleX: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                duration: 0.28,
                ease: EASE_OUT,
                delay: Math.min(i, 10) * 0.04,
              }}
            >
              {pct > 12 ? (
                <span className="truncate text-xs font-semibold text-background">
                  {label}
                </span>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {legend.map((split) => (
          <span
            key={split}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SPLIT_COLOR[split] ?? SPLIT_COLOR.unknown }}
              aria-hidden
            />
            {SPLIT_LABELS[split] ?? split}
          </span>
        ))}
      </div>

      {blocks.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground tnum">
          {blocks[0].startDate.slice(0, 4)} – {blocks[blocks.length - 1].endDate.slice(0, 4)}
          {' · '}
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </p>
      ) : null}
    </div>
  );
}
