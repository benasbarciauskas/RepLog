import { epley1rm } from '@/analytics/epley';
import type { Workout } from '@/types/models';

export type PrKind = 'weight' | 'e1rm';

export interface PrEvent {
  date: string;
  exerciseId: string;
  kind: PrKind;
  valueKg: number;
  deltaKg: number;
  isFirst: boolean;
  reps?: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Build a reverse-chronological feed of weight and estimated-1RM personal records.
 * Mirrors `computeBests` rules; within a single workout only the best set per kind
 * per exercise can emit an event.
 */
export function buildPrTimeline(workouts: Workout[]): PrEvent[] {
  const events: PrEvent[] = [];

  const bestWeight = new Map<string, number>();
  const bestE1rm = new Map<string, number>();

  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (const workout of ordered) {
    for (const exercise of workout.exercises) {
      const { exerciseId } = exercise;

      let workoutMaxWeight: number | null = null;
      let workoutMaxWeightReps: number | undefined;
      let workoutMaxE1rm: number | null = null;

      for (const set of exercise.sets) {
        if (set.isWarmup || set.weightKg === null) continue;

        const loadKg = set.weightKg;

        if (workoutMaxWeight === null || loadKg > workoutMaxWeight) {
          workoutMaxWeight = loadKg;
          workoutMaxWeightReps = set.reps;
        }

        const e1rm = epley1rm(loadKg, set.reps);
        if (workoutMaxE1rm === null || e1rm > workoutMaxE1rm) {
          workoutMaxE1rm = e1rm;
        }
      }

      if (workoutMaxWeight !== null) {
        const prev = bestWeight.get(exerciseId);
        if (prev === undefined || workoutMaxWeight > prev) {
          const isFirst = prev === undefined;
          events.push({
            date: workout.date,
            exerciseId,
            kind: 'weight',
            valueKg: workoutMaxWeight,
            deltaKg: isFirst ? 0 : workoutMaxWeight - prev,
            isFirst,
            reps: workoutMaxWeightReps,
          });
          bestWeight.set(exerciseId, workoutMaxWeight);
        }
      }

      if (workoutMaxE1rm !== null) {
        const prev = bestE1rm.get(exerciseId);
        if (prev === undefined || workoutMaxE1rm > prev) {
          const isFirst = prev === undefined;
          const valueKg = round1(workoutMaxE1rm);
          const prevRounded = prev === undefined ? 0 : round1(prev);
          events.push({
            date: workout.date,
            exerciseId,
            kind: 'e1rm',
            valueKg,
            deltaKg: isFirst ? 0 : round1(valueKg - prevRounded),
            isFirst,
          });
          bestE1rm.set(exerciseId, workoutMaxE1rm);
        }
      }
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}