import { describe, expect, it } from 'vitest';
import {
  dashboardStats,
  prsInPeriod,
  volumeInRange,
  weeklyStreak,
  workoutVolumeKg,
} from '../stats';
import type { ExerciseBest, SetEntry, Workout } from '@/types/models';

function workout(id: string, date: string, sets: SetEntry[]): Workout {
  return {
    id,
    date,
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: `${date}T10:00:00.000Z`,
    exercises: [{ exerciseId: 'barbell-bench-press', rawName: 'Bench', unit: 'kg', sets }],
  };
}
const s = (weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  weightKg,
  reps,
  raw: `${weightKg}x${reps}`,
  ...extra,
});

describe('workoutVolumeKg', () => {
  it('sums weight × reps over loaded working sets, ignoring warm-ups + bodyweight', () => {
    const w = workout('w', '2024-05-01', [
      s(100, 5), // 500
      s(60, 5, { isWarmup: true }), // excluded
      s(null, 10), // bodyweight, excluded
    ]);
    expect(workoutVolumeKg(w)).toBe(500);
  });
});

describe('volumeInRange', () => {
  it('sums only workouts within the inclusive date window', () => {
    const workouts = [
      workout('a', '2024-05-01', [s(100, 5)]), // 500, before
      workout('b', '2024-05-10', [s(100, 5)]), // 500, in
      workout('c', '2024-05-20', [s(100, 5)]), // 500, after
    ];
    expect(volumeInRange(workouts, '2024-05-05', '2024-05-15')).toBe(500);
  });
});

describe('weeklyStreak', () => {
  it('counts consecutive ISO weeks (Mon-anchored) with a session back from today', () => {
    // today = Wed 2024-05-15. Weeks: this (May 13-19), prev (May 6-12), prev2 (Apr 29-May 5).
    const today = new Date(2024, 4, 15);
    const workouts = [
      workout('a', '2024-05-15', [s(100, 5)]), // this week
      workout('b', '2024-05-08', [s(100, 5)]), // last week
      workout('c', '2024-05-01', [s(100, 5)]), // 2 weeks ago
    ];
    expect(weeklyStreak(workouts, today)).toBe(3);
  });

  it('breaks the streak on a gap week', () => {
    const today = new Date(2024, 4, 15);
    const workouts = [
      workout('a', '2024-05-15', [s(100, 5)]), // this week
      // skip last week
      workout('c', '2024-05-01', [s(100, 5)]), // 2 weeks ago
    ];
    expect(weeklyStreak(workouts, today)).toBe(1);
  });

  it('is 0 when the current week has no session', () => {
    const today = new Date(2024, 4, 15);
    const workouts = [workout('a', '2024-05-01', [s(100, 5)])];
    expect(weeklyStreak(workouts, today)).toBe(0);
  });

  it('is 0 for no workouts', () => {
    expect(weeklyStreak([], new Date(2024, 4, 15))).toBe(0);
  });
});

describe('prsInPeriod', () => {
  const best = (maxDate: string | null, e1rmDate: string | null): ExerciseBest => ({
    exerciseId: 'barbell-bench-press',
    maxWeightKg: 100,
    maxWeightDate: maxDate,
    bestE1rmKg: 120,
    bestE1rmDate: e1rmDate,
    repPRs: [],
  });

  it('counts bests with a PR date inside the trailing window', () => {
    const today = new Date(2024, 4, 15);
    const bests = [
      best('2024-05-10', null), // in window
      best(null, '2024-05-01'), // in window (e1rm date)
      best('2024-03-01', null), // outside 30d
    ];
    expect(prsInPeriod(bests, today, 30)).toBe(2);
  });
});

describe('dashboardStats', () => {
  it('computes weekly volume + delta, streak, monthly count, and PRs together', () => {
    const today = new Date(2024, 4, 15); // Wed May 15
    const workouts = [
      workout('a', '2024-05-15', [s(100, 5)]), // this week: 500
      workout('b', '2024-05-08', [s(100, 4)]), // last week: 400
      workout('c', '2024-05-02', [s(100, 5)]), // this month, 2 wks ago
    ];
    const bests: ExerciseBest[] = [
      {
        exerciseId: 'barbell-bench-press',
        maxWeightKg: 100,
        maxWeightDate: '2024-05-14',
        bestE1rmKg: 120,
        bestE1rmDate: '2024-05-14',
        repPRs: [],
      },
    ];
    const stats = dashboardStats(workouts, bests, today);

    expect(stats.thisWeekVolumeKg).toBe(500);
    expect(stats.lastWeekVolumeKg).toBe(400);
    expect(stats.weeklyVolumeDeltaPct).toBe(25); // (500-400)/400
    // Consecutive weeks: May 13-19, May 6-12, Apr 29-May 5 → 3.
    expect(stats.streakWeeks).toBe(3);
    expect(stats.workoutsThisMonth).toBe(3);
    expect(stats.prsThisPeriod).toBe(1);
  });

  it('returns null weekly delta when last week had no volume', () => {
    const today = new Date(2024, 4, 15);
    const workouts = [workout('a', '2024-05-15', [s(100, 5)])];
    expect(dashboardStats(workouts, [], today).weeklyVolumeDeltaPct).toBeNull();
  });
});
