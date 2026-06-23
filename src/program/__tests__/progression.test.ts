import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '@/parser/catalog';
import { incrementForExercise, suggestNextSet } from '@/program/progression';
import type { AppSettings, Workout } from '@/types/models';

const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
};

function makeWorkout(
  date: string,
  exerciseId: string,
  sets: { weightKg: number | null; reps: number; isWarmup?: boolean }[],
): Workout {
  return {
    id: `w-${date}`,
    date,
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: null,
    blockId: null,
    sourceNoteId: 'note-1',
    createdAt: `${date}T12:00:00.000Z`,
    exercises: [
      {
        exerciseId,
        rawName: 'Test Exercise',
        unit: 'kg',
        sets: sets.map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          isWarmup: s.isWarmup,
          raw: `${s.weightKg ?? 'BW'}x${s.reps}`,
        })),
      },
    ],
  };
}

const TARGET = {
  repRange: [8, 12] as [number, number],
  rir: 2,
  incrementKg: 2.5,
};

describe('suggestNextSet', () => {
  it('returns null when there is no history', () => {
    expect(suggestNextSet([], 'barbell-bench-press', TARGET)).toBeNull();
  });

  it('adds a rep at the same weight when not graduated', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'barbell-bench-press', [
        { weightKg: 100, reps: 10 },
      ]),
    ];
    expect(suggestNextSet(workouts, 'barbell-bench-press', TARGET)).toEqual({
      weightKg: 100,
      reps: 11,
    });
  });

  it('graduates weight and resets reps when last reps hit the top of the range', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'barbell-bench-press', [
        { weightKg: 100, reps: 12 },
      ]),
    ];
    expect(suggestNextSet(workouts, 'barbell-bench-press', TARGET)).toEqual({
      weightKg: 102.5,
      reps: 8,
    });
  });

  it('caps rep progression at the top of the range', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'barbell-bench-press', [
        { weightKg: 100, reps: 11 },
      ]),
    ];
    expect(suggestNextSet(workouts, 'barbell-bench-press', TARGET)).toEqual({
      weightKg: 100,
      reps: 12,
    });
  });

  it('progresses bodyweight exercises by reps only', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'pull-up', [{ weightKg: null, reps: 8 }]),
    ];
    expect(suggestNextSet(workouts, 'pull-up', TARGET)).toEqual({
      weightKg: null,
      reps: 9,
    });
  });

  it('uses the most recent workout and its top working set', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'barbell-bench-press', [
        { weightKg: 80, reps: 10 },
        { weightKg: 90, reps: 8 },
      ]),
      makeWorkout('2026-06-10', 'barbell-bench-press', [
        { weightKg: 100, reps: 9 },
        { weightKg: 95, reps: 10 },
      ]),
    ];
    expect(suggestNextSet(workouts, 'barbell-bench-press', TARGET)).toEqual({
      weightKg: 100,
      reps: 10,
    });
  });

  it('ignores warm-up sets when picking the reference set', () => {
    const workouts = [
      makeWorkout('2026-06-01', 'barbell-bench-press', [
        { weightKg: 60, reps: 10, isWarmup: true },
        { weightKg: 100, reps: 8 },
      ]),
    ];
    expect(suggestNextSet(workouts, 'barbell-bench-press', TARGET)).toEqual({
      weightKg: 100,
      reps: 9,
    });
  });
});

describe('incrementForExercise', () => {
  it('uses 5 kg for lower-body compounds', () => {
    const squat = BUILTIN_EXERCISES.find((e) => e.id === 'back-squat');
    expect(incrementForExercise(squat, DEFAULT_SETTINGS)).toBe(5);
  });

  it('uses 2.5 kg for upper-body exercises', () => {
    const bench = BUILTIN_EXERCISES.find((e) => e.id === 'barbell-bench-press');
    expect(incrementForExercise(bench, DEFAULT_SETTINGS)).toBe(2.5);
  });

  it('clamps to min plate × 2 when that exceeds the default', () => {
    const bench = BUILTIN_EXERCISES.find((e) => e.id === 'barbell-bench-press');
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      availablePlatesKg: [10],
    };
    expect(incrementForExercise(bench, settings)).toBe(20);
  });
});