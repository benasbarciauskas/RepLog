import { useEffect, useRef, useState } from 'react';
import { restRemainingSeconds } from './lib';

/**
 * Drives a 1Hz countdown from a persisted deadline timestamp (epoch ms).
 *
 * The deadline is the single source of truth and lives in the active session,
 * so a refresh/relaunch resumes the timer exactly — this hook only derives the
 * *display* seconds from it. Returns the remaining whole seconds (0 when no
 * deadline or already elapsed), plus an `isRunning` flag.
 *
 * It ticks via setInterval but recomputes from `Date.now()` each tick (not a
 * decrementing counter) so it stays accurate even if the tab was throttled.
 */
export function useRestTimer(deadlineMs: number | null): {
  remaining: number;
  isRunning: boolean;
} {
  const [remaining, setRemaining] = useState(() =>
    deadlineMs == null ? 0 : restRemainingSeconds(deadlineMs, Date.now()),
  );

  useEffect(() => {
    if (deadlineMs == null) {
      setRemaining(0);
      return;
    }
    // Sync immediately, then tick.
    setRemaining(restRemainingSeconds(deadlineMs, Date.now()));
    const id = window.setInterval(() => {
      setRemaining(restRemainingSeconds(deadlineMs, Date.now()));
    }, 250); // sub-second poll keeps the clock honest after throttling
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  return { remaining, isRunning: deadlineMs != null && remaining > 0 };
}

/**
 * A 1Hz "now" tick for elapsed-time displays that read from a start timestamp.
 * Returns the current epoch ms, refreshed every second.
 */
export function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef(now);
  ref.current = now;
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}
