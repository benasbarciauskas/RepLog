import { useLiveQuery } from 'dexie-react-hooks';
import { ACTIVE_SESSION_KEY, db, SETTINGS_KEY } from './db';
import { DEFAULT_SETTINGS, stripSettingsKey } from './repository';
import { computeBests } from '@/analytics/bests';
import { inferBlocks } from '@/analytics/blocks';
import { bodyweightSeries } from '@/analytics/bodyweight';
import { analyzeImbalances } from '@/coach/analyze';
import type {
  ActiveSession,
  AppSettings,
  CoachFinding,
  ExerciseBest,
  RawNote,
  Routine,
  TrainingBlock,
  Workout,
} from '@/types/models';

/** Live list of all stored workouts, ordered by date ascending. */
export function useWorkouts(): Workout[] {
  return useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], []);
}

/** Live count of stored workouts. `undefined` until the query resolves — lets
 *  callers tell "still loading" apart from "genuinely empty". */
export function useWorkoutCount(): number | undefined {
  return useLiveQuery(() => db.workouts.count());
}

/** Live list of all imported raw notes, newest first. */
export function useNotes(): RawNote[] {
  return useLiveQuery(
    () => db.notes.orderBy('importedAt').reverse().toArray(),
    [],
    [],
  );
}

/** All-time bests derived live from the stored workouts. Recomputes on DB change. */
export function useBests(): ExerciseBest[] {
  return useLiveQuery(async () => computeBests(await db.workouts.toArray()), [], []);
}

/** Strength-imbalance coach findings (priority → flag → ok), live from the data. */
export function useCoachFindings(): CoachFinding[] {
  return useLiveQuery(
    async () => analyzeImbalances(computeBests(await db.workouts.toArray())),
    [],
    [],
  );
}

/** Inferred training blocks (contiguous same-split sessions), live. */
export function useBlocks(): TrainingBlock[] {
  return useLiveQuery(async () => inferBlocks(await db.workouts.toArray()), [], []);
}

/** Bodyweight-over-time series for the trend chart, live. */
export function useBodyweightSeries(): { date: string; kg: number }[] {
  return useLiveQuery(async () => bodyweightSeries(await db.workouts.toArray()), [], []);
}

// --- v1.1 live logger --------------------------------------------------------

/**
 * The in-progress workout, live. `undefined` means either "still loading" or
 * "no active session" — distinguish by treating the first resolved `undefined`
 * as no session (the third arg seeds the initial value before the query runs).
 */
export function useActiveSession(): ActiveSession | undefined {
  return useLiveQuery(() => db.activeSession.get(ACTIVE_SESSION_KEY), [], undefined);
}

/** Live list of saved routines, most-recently-updated first. */
export function useRoutines(): Routine[] {
  return useLiveQuery(
    () => db.routines.orderBy('updatedAt').reverse().toArray(),
    [],
    [],
  );
}

/** Live logger settings, falling back to defaults until/unless persisted. */
export function useSettings(): AppSettings {
  return useLiveQuery(
    async () => {
      const stored = await db.settings.get(SETTINGS_KEY);
      if (!stored) return { ...DEFAULT_SETTINGS };
      return stripSettingsKey(stored);
    },
    [],
    DEFAULT_SETTINGS,
  );
}
