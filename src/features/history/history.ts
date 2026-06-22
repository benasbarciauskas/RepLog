import type { SplitCanonical, Workout } from '@/types/models';
import { workoutVolumeKg } from '@/features/dashboard/stats';

/** Short readable split name (mirrors the dashboard split labels). */
export const SPLIT_LABELS: Record<SplitCanonical, string> = {
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

export interface HistoryRow {
  id: string;
  date: string;
  splitLabel: string;
  splitCanonical: SplitCanonical;
  exerciseCount: number;
  /** Working-set count (warm-ups excluded). */
  setCount: number;
  volumeKg: number;
}

export interface HistoryMonth {
  /** 'yyyy-mm' key, used for stable React keys + sort. */
  key: string;
  /** Human label, e.g. "July 2023". */
  label: string;
  rows: HistoryRow[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Working (non-warmup) set count for a workout. */
function workingSetCount(workout: Workout): number {
  let n = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) if (!s.isWarmup) n += 1;
  }
  return n;
}

/** Build the flat, newest-first list of history rows. */
export function historyRows(workouts: Workout[]): HistoryRow[] {
  return [...workouts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((w) => ({
      id: w.id,
      date: w.date,
      splitLabel: SPLIT_LABELS[w.splitCanonical] ?? w.splitCanonical,
      splitCanonical: w.splitCanonical,
      exerciseCount: w.exercises.length,
      setCount: workingSetCount(w),
      volumeKg: Math.round(workoutVolumeKg(w) * 10) / 10,
    }));
}

/**
 * Group the history rows by calendar month, newest month first, rows newest
 * first within each month.
 */
export function groupByMonth(workouts: Workout[]): HistoryMonth[] {
  const rows = historyRows(workouts);
  const byKey = new Map<string, HistoryRow[]>();

  for (const row of rows) {
    const key = row.date.slice(0, 7); // 'yyyy-mm'
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }

  return [...byKey.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, monthRows]) => {
      const [y, m] = key.split('-').map(Number);
      return {
        key,
        label: `${MONTHS[m - 1] ?? m} ${y}`,
        rows: monthRows,
      };
    });
}
