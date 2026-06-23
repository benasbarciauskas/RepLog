import type { ExerciseBest, RepPR, Workout } from '@/types/models';
import { epley1rm } from './epley';

/**
 * Compute all-time bests per exerciseId across a set of workouts.
 *
 * Rules:
 *  - Warmup-flagged sets (`isWarmup`) are excluded from every PR calculation.
 *  - Sets with `weightKg === null` are bodyweight: they contribute to repPRs
 *    (recorded at weightKg 0, no external load) but never to maxWeightKg or
 *    bestE1rmKg.
 *  - maxWeightKg / maxWeightDate: the heaviest single working set.
 *  - bestE1rmKg / bestE1rmDate: the highest Epley estimate over working sets —
 *    may come from a different set than the max weight.
 *  - repPRs: best (heaviest) weight per rep count, with the date it was hit.
 */
export function computeBests(workouts: Workout[]): ExerciseBest[] {
  const byExercise = new Map<
    string,
    {
      maxWeightKg: number | null;
      maxWeightDate: string | null;
      bestE1rmKg: number | null;
      bestE1rmDate: string | null;
      // reps -> best weight + date for that rep count
      repPRs: Map<number, { weightKg: number; date: string }>;
    }
  >();

  // Process in chronological order so that ties favour the earlier date.
  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (const workout of ordered) {
    for (const exercise of workout.exercises) {
      let acc = byExercise.get(exercise.exerciseId);
      if (!acc) {
        acc = {
          maxWeightKg: null,
          maxWeightDate: null,
          bestE1rmKg: null,
          bestE1rmDate: null,
          repPRs: new Map(),
        };
        byExercise.set(exercise.exerciseId, acc);
      }

      for (const set of exercise.sets) {
        if (set.isWarmup) continue;

        const isBodyweight = set.weightKg === null;
        const loadKg = isBodyweight ? 0 : (set.weightKg as number);

        // repPR: best weight for this rep count (strictly heavier wins,
        // ties keep the earlier date because we iterate chronologically).
        const existingPr = acc.repPRs.get(set.reps);
        if (!existingPr || loadKg > existingPr.weightKg) {
          acc.repPRs.set(set.reps, { weightKg: loadKg, date: workout.date });
        }

        // Weight + e1rm bests only apply to loaded (non-bodyweight) sets.
        if (!isBodyweight) {
          if (acc.maxWeightKg === null || loadKg > acc.maxWeightKg) {
            acc.maxWeightKg = loadKg;
            acc.maxWeightDate = workout.date;
          }
          const e1rm = epley1rm(loadKg, set.reps);
          if (acc.bestE1rmKg === null || e1rm > acc.bestE1rmKg) {
            acc.bestE1rmKg = e1rm;
            acc.bestE1rmDate = workout.date;
          }
        }
      }
    }
  }

  const result: ExerciseBest[] = [];
  for (const [exerciseId, acc] of byExercise) {
    const repPRs: RepPR[] = [...acc.repPRs.entries()]
      .map(([reps, { weightKg, date }]) => ({ reps, weightKg, date }))
      .sort((a, b) => a.reps - b.reps);

    result.push({
      exerciseId,
      maxWeightKg: acc.maxWeightKg,
      maxWeightDate: acc.maxWeightDate,
      bestE1rmKg: acc.bestE1rmKg,
      bestE1rmDate: acc.bestE1rmDate,
      repPRs,
    });
  }

  return result.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}
