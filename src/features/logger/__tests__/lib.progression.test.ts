import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '@/parser/catalog';
import { sessionFromProgramDayWithProgression } from '@/features/logger/lib';
import type { AppSettings, ProgramDay, Workout } from '@/types/models';

const SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
};

const DAY: ProgramDay = {
  name: 'Push A · Heavy',
  splitCanonical: 'push',
  intensity: 'heavy',
  exercises: [
    {
      exerciseId: 'barbell-bench-press',
      rawName: 'Barbell Bench Press',
      targetSets: 3,
      repRange: [5, 9],
      rir: 1,
      restSeconds: 150,
    },
  ],
};

function priorBenchWorkout(): Workout {
  return {
    id: 'w-1',
    date: '2026-06-20',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: null,
    blockId: null,
    sourceNoteId: 'note-1',
    createdAt: '2026-06-20T12:00:00.000Z',
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Barbell Bench Press',
        unit: 'kg',
        sets: [
          { weightKg: 100, reps: 9, raw: '100x9' },
        ],
      },
    ],
  };
}

describe('sessionFromProgramDayWithProgression', () => {
  it('pre-fills sets from progression history', () => {
    const session = sessionFromProgramDayWithProgression(
      DAY,
      [priorBenchWorkout()],
      SETTINGS,
      BUILTIN_EXERCISES,
    );

    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].sets).toHaveLength(3);
    for (const set of session.exercises[0].sets) {
      expect(set.weightKg).toBe(102.5);
      expect(set.reps).toBe(5);
      expect(set.done).toBe(false);
    }
  });

  it('uses the bottom of the rep range when there is no history', () => {
    const session = sessionFromProgramDayWithProgression(
      DAY,
      [],
      SETTINGS,
      BUILTIN_EXERCISES,
    );

    for (const set of session.exercises[0].sets) {
      expect(set.weightKg).toBeNull();
      expect(set.reps).toBe(5);
      expect(set.done).toBe(false);
    }
  });
});