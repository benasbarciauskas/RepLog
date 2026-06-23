import type {
  AppSettings,
  ExerciseDef,
  MovementPattern,
  SetEntry,
  Workout,
} from '@/types/models';

export interface ProgressionTarget {
  repRange: [number, number];
  rir: number;
  incrementKg: number;
}

export interface SetSuggestion {
  weightKg: number | null;
  reps: number;
}

const LOWER_BODY_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  'squat',
  'hinge',
  'lunge',
]);

/** Round loaded weight to the nearest 0.5 kg step. */
function roundWeightKg(kg: number): number {
  return Math.round(kg * 2) / 2;
}

function compareWorkingSets(a: SetEntry, b: SetEntry): number {
  const wA = a.weightKg;
  const wB = b.weightKg;
  if (wA !== wB) {
    if (wA === null) return -1;
    if (wB === null) return 1;
    return wA - wB;
  }
  return a.reps - b.reps;
}

function topWorkingSet(sets: SetEntry[]): SetEntry | null {
  const working = sets.filter((s) => !s.isWarmup);
  if (working.length === 0) return null;
  return working.reduce((best, s) => (compareWorkingSets(s, best) > 0 ? s : best));
}

function mostRecentWorkoutWithExercise(
  pastWorkouts: Workout[],
  exerciseId: string,
): Workout | null {
  const matching = pastWorkouts
    .filter((w) => w.exercises.some((ex) => ex.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return matching[matching.length - 1] ?? null;
}

/**
 * Double-progression suggestion for the next working set.
 * Returns `null` when there is no prior history for the exercise.
 */
export function suggestNextSet(
  pastWorkouts: Workout[],
  exerciseId: string,
  target: ProgressionTarget,
): SetSuggestion | null {
  const workout = mostRecentWorkoutWithExercise(pastWorkouts, exerciseId);
  if (!workout) return null;

  const exercise = workout.exercises.find((ex) => ex.exerciseId === exerciseId);
  if (!exercise) return null;

  const top = topWorkingSet(exercise.sets);
  if (!top) return null;

  const lastWeight = top.weightKg;
  const lastReps = top.reps;
  const [, maxReps] = target.repRange;

  if (lastWeight === null) {
    return {
      weightKg: null,
      reps: Math.min(lastReps + 1, maxReps),
    };
  }

  if (lastReps >= maxReps) {
    return {
      weightKg: roundWeightKg(lastWeight + target.incrementKg),
      reps: target.repRange[0],
    };
  }

  return {
    weightKg: lastWeight,
    reps: Math.min(lastReps + 1, maxReps),
  };
}

/**
 * Default weight increment for double progression.
 * Lower-body compounds (squat / hinge / lunge) use 5 kg; everything else 2.5 kg.
 * Clamped to at least `min(availablePlatesKg) * 2` when that exceeds the default.
 */
export function incrementForExercise(
  def: ExerciseDef | undefined,
  settings: AppSettings,
): number {
  const defaultInc =
    def && LOWER_BODY_PATTERNS.has(def.pattern) ? 5 : 2.5;

  const positivePlates = settings.availablePlatesKg.filter((p) => p > 0);
  if (positivePlates.length === 0) return defaultInc;

  const minPlate = Math.min(...positivePlates);
  const plateFloor = minPlate * 2;
  return plateFloor > defaultInc ? plateFloor : defaultInc;
}