import { describe, expect, it } from 'vitest';
import { computeBests } from '../bests';
import { fixtureWorkouts } from './fixtures';

describe('computeBests', () => {
  it('returns one entry per exerciseId seen in the workouts', () => {
    const bests = computeBests(fixtureWorkouts);
    const ids = bests.map((b) => b.exerciseId).sort();
    expect(ids).toEqual(['barbell-bench-press', 'pull-up']);
  });

  it('reports the heaviest working-set weight and its date', () => {
    const bench = computeBests(fixtureWorkouts).find(
      (b) => b.exerciseId === 'barbell-bench-press',
    )!;
    expect(bench.maxWeightKg).toBe(140);
    expect(bench.maxWeightDate).toBe('2023-07-10');
  });

  it('reports a best e1rm that can come from a different set than the max weight', () => {
    const bench = computeBests(fixtureWorkouts).find(
      (b) => b.exerciseId === 'barbell-bench-press',
    )!;
    // 130x8 → 130 * (1 + 8/30) = 164.67, beats 140x3 (154) and 105x5 (122.5).
    expect(bench.bestE1rmKg).toBeCloseTo(164.67, 1);
    expect(bench.bestE1rmDate).toBe('2023-09-13');
    // The best e1rm set (130x8) is NOT the max-weight set (140x3).
    expect(bench.bestE1rmDate).not.toBe(bench.maxWeightDate);
  });

  it('produces a non-empty repPRs list, one best weight per rep count', () => {
    const bench = computeBests(fixtureWorkouts).find(
      (b) => b.exerciseId === 'barbell-bench-press',
    )!;
    expect(bench.repPRs.length).toBeGreaterThan(0);
    // For 5 reps the best weight is 130 (130x5 beats 105x5).
    const fiveRep = bench.repPRs.find((p) => p.reps === 5)!;
    expect(fiveRep.weightKg).toBe(130);
    expect(fiveRep.date).toBe('2023-07-10');
  });

  it('ignores warmup-flagged sets for PRs', () => {
    const bench = computeBests(fixtureWorkouts).find(
      (b) => b.exerciseId === 'barbell-bench-press',
    )!;
    // The 60x8 warmup must not appear as an 8-rep PR (130x8 is the only 8-rep PR).
    const eightRep = bench.repPRs.find((p) => p.reps === 8)!;
    expect(eightRep.weightKg).toBe(130);
  });

  it('treats bodyweight (null weight) sets as repPRs only — no weight/e1rm', () => {
    const pull = computeBests(fixtureWorkouts).find(
      (b) => b.exerciseId === 'pull-up',
    )!;
    expect(pull.maxWeightKg).toBeNull();
    expect(pull.maxWeightDate).toBeNull();
    expect(pull.bestE1rmKg).toBeNull();
    expect(pull.bestE1rmDate).toBeNull();
    expect(pull.repPRs.length).toBeGreaterThan(0);
    // Bodyweight rep PRs carry weightKg 0 (no external load).
    const twenty = pull.repPRs.find((p) => p.reps === 20)!;
    expect(twenty.weightKg).toBe(0);
    expect(twenty.date).toBe('2023-09-15');
  });

  it('returns an empty array for no workouts', () => {
    expect(computeBests([])).toEqual([]);
  });
});
