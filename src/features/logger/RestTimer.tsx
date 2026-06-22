import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Minus, Plus, Timer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRestClock, restRemainingSeconds } from './lib';
import { useRestTimer } from './useRestTimer';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export interface RestTimerProps {
  /** Persisted deadline (epoch ms) — null = no timer running. */
  deadlineMs: number | null;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  /** Fired once when the countdown reaches zero (gentle completion cue hook). */
  onComplete?: () => void;
}

/**
 * Sticky rest-timer bar shown while a rest countdown is running. The countdown
 * derives from the persisted deadline, so it survives a refresh. ±15s / skip
 * controls; a thin progress track drains as time elapses.
 */
export function RestTimer({ deadlineMs, onAdjust, onSkip, onComplete }: RestTimerProps) {
  const reduce = useReducedMotion();
  const { remaining, isRunning } = useRestTimer(deadlineMs);
  const firedRef = useRef(false);
  const totalRef = useRef<number>(0);

  // Capture the full duration when a new deadline starts, for the progress bar.
  useEffect(() => {
    if (deadlineMs != null) {
      totalRef.current = Math.max(1, restRemainingSeconds(deadlineMs, Date.now()));
      firedRef.current = false;
    }
  }, [deadlineMs]);

  // Gentle completion cue — fire once when we hit zero.
  useEffect(() => {
    if (deadlineMs != null && remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onComplete?.();
    }
  }, [remaining, deadlineMs, onComplete]);

  if (!isRunning) return null;

  const pct = totalRef.current > 0 ? Math.max(0, Math.min(100, (remaining / totalRef.current) * 100)) : 0;
  const nearDone = remaining <= 10;

  return (
    <motion.div
      role="timer"
      aria-label="Rest timer"
      initial={reduce ? false : { y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      className={cn(
        // Sit above the mobile bottom nav (which the shell offsets via pb-24).
        'fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-4 sm:bottom-6',
      )}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated/95 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              nearDone ? 'bg-highlight-muted text-highlight' : 'bg-surface text-muted-foreground',
            )}
          >
            <Timer className="size-4" strokeWidth={1.75} aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Rest</p>
            <p
              className={cn(
                'tnum text-2xl font-semibold leading-none',
                nearDone ? 'text-highlight' : 'text-foreground',
              )}
            >
              {formatRestClock(remaining)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAdjust(-15)}
              aria-label="Subtract 15 seconds"
            >
              <Minus className="size-3.5" strokeWidth={2} />
              15
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAdjust(15)}
              aria-label="Add 15 seconds"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              15
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onSkip} aria-label="Skip rest">
              <X className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        {/* Draining progress track. */}
        <div className="h-1 w-full bg-border">
          <div
            className="h-full bg-highlight transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
