import type { Workout } from '@/types/models';

/**
 * Realistic demo workouts so a first-time user can see the whole app light up
 * without importing anything. Modelled on the real free-text note styles the
 * parser targets (a PPL block: 105×5 bench, a 140kg bench top day, an OHP
 * 60–70kg session, and a squat/deadlift lower day).
 *
 * The numbers are deliberately tuned so the coach surfaces real findings:
 *  - bench est-1RM ≈ 163kg vs overhead-press est-1RM ≈ 82kg → ratio 0.50,
 *    below the healthy ≥0.60 band → a PRIORITY front-delt/triceps deficit
 *    (the canonical "you bench big but barely press overhead" finding).
 *  - back-squat ≈ 198 vs bench ≈ 163 → 1.21, just under the 1.30 band → a flag.
 *  - deadlift ≈ 220 vs squat ≈ 198 → 1.11, under 1.15 → a flag.
 *
 * All exerciseIds are canonical catalog ids (see src/parser/catalog.ts) so
 * bests, the PR grid, and the coach all resolve names and rules correctly.
 * `id`s are stable strings prefixed `sample-` so re-seeding is idempotent
 * (bulkPut overwrites rather than duplicating).
 */

const CREATED_AT = '2024-09-01T12:00:00.000Z';

export const SAMPLE_WORKOUTS: Workout[] = [
  // ---- Push day (PPL) — working bench, incline, overhead, triceps --------
  {
    id: 'sample-push-1',
    date: '2024-08-05',
    dateConfidence: 'high',
    bodyweightKg: 82,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'sample',
    createdAt: CREATED_AT,
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench 5x5',
        unit: 'kg',
        sets: [
          { weightKg: 60, reps: 8, isWarmup: true, raw: '60x8' },
          { weightKg: 105, reps: 5, raw: '105x5' },
          { weightKg: 105, reps: 5, raw: '105x5' },
          { weightKg: 105, reps: 5, raw: '105x5' },
          { weightKg: 105, reps: 5, raw: '105x5' },
          { weightKg: 105, reps: 4, raw: '105x4' },
        ],
      },
      {
        exerciseId: 'incline-bench',
        rawName: 'Incline bench',
        unit: 'kg',
        sets: [
          { weightKg: 80, reps: 8, raw: '80x8' },
          { weightKg: 80, reps: 7, raw: '80x7' },
          { weightKg: 80, reps: 6, raw: '80x6' },
        ],
      },
      {
        exerciseId: 'overhead-press',
        rawName: 'OHP',
        unit: 'kg',
        sets: [
          { weightKg: 60, reps: 8, raw: '60x8' },
          { weightKg: 60, reps: 7, raw: '60x7' },
          { weightKg: 60, reps: 6, raw: '60x6' },
        ],
      },
      {
        exerciseId: 'tricep-pushdown',
        rawName: 'Tricep pushdown',
        unit: 'kg',
        sets: [
          { weightKg: 35, reps: 12, raw: '35x12' },
          { weightKg: 35, reps: 12, raw: '35x12' },
          { weightKg: 35, reps: 10, raw: '35x10' },
        ],
      },
    ],
  },

  // ---- Pull day (PPL) — rows, pull-ups, curls ----------------------------
  {
    id: 'sample-pull-1',
    date: '2024-08-07',
    dateConfidence: 'high',
    bodyweightKg: 82,
    splitCanonical: 'pull',
    splitRaw: 'Pull',
    blockId: null,
    sourceNoteId: 'sample',
    createdAt: CREATED_AT,
    exercises: [
      {
        exerciseId: 'barbell-row',
        rawName: 'Barbell row',
        unit: 'kg',
        sets: [
          { weightKg: 90, reps: 8, raw: '90x8' },
          { weightKg: 100, reps: 8, raw: '100x8' },
          { weightKg: 100, reps: 7, raw: '100x7' },
        ],
      },
      {
        exerciseId: 'pull-up',
        rawName: 'Pull-ups',
        unit: 'kg',
        sets: [
          { weightKg: null, reps: 10, raw: 'BWx10' },
          { weightKg: null, reps: 9, raw: 'BWx9' },
          { weightKg: null, reps: 8, raw: 'BWx8' },
        ],
      },
      {
        exerciseId: 'barbell-curl',
        rawName: 'Barbell curl',
        unit: 'kg',
        sets: [
          { weightKg: 40, reps: 10, raw: '40x10' },
          { weightKg: 40, reps: 9, raw: '40x9' },
          { weightKg: 40, reps: 8, raw: '40x8' },
        ],
      },
    ],
  },

  // ---- Legs day (PPL) — squat + deadlift + accessories -------------------
  {
    id: 'sample-legs-1',
    date: '2024-08-09',
    dateConfidence: 'high',
    bodyweightKg: 82.5,
    splitCanonical: 'legs',
    splitRaw: 'Legs',
    blockId: null,
    sourceNoteId: 'sample',
    createdAt: CREATED_AT,
    exercises: [
      {
        exerciseId: 'back-squat',
        rawName: 'Squat',
        unit: 'kg',
        sets: [
          { weightKg: 100, reps: 5, isWarmup: true, raw: '100x5' },
          { weightKg: 160, reps: 5, raw: '160x5' },
          { weightKg: 180, reps: 3, raw: '180x3' },
          { weightKg: 180, reps: 3, raw: '180x3' },
        ],
      },
      {
        exerciseId: 'deadlift',
        rawName: 'Deadlift',
        unit: 'kg',
        sets: [
          { weightKg: 180, reps: 5, raw: '180x5' },
          { weightKg: 200, reps: 3, raw: '200x3' },
        ],
      },
      {
        exerciseId: 'leg-curl',
        rawName: 'Leg curl',
        unit: 'kg',
        sets: [
          { weightKg: 50, reps: 12, raw: '50x12' },
          { weightKg: 50, reps: 12, raw: '50x12' },
        ],
      },
    ],
  },

  // ---- Bench top day — a heavy single-lift session, the 140kg PR ---------
  {
    id: 'sample-push-2',
    date: '2024-08-26',
    dateConfidence: 'high',
    bodyweightKg: 83,
    splitCanonical: 'push',
    splitRaw: 'Push - bench focus',
    blockId: null,
    sourceNoteId: 'sample',
    createdAt: CREATED_AT,
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench',
        unit: 'kg',
        sets: [
          { weightKg: 100, reps: 5, isWarmup: true, raw: '100x5' },
          { weightKg: 120, reps: 3, isWarmup: true, raw: '120x3' },
          { weightKg: 140, reps: 5, raw: '140x5' },
          { weightKg: 140, reps: 4, raw: '140x4' },
          { weightKg: 130, reps: 6, raw: '130x6' },
        ],
      },
      {
        exerciseId: 'overhead-press',
        rawName: 'OHP',
        unit: 'kg',
        sets: [
          { weightKg: 70, reps: 5, raw: '70x5' },
          { weightKg: 70, reps: 4, raw: '70x4' },
          { weightKg: 60, reps: 8, raw: '60x8' },
        ],
      },
      {
        exerciseId: 'lateral-raise',
        rawName: 'Lateral raises',
        unit: 'kg',
        sets: [
          { weightKg: 12, reps: 15, raw: '12x15' },
          { weightKg: 12, reps: 14, raw: '12x14' },
          { weightKg: 12, reps: 12, raw: '12x12' },
        ],
      },
    ],
  },
];
