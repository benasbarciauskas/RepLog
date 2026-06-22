import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
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

/**
 * All-time bests derived from the live workout set.
 * Stubbed to [] — `computeBests()` (analytics) lands in Wave 1; wired in Wave 2.
 */
export function useBests(): ExerciseBest[] {
  const workouts = useWorkouts();
  // wired in Wave 2: return computeBests(workouts);
  void workouts;
  return [];
}

/**
 * Strength-imbalance coach findings, ordered priority → flag → ok.
 * Stubbed to [] — `analyzeImbalances()` (coach) lands in Wave 1; wired in Wave 2.
 */
export function useCoachFindings(): CoachFinding[] {
  const bests = useBests();
  // wired in Wave 2: return analyzeImbalances(bests);
  void bests;
  return [];
}

/**
 * Inferred training blocks (contiguous same-split sessions).
 * Stubbed to [] — `inferBlocks()` (analytics) lands in Wave 1; wired in Wave 2.
 */
export function useBlocks(): TrainingBlock[] {
  const workouts = useWorkouts();
  // wired in Wave 2: return inferBlocks(workouts);
  void workouts;
  return [];
}
