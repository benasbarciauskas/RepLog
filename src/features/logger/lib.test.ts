import { describe, expect, it } from 'vitest';
import {
  addPlatePreset,
  adjustRestDeadline,
  deletePlatePreset,
  formatElapsed,
  formatRestClock,
  groupExercisesForRender,
  makeEmptySession,
  platesForWeight,
  platesFromPreset,
  platesRemainder,
  previousSetsFor,
  restDeadlineFrom,
  restRemainingSeconds,
  routineFromSession,
  sessionFromRoutine,
  summarizeSession,
  workingSetNumber,
} from './lib';
import type { ActiveSession, ActiveSet, Routine, Workout } from '@/types/models';

const STANDARD_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

function set(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return { id: 'x', weightKg: 100, reps: 5, rpe: null, isWarmup: false, done: true, ...overrides };
}

describe('platesForWeight', () => {
  it('returns plates per side, largest-first, for a clean load', () => {
    // 100kg, 20kg bar → 40 per side → 25 + 15.
    expect(platesForWeight(100, 20, STANDARD_PLATES)).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
  });

  it('handles a single-plate-per-side load (60kg → 1×20)', () => {
    expect(platesForWeight(60, 20, STANDARD_PLATES)).toEqual([{ plate: 20, count: 1 }]);
  });

  it('uses 2×20 per side when 25s are unavailable', () => {
    // 100kg, 20 bar, no 25s → 40 per side → 2×20.
    expect(platesForWeight(100, 20, [20, 15, 10, 5, 2.5, 1.25])).toEqual([
      { plate: 20, count: 2 },
    ]);
  });

  it('returns [] at or below bar weight', () => {
    expect(platesForWeight(20, 20, STANDARD_PLATES)).toEqual([]);
    expect(platesForWeight(10, 20, STANDARD_PLATES)).toEqual([]);
  });

  it('greedily fills heavy loads with multiple big plates', () => {
    // 200kg, 20 bar → 90 per side → 3×25 + 15.
    expect(platesForWeight(200, 20, STANDARD_PLATES)).toEqual([
      { plate: 25, count: 3 },
      { plate: 15, count: 1 },
    ]);
  });

  it('uses small plates for fractional loads without float drift', () => {
    // 60kg + small bumps: 26.5 per side (73kg) → 25 + 1.25 (+ remainder 0.25).
    const stacks = platesForWeight(73, 20, STANDARD_PLATES);
    expect(stacks).toEqual([{ plate: 25, count: 1 }, { plate: 1.25, count: 1 }]);
  });

  it('ignores duplicate / non-positive denominations', () => {
    expect(platesForWeight(60, 20, [20, 20, 0, -5])).toEqual([{ plate: 20, count: 1 }]);
  });
});

describe('platesRemainder', () => {
  it('is 0 for an exactly reachable load', () => {
    expect(platesRemainder(100, 20, STANDARD_PLATES)).toBe(0);
    expect(platesRemainder(60, 20, STANDARD_PLATES)).toBe(0);
  });

  it('surfaces the per-side shortfall for an unreachable load', () => {
    // 73kg → 26.5 per side → 25 + 1.25 = 26.25 → remainder 0.25.
    expect(platesRemainder(73, 20, STANDARD_PLATES)).toBeCloseTo(0.25, 5);
  });

  it('is 0 at/below the bar', () => {
    expect(platesRemainder(20, 20, STANDARD_PLATES)).toBe(0);
  });
});

describe('rest-timer math', () => {
  it('remaining = ceil((deadline − now) / 1000), clamped at 0', () => {
    expect(restRemainingSeconds(10_000, 0)).toBe(10);
    expect(restRemainingSeconds(10_500, 0)).toBe(11); // rounds up
    expect(restRemainingSeconds(10_000, 10_000)).toBe(0);
    expect(restRemainingSeconds(10_000, 99_999)).toBe(0); // past deadline
  });

  it('restDeadlineFrom is now + seconds in ms', () => {
    expect(restDeadlineFrom(1_000, 120)).toBe(1_000 + 120_000);
    expect(restDeadlineFrom(1_000, -5)).toBe(1_000); // negative clamps to 0s
  });

  it('resumes correctly across a "refresh": same deadline, later now', () => {
    const now = 1_000_000;
    const deadline = restDeadlineFrom(now, 120); // 120s rest
    // 30s later (simulating a page reload reading persisted deadline).
    expect(restRemainingSeconds(deadline, now + 30_000)).toBe(90);
  });

  it('adjustRestDeadline shifts ±15s but never before now', () => {
    const now = 1_000;
    const deadline = now + 60_000; // 60s left
    expect(restRemainingSeconds(adjustRestDeadline(deadline, 15, now), now)).toBe(75);
    expect(restRemainingSeconds(adjustRestDeadline(deadline, -15, now), now)).toBe(45);
    // −90s from a 60s timer → clamps to now (0 remaining), never negative.
    expect(restRemainingSeconds(adjustRestDeadline(deadline, -90, now), now)).toBe(0);
  });

  it('formats the rest clock as m:ss', () => {
    expect(formatRestClock(0)).toBe('0:00');
    expect(formatRestClock(9)).toBe('0:09');
    expect(formatRestClock(75)).toBe('1:15');
    expect(formatRestClock(120)).toBe('2:00');
  });

  it('formats elapsed time, adding hours past 60 minutes', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(3661)).toBe('1:01:01');
  });
});

describe('previousSetsFor', () => {
  function workout(id: string, date: string, exerciseId: string, sets: { weightKg: number | null; reps: number; isWarmup?: boolean }[]): Workout {
    return {
      id,
      date,
      dateConfidence: 'high',
      bodyweightKg: null,
      splitCanonical: 'push',
      splitRaw: null,
      blockId: null,
      sourceNoteId: '',
      createdAt: `${date}T10:00:00.000Z`,
      exercises: [
        {
          exerciseId,
          rawName: 'Bench',
          unit: 'kg',
          sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, isWarmup: s.isWarmup, raw: '' })),
        },
      ],
    };
  }

  it('returns the working sets from the most recent session with that exercise', () => {
    const ws = [
      workout('w1', '2026-06-01', 'barbell-bench-press', [{ weightKg: 100, reps: 5 }]),
      workout('w2', '2026-06-08', 'barbell-bench-press', [
        { weightKg: 105, reps: 5 },
        { weightKg: 105, reps: 4 },
      ]),
    ];
    expect(previousSetsFor(ws, 'barbell-bench-press')).toEqual([
      { weightKg: 105, reps: 5 },
      { weightKg: 105, reps: 4 },
    ]);
  });

  it('excludes warm-ups so indexes line up with working sets', () => {
    const ws = [
      workout('w1', '2026-06-08', 'barbell-bench-press', [
        { weightKg: 40, reps: 8, isWarmup: true },
        { weightKg: 100, reps: 5 },
      ]),
    ];
    expect(previousSetsFor(ws, 'barbell-bench-press')).toEqual([{ weightKg: 100, reps: 5 }]);
  });

  it('picks the latest by date even if order is shuffled', () => {
    const ws = [
      workout('w2', '2026-06-08', 'barbell-bench-press', [{ weightKg: 110, reps: 3 }]),
      workout('w1', '2026-06-01', 'barbell-bench-press', [{ weightKg: 100, reps: 5 }]),
    ];
    expect(previousSetsFor(ws, 'barbell-bench-press')).toEqual([{ weightKg: 110, reps: 3 }]);
  });

  it('returns [] when the exercise was never logged', () => {
    expect(previousSetsFor([], 'barbell-bench-press')).toEqual([]);
  });
});

describe('session / routine builders', () => {
  it('makeEmptySession has no exercises and an ISO startedAt', () => {
    const s = makeEmptySession();
    expect(s.exercises).toEqual([]);
    expect(s.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(s.routineId).toBeNull();
  });

  it('sessionFromRoutine seeds targetSets empty rows per exercise + carries rest + routineId', () => {
    const routine: Routine = {
      id: 'r1',
      name: 'Push',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      exercises: [
        { exerciseId: 'barbell-bench-press', rawName: 'Bench', targetSets: 3, targetReps: 5, restSeconds: 150 },
        { exerciseId: 'overhead-press', rawName: 'OHP', targetSets: 1 },
      ],
    };
    const s = sessionFromRoutine(routine);
    expect(s.routineId).toBe('r1');
    expect(s.exercises).toHaveLength(2);
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].restSeconds).toBe(150);
    expect(s.exercises[0].sets.every((set) => set.done === false && set.weightKg === null)).toBe(true);
    expect(s.exercises[1].sets).toHaveLength(1);
  });

  it('routineFromSession derives targetSets from set count and targetReps from the modal reps', () => {
    const session: ActiveSession = {
      id: 's',
      startedAt: '2026-06-23T08:00:00.000Z',
      exercises: [
        {
          id: 'ae',
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench',
          unit: 'kg',
          restSeconds: 120,
          sets: [set({ reps: 5 }), set({ reps: 5 }), set({ reps: 8 })],
        },
      ],
    };
    const r = routineFromSession(session, '  Custom Push  ');
    expect(r.name).toBe('Custom Push');
    expect(r.exercises[0].targetSets).toBe(3);
    expect(r.exercises[0].targetReps).toBe(5); // 5 appears twice
    expect(r.exercises[0].restSeconds).toBe(120);
  });
});

describe('summarizeSession', () => {
  it('counts only done sets, splits warm-ups, sums working volume', () => {
    const session: ActiveSession = {
      id: 's',
      startedAt: '2026-06-23T08:00:00.000Z',
      exercises: [
        {
          id: 'ae1',
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench',
          unit: 'kg',
          sets: [
            set({ weightKg: 40, reps: 8, isWarmup: true, done: true }),
            set({ weightKg: 100, reps: 5, done: true }),
            set({ weightKg: 100, reps: 5, done: true }),
            set({ weightKg: 100, reps: 5, done: false }), // not done → ignored
          ],
        },
        {
          id: 'ae2',
          exerciseId: 'overhead-press',
          rawName: 'OHP',
          unit: 'kg',
          sets: [set({ done: false })], // no done sets → exercise excluded
        },
      ],
    };
    expect(summarizeSession(session)).toEqual({
      exercises: 1,
      workingSets: 2,
      warmupSets: 1,
      totalVolumeKg: 1000, // 100*5 + 100*5
    });
  });

  it('is all-zero for an empty session', () => {
    expect(summarizeSession(makeEmptySession())).toEqual({
      exercises: 0,
      workingSets: 0,
      warmupSets: 0,
      totalVolumeKg: 0,
    });
  });
});

describe('workingSetNumber', () => {
  it('numbers working sets, skipping warm-ups (which return null)', () => {
    const sets = [set({ isWarmup: true }), set(), set(), set({ isWarmup: true }), set()];
    expect(workingSetNumber(sets, 0)).toBeNull(); // warm-up
    expect(workingSetNumber(sets, 1)).toBe(1);
    expect(workingSetNumber(sets, 2)).toBe(2);
    expect(workingSetNumber(sets, 3)).toBeNull(); // warm-up
    expect(workingSetNumber(sets, 4)).toBe(3);
  });
});

describe('plate presets', () => {
  it('adds a named preset with plates sorted descending', () => {
    const next = addPlatePreset(undefined, '  Home gym  ', [5, 25, 10], 'p1');
    expect(next).toEqual([{ id: 'p1', name: 'Home gym', plates: [25, 10, 5] }]);
  });

  it('ignores blank names', () => {
    expect(addPlatePreset([], '   ', [25], 'p1')).toEqual([]);
  });

  it('deletes a preset by id', () => {
    const presets = [
      { id: 'a', name: 'A', plates: [25] },
      { id: 'b', name: 'B', plates: [20] },
    ];
    expect(deletePlatePreset(presets, 'a')).toEqual([{ id: 'b', name: 'B', plates: [20] }]);
  });

  it('returns sorted plates when applying a preset', () => {
    expect(platesFromPreset({ id: 'x', name: 'X', plates: [2.5, 25, 10] })).toEqual([25, 10, 2.5]);
  });
});

describe('groupExercisesForRender', () => {
  it('groups consecutive exercises sharing a supersetGroup', () => {
    const exercises = [
      { id: '1', exerciseId: 'a', rawName: 'A', unit: 'kg' as const, sets: [], supersetGroup: 'g1' },
      { id: '2', exerciseId: 'b', rawName: 'B', unit: 'kg' as const, sets: [], supersetGroup: 'g1' },
      { id: '3', exerciseId: 'c', rawName: 'C', unit: 'kg' as const, sets: [] },
    ];
    expect(groupExercisesForRender(exercises)).toEqual([
      { supersetGroup: 'g1', exercises: [exercises[0], exercises[1]] },
      { exercises: [exercises[2]] },
    ]);
  });
});
