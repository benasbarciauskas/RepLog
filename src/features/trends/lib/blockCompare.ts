import { epley1rm } from '@/analytics/epley';
import { workoutVolumeKg } from '@/features/dashboard/stats';
import type { TrainingBlock, Workout } from '@/types/models';

export interface BlockSummary {
  blockId: string;
  sessions: number;
  totalVolumeKg: number;
  avgBodyweightKg: number | null;
  bestE1rmByExercise: Map<string, number>;
}

export interface BlockMetricDiff {
  exerciseId: string;
  a: number | null;
  b: number | null;
  deltaKg: number | null;
}

export interface BlockDiff {
  sessions: { a: number; b: number; delta: number };
  volumeKg: { a: number; b: number; delta: number; pct: number | null };
  bodyweightKg: { a: number | null; b: number | null; delta: number | null };
  lifts: BlockMetricDiff[];
}

function workoutsInBlock(block: TrainingBlock, workouts: Workout[]): Workout[] {
  return workouts.filter(
    (w) =>
      w.date >= block.startDate &&
      w.date <= block.endDate &&
      w.splitCanonical === block.splitCanonical,
  );
}

function bestE1rmForWorkouts(workouts: Workout[]): Map<string, number> {
  const best = new Map<string, number>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (set.isWarmup || set.weightKg === null) continue;
        const e1rm = epley1rm(set.weightKg, set.reps);
        const prev = best.get(exercise.exerciseId);
        if (prev === undefined || e1rm > prev) {
          best.set(exercise.exerciseId, e1rm);
        }
      }
    }
  }

  return best;
}

/** Summarize one inferred training block from the full workout list. */
export function summarizeBlock(block: TrainingBlock, workouts: Workout[]): BlockSummary {
  const inBlock = workoutsInBlock(block, workouts);

  let totalVolumeKg = 0;
  for (const w of inBlock) {
    totalVolumeKg += workoutVolumeKg(w);
  }

  const bodyweights = inBlock
    .map((w) => w.bodyweightKg)
    .filter((bw): bw is number => bw != null);

  const avgBodyweightKg =
    bodyweights.length > 0
      ? bodyweights.reduce((sum, bw) => sum + bw, 0) / bodyweights.length
      : null;

  return {
    blockId: block.id,
    sessions: inBlock.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    avgBodyweightKg,
    bestE1rmByExercise: bestE1rmForWorkouts(inBlock),
  };
}

/** Side-by-side diff of two block summaries (A vs B). */
export function compareBlocks(a: BlockSummary, b: BlockSummary): BlockDiff {
  const sharedIds = [...a.bestE1rmByExercise.keys()].filter((id) =>
    b.bestE1rmByExercise.has(id),
  );

  const lifts: BlockMetricDiff[] = sharedIds
    .sort((x, y) => x.localeCompare(y))
    .map((exerciseId) => {
      const aVal = round1(a.bestE1rmByExercise.get(exerciseId)!);
      const bVal = round1(b.bestE1rmByExercise.get(exerciseId)!);
      return {
        exerciseId,
        a: aVal,
        b: bVal,
        deltaKg: round1(bVal - aVal),
      };
    });

  const volumeA = a.totalVolumeKg;
  const volumeB = b.totalVolumeKg;

  return {
    sessions: {
      a: a.sessions,
      b: b.sessions,
      delta: b.sessions - a.sessions,
    },
    volumeKg: {
      a: volumeA,
      b: volumeB,
      delta: volumeB - volumeA,
      pct: volumeA === 0 ? null : (volumeB - volumeA) / volumeA,
    },
    bodyweightKg: {
      a: a.avgBodyweightKg,
      b: b.avgBodyweightKg,
      delta:
        a.avgBodyweightKg != null && b.avgBodyweightKg != null
          ? b.avgBodyweightKg - a.avgBodyweightKg
          : null,
    },
    lifts,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}