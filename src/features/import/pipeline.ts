import {
  createCatalog,
  isWorkoutRelated,
  parseNotes,
  segmentWorkouts,
  type ExerciseCatalog,
} from '@/parser';
import type { ExerciseDef, ParsedWorkout } from '@/types/models';

export interface IngestResult {
  /** Workouts from segments that passed the relevance filter. */
  workouts: ParsedWorkout[];
  /** Raw text of segments dropped as unrelated. */
  skipped: string[];
  /** Parser warnings across the kept segments. */
  warnings: string[];
}

/**
 * The shared ingest pipeline for ALL import modes (screenshots, paste, video).
 *
 * 1. Segment the corpus into per-note chunks.
 * 2. Drop chunks that aren't workout-related (relevance filter, spec A2) and
 *    count them for the Review screen's "N unrelated notes skipped" peek.
 * 3. Parse the kept chunks into candidate workouts, collecting warnings.
 *
 * Pure + framework-free so it can be unit-tested and reused. A catalog is built
 * once from the user's custom exercises and threaded through.
 */
export function ingestCorpus(
  corpus: string,
  customExercises: ExerciseDef[] = [],
): IngestResult {
  const catalog: ExerciseCatalog = createCatalog(customExercises);

  const segments = segmentWorkouts(corpus);
  const kept: string[] = [];
  const skipped: string[] = [];

  for (const segment of segments) {
    if (isWorkoutRelated(segment, catalog)) kept.push(segment);
    else skipped.push(segment);
  }

  const workouts: ParsedWorkout[] = [];
  const warnings: string[] = [];

  for (const segment of kept) {
    const result = parseNotes(segment, catalog);
    workouts.push(...result.workouts);
    warnings.push(...result.warnings);
  }

  return { workouts, skipped, warnings };
}
