import type { Workout } from '@/types/models';

/**
 * Extract a sorted bodyweight time series. Workouts without a recorded
 * bodyweight (`bodyweightKg === null`) are skipped. Result is ascending by date.
 */
export function bodyweightSeries(
  workouts: Workout[],
): { date: string; kg: number }[] {
  return workouts
    .filter((w): w is Workout & { bodyweightKg: number } => w.bodyweightKg !== null)
    .map((w) => ({ date: w.date, kg: w.bodyweightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
