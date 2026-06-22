import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { computeBests } from '@/analytics/bests';
import { inferBlocks } from '@/analytics/blocks';
import { bodyweightSeries } from '@/analytics/bodyweight';
import { analyzeImbalances } from '@/coach/analyze';
import type {
  CoachFinding,
  ExerciseBest,
  RawNote,
  TrainingBlock,
  Workout,
} from '@/types/models';

/** Live list of all stored workouts, ordered by date ascending. */
export function useWorkouts(): Workout[] {
  return useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], []);
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
