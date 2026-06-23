import type { ExerciseDef, Experience, MuscleGroup, Workout } from '@/types/models';

export interface MuscleVolume {
  muscle: MuscleGroup;
  sets: number;
  status: 'under' | 'optimal' | 'high';
  mev: number;
  mav: number;
}

// ---------------------------------------------------------------------------
// Volume landmarks (working sets per muscle per week).
// MEV = minimum effective volume; MAV = maximum adaptive volume.
// ---------------------------------------------------------------------------
const DEFAULT_MEV = 8;
const DEFAULT_MAV = 18;

const EXPERIENCE_BANDS: Record<Experience, { mev: number; mav: number }> = {
  beginner: { mev: 6, mav: 12 },
  intermediate: { mev: 8, mav: 18 },
  advanced: { mev: 10, mav: 22 },
};

/** Major muscles always appear in the report so undertraining is visible at 0 sets. */
const MAJOR_MUSCLES: MuscleGroup[] = [
  'chest',
  'lats',
  'upper-back',
  'front-delts',
  'side-delts',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
];

const STATUS_ORDER: Record<MuscleVolume['status'], number> = {
  under: 0,
  optimal: 1,
  high: 2,
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function inWindow(workoutDate: string, now: Date, windowDays: number): boolean {
  const end = isoDate(now);
  const start = isoDate(subtractDays(now, windowDays - 1));
  return workoutDate >= start && workoutDate <= end;
}

function buildCatalogMap(catalog: ExerciseDef[]): Map<string, ExerciseDef> {
  return new Map(catalog.map((d) => [d.id, d]));
}

function landmarks(experience?: Experience): { mev: number; mav: number } {
  if (experience && experience in EXPERIENCE_BANDS) {
    return EXPERIENCE_BANDS[experience];
  }
  return { mev: DEFAULT_MEV, mav: DEFAULT_MAV };
}

function classifyStatus(
  sets: number,
  mev: number,
  mav: number,
): MuscleVolume['status'] {
  if (sets < mev) return 'under';
  if (sets > mav) return 'high';
  return 'optimal';
}

function isCountableExercise(exerciseId: string, def: ExerciseDef | undefined): def is ExerciseDef {
  if (exerciseId.startsWith('unknown:')) return false;
  if (!def) return false;
  if (def.category === 'cardio') return false;
  return true;
}

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Count working sets credited to each muscle over the trailing window.
 * Primary muscles receive 1.0 set per working set; secondary muscles 0.5.
 */
export function weeklyVolumeByMuscle(
  workouts: Workout[],
  catalog: ExerciseDef[],
  windowDays = 7,
  now: Date = new Date(),
): Map<MuscleGroup, number> {
  const catalogMap = buildCatalogMap(catalog);
  const totals = new Map<MuscleGroup, number>();

  for (const workout of workouts) {
    if (!inWindow(workout.date, now, windowDays)) continue;

    for (const exercise of workout.exercises) {
      const def = catalogMap.get(exercise.exerciseId);
      if (!isCountableExercise(exercise.exerciseId, def)) continue;

      const workingCount = exercise.sets.filter((s) => !s.isWarmup).length;
      if (workingCount === 0) continue;

      for (const muscle of def.primaryMuscles) {
        totals.set(muscle, (totals.get(muscle) ?? 0) + workingCount);
      }
      for (const muscle of def.secondaryMuscles) {
        totals.set(muscle, (totals.get(muscle) ?? 0) + workingCount * 0.5);
      }
    }
  }

  return totals;
}

/** Weekly volume report with MEV/MAV status per muscle. */
export function volumeReport(
  workouts: Workout[],
  catalog: ExerciseDef[],
  opts?: { windowDays?: number; experience?: Experience; now?: Date },
): MuscleVolume[] {
  const windowDays = opts?.windowDays ?? 7;
  const now = opts?.now ?? new Date();
  const { mev, mav } = landmarks(opts?.experience);

  const totals = weeklyVolumeByMuscle(workouts, catalog, windowDays, now);

  const muscles = new Set<MuscleGroup>();
  for (const [muscle, sets] of totals) {
    if (sets > 0) muscles.add(muscle);
  }
  for (const muscle of MAJOR_MUSCLES) muscles.add(muscle);

  const report: MuscleVolume[] = [...muscles].map((muscle) => {
    const sets = totals.get(muscle) ?? 0;
    return {
      muscle,
      sets,
      status: classifyStatus(sets, mev, mav),
      mev,
      mav,
    };
  });

  report.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.muscle.localeCompare(b.muscle);
  });

  return report;
}

/** Actionable volume recommendations, highest priority first. */
export function volumeRecommendations(report: MuscleVolume[]): string[] {
  const recs: { priority: number; text: string }[] = [];

  for (const row of report) {
    if (row.status === 'under') {
      const deficit = Math.ceil(row.mev - row.sets);
      recs.push({
        priority: deficit,
        text: `Add ${deficit} sets of ${humanMuscle(row.muscle)} this week`,
      });
    } else if (row.status === 'high') {
      recs.push({
        priority: row.sets - row.mav,
        text: `Consider trimming ${humanMuscle(row.muscle)} volume`,
      });
    }
  }

  recs.sort((a, b) => b.priority - a.priority);
  return recs.map((r) => r.text);
}

/** Count workouts whose date falls inside the trailing volume window. */
export function workoutsInVolumeWindow(
  workouts: Workout[],
  windowDays = 7,
  now: Date = new Date(),
): number {
  return workouts.filter((w) => inWindow(w.date, now, windowDays)).length;
}