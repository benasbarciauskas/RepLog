import { epley1rm } from '@/analytics/epley';
import type { SetEntry, Workout } from '@/types/models';

/** The selectable progression metrics (Strong-style). */
export type MetricKey =
  | 'heaviest'
  | 'e1rm'
  | 'bestSetVolume'
  | 'sessionVolume'
  | 'totalReps';

export const METRICS: { key: MetricKey; label: string; short: string; unit: string }[] = [
  { key: 'heaviest', label: 'Heaviest weight', short: 'Heaviest', unit: 'kg' },
  { key: 'e1rm', label: 'Estimated 1RM', short: 'Est. 1RM', unit: 'kg' },
  { key: 'bestSetVolume', label: 'Best-set volume', short: 'Top-set vol', unit: 'kg' },
  { key: 'sessionVolume', label: 'Session volume', short: 'Session vol', unit: 'kg' },
  { key: 'totalReps', label: 'Total reps', short: 'Total reps', unit: '' },
];

/** Selectable time ranges. `null` months = all-time. */
export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'all';

export const RANGES: { key: RangeKey; label: string; months: number | null }[] = [
  { key: '1M', label: '1M', months: 1 },
  { key: '3M', label: '3M', months: 3 },
  { key: '6M', label: '6M', months: 6 },
  { key: '1Y', label: '1Y', months: 12 },
  { key: 'all', label: 'All', months: null },
];

/** One session's working sets for a single exercise, with PR-aware metadata. */
export interface SessionSet {
  weightKg: number | null;
  reps: number;
  rpe?: number | null;
  isWarmup: boolean;
}

export interface SessionHistoryRow {
  workoutId: string;
  date: string;
  sets: SessionSet[];
  /** Convenience metric values for the session (working sets only). */
  topSetKg: number; // heaviest working set; 0 if none loaded
  sessionVolumeKg: number;
  totalReps: number;
}

/** Round a kg-ish number to 1dp for stable display/series. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * One value per session for the chosen metric, chronological. Warm-ups excluded
 * everywhere. Sessions that produce no value for the metric are skipped (e.g. a
 * bodyweight-only session has no heaviest weight). `totalReps` counts every
 * working set's reps regardless of load, so bodyweight sessions still chart.
 */
export function metricSeries(
  workouts: Workout[],
  exerciseId: string,
  metric: MetricKey,
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];

  for (const w of workouts) {
    const working = collectWorkingSets(w, exerciseId);
    if (working.length === 0) continue;

    const loaded = working.filter((s) => s.weightKg != null) as (SessionSet & {
      weightKg: number;
    })[];

    let value: number | null = null;
    switch (metric) {
      case 'heaviest': {
        if (loaded.length === 0) break;
        value = Math.max(...loaded.map((s) => s.weightKg));
        break;
      }
      case 'e1rm': {
        if (loaded.length === 0) break;
        value = Math.max(...loaded.map((s) => epley1rm(s.weightKg, s.reps)));
        break;
      }
      case 'bestSetVolume': {
        // The top set by weight × reps that session.
        if (loaded.length === 0) break;
        value = Math.max(...loaded.map((s) => s.weightKg * s.reps));
        break;
      }
      case 'sessionVolume': {
        if (loaded.length === 0) break;
        value = loaded.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
        break;
      }
      case 'totalReps': {
        value = working.reduce((sum, s) => sum + s.reps, 0);
        break;
      }
    }

    if (value != null && value > 0) {
      out.push({ date: w.date, value: metric === 'totalReps' ? value : r1(value) });
    }
  }

  // Chronological (workouts hook is date-ascending already, but be defensive).
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Collect this exercise's working (non-warmup) sets across one workout. */
function collectWorkingSets(workout: Workout, exerciseId: string): SessionSet[] {
  const sets: SessionSet[] = [];
  for (const ex of workout.exercises) {
    if (ex.exerciseId !== exerciseId) continue;
    for (const s of ex.sets) {
      if (s.isWarmup) continue;
      sets.push(toSessionSet(s));
    }
  }
  return sets;
}

function toSessionSet(s: SetEntry): SessionSet {
  return {
    weightKg: s.weightKg,
    reps: s.reps,
    rpe: s.rpe ?? null,
    isWarmup: Boolean(s.isWarmup),
  };
}

/**
 * Per-session set history for an exercise, newest first. Includes ALL sets
 * (warm-ups marked) so the user sees the full session, but the summary metrics
 * count working sets only.
 */
export function sessionHistory(
  workouts: Workout[],
  exerciseId: string,
): SessionHistoryRow[] {
  const rows: SessionHistoryRow[] = [];

  for (const w of workouts) {
    const allSets: SessionSet[] = [];
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) allSets.push(toSessionSet(s));
    }
    if (allSets.length === 0) continue;

    const working = allSets.filter((s) => !s.isWarmup);
    const loaded = working.filter((s) => s.weightKg != null) as (SessionSet & {
      weightKg: number;
    })[];

    rows.push({
      workoutId: w.id,
      date: w.date,
      sets: allSets,
      topSetKg: loaded.length ? r1(Math.max(...loaded.map((s) => s.weightKg))) : 0,
      sessionVolumeKg: r1(loaded.reduce((sum, s) => sum + s.weightKg * s.reps, 0)),
      totalReps: working.reduce((sum, s) => sum + s.reps, 0),
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Filter date-keyed rows to the chosen time range. `months: null` (all) returns
 * the input unchanged. The cutoff is `now - months`, computed from the latest
 * data point so the range is meaningful even for historical/imported datasets
 * (an "All" import from 2023 still shows something under "3M" relative to its
 * own most-recent session). Pure + deterministic given `latestDate`.
 */
export function filterByRange<T extends { date: string }>(
  rows: T[],
  months: number | null,
  latestDate?: string,
): T[] {
  if (months == null || rows.length === 0) return rows;
  const anchor = latestDate ?? rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const cutoff = subtractMonths(anchor, months);
  return rows.filter((r) => r.date >= cutoff);
}

/** ISO 'yyyy-mm-dd' minus N months, returned as 'yyyy-mm-dd'. */
function subtractMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() - months);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
