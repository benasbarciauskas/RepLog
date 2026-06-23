import type { ExerciseDef, MuscleGroup, Workout } from '@/types/models';

/** Every MuscleGroup, so a volume report always covers the full body map. */
const ALL_MUSCLES: MuscleGroup[] = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'lats',
  'traps',
  'upper-back',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'lower-back',
];

/**
 * Weekly-volume landmarks (working sets per muscle per week):
 * - below MEV (`UNDER_MAX`) reads as undertrained,
 * - inside [MEV, MRV] reads as optimal,
 * - above MRV reads as high (recovery risk).
 *
 * ponytail: these 8 / 20 landmarks are fixed and intentionally global — they come
 * from Schoenfeld 2017's dose-response review + Israetel's MEV/MAV/MRV framework,
 * which are per-muscle ranges in the literature. A later version could make them
 * per-muscle and/or user-configurable without changing this module's contract.
 */
const UNDER_MAX = 8; // below this (exclusive) → under
const OPTIMAL_MAX = 20; // up to and including this → optimal; above → high

export type VolumeStatus = 'never' | 'under' | 'optimal' | 'high';

export interface MuscleVolume {
  muscle: MuscleGroup;
  /** Window total / weeks, fractional. */
  setsPerWeek: number;
  /** Fractional working sets in the window. */
  totalSets: number;
  status: VolumeStatus;
}

export interface VolumeReport {
  /** Window actually used, in weeks (always >= 1). */
  weeks: number;
  /** Most-recent in-range workout date, or null when there are no workouts. */
  anchorDate: string | null;
  /** All 16 MuscleGroups, sorted descending by setsPerWeek. */
  muscles: MuscleVolume[];
}

/**
 * Map each exercise def's id to the muscles it works. Passing the full catalog
 * (`createCatalog(custom).all()`) through this is what lets custom (user-defined)
 * exercises contribute volume alongside the built-ins.
 */
export function buildMuscleLookup(
  defs: ExerciseDef[],
): Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }> {
  const map = new Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }>();
  for (const def of defs) {
    map.set(def.id, { primary: def.primaryMuscles, secondary: def.secondaryMuscles });
  }
  return map;
}

/** Classify a weekly set count into a volume status. */
function classify(setsPerWeek: number): VolumeStatus {
  if (setsPerWeek === 0) return 'never';
  if (setsPerWeek < UNDER_MAX) return 'under';
  if (setsPerWeek <= OPTIMAL_MAX) return 'optimal';
  return 'high';
}

/**
 * Shift an ISO `yyyy-mm-dd` date by a whole number of days, returning ISO. Uses
 * UTC so it's deterministic regardless of the host timezone; never reads the
 * clock (no `Date.now()`).
 */
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Weekly working-sets-per-muscle over a trailing window (spec: Volume Coach).
 *
 * Window = the last `weeks` calendar weeks, i.e. dates in the inclusive range
 * `[anchor - (weeks * 7 - 1) days, anchor]`. `anchor` defaults to the MAX workout
 * `date` across all workouts; with no workouts the window is empty, `anchorDate`
 * is null and every muscle is `never`. `weeks` is clamped to >= 1.
 *
 * Each in-window working set (non-warmup) credits its exercise's primary muscles
 * 1.0 and secondary muscles 0.5. Exercises absent from `lookup` contribute nothing.
 * `setsPerWeek = totalSets / weeks`. Pure and deterministic — same inputs, same
 * output; never calls `Date.now()`.
 */
export function weeklyMuscleVolume(
  workouts: Workout[],
  lookup: Map<string, { primary: MuscleGroup[]; secondary: MuscleGroup[] }>,
  opts?: { weeks?: number; anchor?: string },
): VolumeReport {
  const weeks = Math.max(1, Math.trunc(opts?.weeks ?? 4));

  // Anchor = explicit opt, else the latest workout date, else null (no workouts).
  let anchor: string | null = opts?.anchor ?? null;
  if (anchor == null) {
    for (const w of workouts) {
      if (anchor == null || w.date > anchor) anchor = w.date;
    }
  }

  const totals = new Map<MuscleGroup, number>();
  for (const m of ALL_MUSCLES) totals.set(m, 0);

  if (anchor != null) {
    const start = shiftDate(anchor, -(weeks * 7 - 1));
    for (const w of workouts) {
      if (w.date < start || w.date > anchor) continue; // outside the window
      for (const exercise of w.exercises) {
        const muscles = lookup.get(exercise.exerciseId);
        if (!muscles) continue; // uncatalogued → contributes nothing
        const workingSets = exercise.sets.filter((s) => !s.isWarmup).length;
        if (workingSets === 0) continue;
        for (const m of muscles.primary) {
          totals.set(m, (totals.get(m) ?? 0) + workingSets);
        }
        for (const m of muscles.secondary) {
          totals.set(m, (totals.get(m) ?? 0) + workingSets * 0.5);
        }
      }
    }
  }

  const muscles: MuscleVolume[] = ALL_MUSCLES.map((muscle) => {
    const totalSets = totals.get(muscle) ?? 0;
    const setsPerWeek = totalSets / weeks;
    return { muscle, setsPerWeek, totalSets, status: classify(setsPerWeek) };
  });

  muscles.sort((a, b) => b.setsPerWeek - a.setsPerWeek);

  return { weeks, anchorDate: anchor, muscles };
}
