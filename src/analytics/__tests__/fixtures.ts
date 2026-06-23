import type { Workout, WorkoutExercise } from '@/types/models';

let seq = 0;

function exercise(
  exerciseId: string,
  rawName: string,
  sets: WorkoutExercise['sets'],
): WorkoutExercise {
  return { exerciseId, rawName, unit: 'kg', sets };
}

function workout(overrides: Partial<Workout>): Workout {
  seq += 1;
  return {
    id: `w${seq}`,
    date: '2023-06-19',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2023-06-19T10:00:00.000Z',
    exercises: [],
    ...overrides,
  };
}

/**
 * A small but deliberate corpus:
 *
 * Bench press appears on three dates with different schemes so that
 * MAX WEIGHT (140x3, 154 e1rm) and BEST e1rm (130x8 → 164.67) come from
 * DIFFERENT sets, exercising the divergence the spec asks for.
 *
 *  - 2023-06-19: bench 105x5 (e1rm 122.5)
 *  - 2023-07-10: bench 140x3 (e1rm 154)  ← max weight
 *  - 2023-09-13: bench 130x8 (e1rm 164.67) ← best e1rm, different set
 *
 * Two date ranges separated by a >21-day gap (Jul 10 → Sep 13) AND a split
 * change (push → pull) drive inferBlocks to produce ≥2 blocks.
 *
 * Pull-ups are logged bodyweight-only (weightKg null) to populate repPRs
 * without contributing to maxWeightKg/bestE1rmKg.
 *
 * Bodyweight is recorded on some sessions and omitted on others, so
 * bodyweightSeries must skip the null ones.
 */
export const fixtureWorkouts: Workout[] = [
  workout({
    id: 'wA',
    date: '2023-06-19',
    bodyweightKg: 87,
    splitCanonical: 'push',
    splitRaw: 'Push',
    exercises: [
      exercise('barbell-bench-press', 'Benchpress', [
        { weightKg: 60, reps: 8, isWarmup: true, raw: '60x8' },
        { weightKg: 105, reps: 5, raw: '105x5' },
        { weightKg: 105, reps: 5, raw: '5' },
      ]),
      exercise('pull-up', 'Pullups', [
        { weightKg: null, reps: 12, raw: '12' },
        { weightKg: null, reps: 10, raw: '10' },
      ]),
    ],
  }),
  workout({
    id: 'wB',
    date: '2023-07-10',
    bodyweightKg: 88,
    splitCanonical: 'push',
    splitRaw: 'Push',
    exercises: [
      exercise('barbell-bench-press', 'Bench', [
        { weightKg: 140, reps: 3, raw: '140x3' },
        { weightKg: 130, reps: 5, raw: '130x5' },
      ]),
      exercise('pull-up', 'Pullups', [{ weightKg: null, reps: 14, raw: '14' }]),
    ],
  }),
  // >21d gap AND split changes from push → pull here.
  workout({
    id: 'wC',
    date: '2023-09-13',
    bodyweightKg: null,
    splitCanonical: 'pull',
    splitRaw: 'Pull',
    exercises: [
      exercise('barbell-bench-press', 'Bench', [
        { weightKg: 130, reps: 8, raw: '130x8' },
      ]),
      exercise('pull-up', 'Pullups', [{ weightKg: null, reps: 18, raw: '18' }]),
    ],
  }),
  workout({
    id: 'wD',
    date: '2023-09-15',
    bodyweightKg: 89,
    splitCanonical: 'pull',
    splitRaw: 'Pull',
    exercises: [
      exercise('pull-up', 'Pullups', [{ weightKg: null, reps: 20, raw: '20' }]),
    ],
  }),
];
