import { describe, expect, it } from 'vitest';
import { buildPrTimeline } from '../lib/prTimeline';
import { fixtureWorkouts } from '@/analytics/__tests__/fixtures';
import type { Workout, WorkoutExercise } from '@/types/models';

function exercise(
  exerciseId: string,
  sets: WorkoutExercise['sets'],
): WorkoutExercise {
  return { exerciseId, rawName: exerciseId, unit: 'kg', sets };
}

function workout(overrides: Partial<Workout>): Workout {
  return {
    id: 'w1',
    date: '2024-01-01',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2024-01-01T10:00:00.000Z',
    exercises: [],
    ...overrides,
  };
}

describe('buildPrTimeline', () => {
  it('emits weight and e1rm events from fixture workouts', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    expect(events.some((e) => e.kind === 'weight')).toBe(true);
    expect(events.some((e) => e.kind === 'e1rm')).toBe(true);
  });

  it('computes correct weight deltas', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    const benchWeight = events
      .filter((e) => e.exerciseId === 'barbell-bench-press' && e.kind === 'weight')
      .sort((a, b) => a.date.localeCompare(b.date));

    expect(benchWeight[0].valueKg).toBe(105);
    expect(benchWeight[0].isFirst).toBe(true);
    expect(benchWeight[0].deltaKg).toBe(0);

    expect(benchWeight[1].valueKg).toBe(140);
    expect(benchWeight[1].deltaKg).toBe(35);
    expect(benchWeight[1].isFirst).toBe(false);
  });

  it('flags first-record events', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    const firsts = events.filter((e) => e.isFirst);
    expect(firsts.length).toBeGreaterThan(0);
    expect(firsts.every((e) => e.deltaKg === 0)).toBe(true);
  });

  it('excludes warm-up sets', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    // 60x8 warmup must not produce a weight PR.
    expect(events.some((e) => e.valueKg === 60)).toBe(false);
  });

  it('excludes bodyweight (null weight) sets', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    expect(events.every((e) => e.exerciseId !== 'pull-up')).toBe(true);
  });

  it('favours the earlier date on ties', () => {
    const tied: Workout[] = [
      workout({
        id: 'early',
        date: '2024-01-01',
        exercises: [exercise('barbell-bench-press', [{ weightKg: 100, reps: 5, raw: '100x5' }])],
      }),
      workout({
        id: 'late',
        date: '2024-02-01',
        exercises: [exercise('barbell-bench-press', [{ weightKg: 100, reps: 5, raw: '100x5' }])],
      }),
    ];
    const events = buildPrTimeline(tied);
    const weightEvents = events.filter(
      (e) => e.exerciseId === 'barbell-bench-press' && e.kind === 'weight',
    );
    expect(weightEvents).toHaveLength(1);
    expect(weightEvents[0].date).toBe('2024-01-01');
  });

  it('emits only one event per kind per workout (no dup for 100,100,100)', () => {
    const dup: Workout[] = [
      workout({
        exercises: [
          exercise('barbell-bench-press', [
            { weightKg: 100, reps: 5, raw: '100x5' },
            { weightKg: 100, reps: 5, raw: '100x5' },
            { weightKg: 100, reps: 5, raw: '100x5' },
          ]),
        ],
      }),
    ];
    const events = buildPrTimeline(dup);
    const weightEvents = events.filter((e) => e.kind === 'weight');
    const e1rmEvents = events.filter((e) => e.kind === 'e1rm');
    expect(weightEvents).toHaveLength(1);
    expect(e1rmEvents).toHaveLength(1);
  });

  it('returns events in reverse-chronological order', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i - 1].date.localeCompare(events[i].date)).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes reps on weight PR rows', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    const weight = events.find(
      (e) => e.exerciseId === 'barbell-bench-press' && e.kind === 'weight' && e.valueKg === 140,
    );
    expect(weight?.reps).toBe(3);
  });

  it('rounds e1rm values to one decimal', () => {
    const events = buildPrTimeline(fixtureWorkouts);
    const e1rm = events.find(
      (e) => e.exerciseId === 'barbell-bench-press' && e.kind === 'e1rm',
    );
    expect(e1rm?.valueKg).toBeCloseTo(164.7, 1);
  });
});