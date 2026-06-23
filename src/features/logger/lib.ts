import type {
  ActiveExercise,
  ActiveSession,
  ActiveSet,
  AppSettings,
  ExerciseDef,
  ProgramDay,
  Routine,
  Unit,
  Workout,
} from '@/types/models';
import { newId } from '@/lib/id';
import { formatWeight } from '@/lib/units';
import {
  incrementForExercise,
  suggestNextSet,
  type SetSuggestion,
} from '@/program/progression';

// ---------------------------------------------------------------------------
// Plate calculator (pure)
// ---------------------------------------------------------------------------

/** One stack entry: a plate denomination and how many go on EACH side. */
export interface PlateStack {
  plate: number;
  count: number;
}

/**
 * Greedy largest-first plate fill for ONE side of the bar.
 *
 * Given a target total weight (kg, both sides + bar), the bar weight, and the
 * available plate denominations, returns the plates to load per side, largest
 * first. The bar is centred so each side carries `(total - bar) / 2`.
 *
 * Greedy is optimal for the standard "infinite supply of each denomination"
 * gym case. When the per-side load can't be matched exactly with the available
 * plates, the closest reachable stack is returned and the shortfall is exposed
 * via `platesRemainder()`.
 *
 * Examples (20kg bar, standard plates):
 *  - 100kg → per side 40 → [{25,1},{15,1}]  (or 2×20 if 25s absent)
 *  - 60kg  → per side 20 → [{20,1}]
 *  - below the bar → [] (nothing to load)
 */
export function platesForWeight(
  totalKg: number,
  barKg: number,
  availablePlatesKg: number[],
): PlateStack[] {
  const perSide = (totalKg - barKg) / 2;
  if (!Number.isFinite(perSide) || perSide <= 0) return [];

  // Largest first; ignore non-positive denominations.
  const plates = [...new Set(availablePlatesKg)]
    .filter((p) => p > 0)
    .sort((a, b) => b - a);

  const stacks: PlateStack[] = [];
  // Work in integer grams to dodge float drift (e.g. 1.25 + 2.5 sums).
  let remainingG = Math.round(perSide * 1000);
  for (const plate of plates) {
    const plateG = Math.round(plate * 1000);
    if (plateG <= 0) continue;
    const count = Math.floor(remainingG / plateG);
    if (count > 0) {
      stacks.push({ plate, count });
      remainingG -= count * plateG;
    }
  }
  return stacks;
}

/**
 * The portion of the per-side target that the available plates can't cover, in
 * kg (0 when the weight is reachable exactly, or when below/at the bar).
 */
export function platesRemainder(
  totalKg: number,
  barKg: number,
  availablePlatesKg: number[],
): number {
  const perSide = (totalKg - barKg) / 2;
  if (!Number.isFinite(perSide) || perSide <= 0) return 0;
  const stacks = platesForWeight(totalKg, barKg, availablePlatesKg);
  const loadedG = stacks.reduce(
    (sum, s) => sum + Math.round(s.plate * 1000) * s.count,
    0,
  );
  const remainderG = Math.round(perSide * 1000) - loadedG;
  return remainderG <= 0 ? 0 : remainderG / 1000;
}

// ---------------------------------------------------------------------------
// Rest timer (pure)
// ---------------------------------------------------------------------------

/**
 * Remaining seconds until a rest-timer deadline, clamped at 0. The deadline is
 * an epoch-ms timestamp persisted in the session so a refresh resumes the timer
 * exactly. Returns a whole-second count (rounded up so the last tick shows 1,
 * not 0, until the deadline truly passes).
 */
export function restRemainingSeconds(deadlineMs: number, nowMs: number): number {
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

/** A fresh rest deadline: now + the given duration in seconds. */
export function restDeadlineFrom(nowMs: number, seconds: number): number {
  return nowMs + Math.max(0, seconds) * 1000;
}

/**
 * Shift an existing deadline by `deltaSeconds` (±15s buttons). The result is
 * never pulled earlier than `nowMs` (so −15s near the end just ends it).
 */
export function adjustRestDeadline(
  deadlineMs: number,
  deltaSeconds: number,
  nowMs: number,
): number {
  return Math.max(nowMs, deadlineMs + deltaSeconds * 1000);
}

/** Format a remaining-seconds count as `m:ss`. */
export function formatRestClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Format the elapsed workout time (seconds) as `m:ss` or `h:mm:ss`. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// "Previous" set lookup (pure)
// ---------------------------------------------------------------------------

export interface PreviousSet {
  weightKg: number | null;
  reps: number;
}

/**
 * For a given exerciseId, find the working sets it was logged with the LAST
 * time it appeared in a saved workout. Used to render the greyed "previous"
 * column per set row (matched by working-set index). Warm-ups are excluded so
 * the indexes line up with the live working sets.
 *
 * `workouts` is expected newest-last (the `useWorkouts()` ordering), but we
 * sort defensively by date so callers can't break the contract.
 */
export function previousSetsFor(
  workouts: Workout[],
  exerciseId: string,
): PreviousSet[] {
  const withExercise = workouts
    .filter((w) => w.exercises.some((ex) => ex.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = withExercise[withExercise.length - 1];
  if (!last) return [];

  const ex = last.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return [];

  return ex.sets
    .filter((s) => !s.isWarmup)
    .map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
}

// ---------------------------------------------------------------------------
// Session / routine builders (pure)
// ---------------------------------------------------------------------------

/** A single empty, not-done set row. */
export function makeEmptySet(): ActiveSet {
  return { id: newId(), weightKg: null, reps: null, rpe: null, isWarmup: false, done: false };
}

/** A fresh, empty active session (blank workout). */
export function makeEmptySession(): ActiveSession {
  return {
    id: newId(),
    startedAt: new Date().toISOString(),
    routineId: null,
    bodyweightKg: null,
    splitCanonical: undefined,
    exercises: [],
  };
}

/** Build an `ActiveExercise` for a freshly added exercise (one empty set). */
export function makeActiveExercise(
  exerciseId: string,
  rawName: string,
  opts: { restSeconds?: number; sets?: number } = {},
): ActiveExercise {
  const setCount = Math.max(1, opts.sets ?? 1);
  return {
    id: newId(),
    exerciseId,
    rawName,
    unit: 'kg',
    restSeconds: opts.restSeconds,
    sets: Array.from({ length: setCount }, () => makeEmptySet()),
  };
}

/**
 * Seed an `ActiveSession` from a routine: one exercise per routine entry, each
 * with `targetSets` empty set rows (min 1) and the routine's `restSeconds`
 * carried over. `routineId` is stamped so the session knows its origin.
 */
/**
 * Seed an `ActiveSession` from a program day: one exercise per entry, each with
 * `targetSets` empty set rows and the day's `restSeconds` carried over.
 */
export function sessionFromProgramDay(day: ProgramDay): ActiveSession {
  return {
    id: newId(),
    startedAt: new Date().toISOString(),
    routineId: null,
    bodyweightKg: null,
    splitCanonical: day.splitCanonical,
    exercises: day.exercises.map((e) =>
      makeActiveExercise(e.exerciseId, e.rawName, {
        restSeconds: e.restSeconds,
        sets: e.targetSets,
      }),
    ),
  };
}

function seededSetsFromSuggestion(
  targetSets: number,
  suggestion: SetSuggestion | null,
  fallbackReps: number,
): ActiveSet[] {
  return Array.from({ length: targetSets }, () => {
    const set = makeEmptySet();
    if (suggestion) {
      set.weightKg = suggestion.weightKg;
      set.reps = suggestion.reps;
    } else {
      set.reps = fallbackReps;
    }
    return set;
  });
}

/**
 * Seed an `ActiveSession` from a program day with double-progression suggestions
 * pre-filled on each set row (weight + reps when history exists).
 */
export function sessionFromProgramDayWithProgression(
  day: ProgramDay,
  pastWorkouts: Workout[],
  settings: AppSettings,
  catalog: ExerciseDef[],
): ActiveSession {
  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  return {
    id: newId(),
    startedAt: new Date().toISOString(),
    routineId: null,
    bodyweightKg: null,
    splitCanonical: day.splitCanonical,
    exercises: day.exercises.map((e) => {
      const def = catalogById.get(e.exerciseId);
      const suggestion = suggestNextSet(pastWorkouts, e.exerciseId, {
        repRange: e.repRange,
        rir: e.rir,
        incrementKg: incrementForExercise(def, settings),
      });

      return {
        id: newId(),
        exerciseId: e.exerciseId,
        rawName: e.rawName,
        unit: settings.unit,
        restSeconds: e.restSeconds,
        sets: seededSetsFromSuggestion(e.targetSets, suggestion, e.repRange[0]),
      };
    }),
  };
}

/** Format a progression suggestion for program-day preview ("100 kg × 8" or "× 12"). */
export function formatNextSetSuggestion(
  suggestion: SetSuggestion | null,
  repRange: [number, number],
  unit: Unit,
): string {
  if (!suggestion) return `× ${repRange[0]}`;
  if (suggestion.weightKg === null) return `× ${suggestion.reps}`;
  return `${formatWeight(suggestion.weightKg, unit)} × ${suggestion.reps}`;
}

export function sessionFromRoutine(routine: Routine): ActiveSession {
  return {
    id: newId(),
    startedAt: new Date().toISOString(),
    routineId: routine.id,
    bodyweightKg: null,
    splitCanonical: undefined,
    exercises: routine.exercises.map((e) =>
      makeActiveExercise(e.exerciseId, e.rawName, {
        restSeconds: e.restSeconds,
        sets: e.targetSets,
      }),
    ),
  };
}

/**
 * Derive a `Routine` from a live session: each exercise becomes a routine entry
 * with `targetSets` = its set count and `targetReps` = the modal (most common)
 * reps across its sets. `restSeconds` carries over per exercise.
 */
export function routineFromSession(session: ActiveSession, name: string): Routine {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name.trim() || 'Routine',
    createdAt: now,
    updatedAt: now,
    exercises: session.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      rawName: ex.rawName,
      targetSets: Math.max(1, ex.sets.length),
      targetReps: modalReps(ex.sets),
      restSeconds: ex.restSeconds,
    })),
  };
}

/** Most-common reps value across a set list (ignores nulls). `undefined` if none. */
function modalReps(sets: ActiveSet[]): number | undefined {
  const counts = new Map<number, number>();
  for (const s of sets) {
    if (s.reps == null) continue;
    counts.set(s.reps, (counts.get(s.reps) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [reps, count] of counts) {
    if (count > bestCount) {
      best = reps;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Session summary (pure) — drives the finish dialog & "done" counts
// ---------------------------------------------------------------------------

export interface SessionSummary {
  /** Exercises that have ≥1 done set (i.e. what will actually be saved). */
  exercises: number;
  /** Count of done, non-warm-up sets. */
  workingSets: number;
  /** Count of done warm-up sets. */
  warmupSets: number;
  /** Σ weightKg×reps over done, non-warm-up sets (kg). */
  totalVolumeKg: number;
}

export function summarizeSession(session: ActiveSession): SessionSummary {
  let exercises = 0;
  let workingSets = 0;
  let warmupSets = 0;
  let totalVolumeKg = 0;

  for (const ex of session.exercises) {
    const doneSets = ex.sets.filter((s) => s.done);
    if (doneSets.length === 0) continue;
    exercises += 1;
    for (const s of doneSets) {
      if (s.isWarmup) {
        warmupSets += 1;
      } else {
        workingSets += 1;
        totalVolumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
  }

  return { exercises, workingSets, warmupSets, totalVolumeKg };
}

/** Working-set number for a set at `index` within an exercise (warm-ups skip). */
export function workingSetNumber(sets: ActiveSet[], index: number): number | null {
  if (sets[index]?.isWarmup) return null;
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (!sets[i].isWarmup) n += 1;
  }
  return n;
}
