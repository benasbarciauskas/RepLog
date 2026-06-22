import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { DEFAULT_SETTINGS, LocalRepository } from '../repository';
import type {
  ActiveSession,
  ActiveSet,
  AppSettings,
  Routine,
} from '@/types/models';

const repo = new LocalRepository();

function makeSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    id: 's1',
    weightKg: 100,
    reps: 5,
    rpe: null,
    isWarmup: false,
    done: true,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: 'sess-1',
    startedAt: '2026-06-23T08:00:00.000Z',
    routineId: null,
    bodyweightKg: 87,
    splitCanonical: 'push',
    exercises: [
      {
        id: 'ae1',
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench Press',
        unit: 'kg',
        restSeconds: 120,
        sets: [
          makeSet({ id: 's1', weightKg: 100, reps: 5, done: true }),
          makeSet({ id: 's2', weightKg: 100, reps: 4, done: true }),
          makeSet({ id: 's3', weightKg: 100, reps: null, done: false }),
        ],
      },
    ],
    ...overrides,
  };
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Push Day',
    exercises: [
      { exerciseId: 'barbell-bench-press', rawName: 'Bench Press', targetSets: 3, targetReps: 5 },
      { exerciseId: 'overhead-press', rawName: 'OHP', targetSets: 3, targetReps: 8, restSeconds: 90 },
    ],
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('LocalRepository — active session', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('round-trips an active session: save then get', async () => {
    const session = makeSession();
    await repo.saveActiveSession(session);
    const got = await repo.getActiveSession();
    expect(got).toBeDefined();
    expect(got?.startedAt).toBe(session.startedAt);
    expect(got?.exercises).toHaveLength(1);
    expect(got?.exercises[0].sets).toHaveLength(3);
  });

  it('persists under the singleton key — saving twice keeps one row', async () => {
    await repo.saveActiveSession(makeSession({ id: 'a' }));
    await repo.saveActiveSession(makeSession({ id: 'b', bodyweightKg: 90 }));
    expect(await db.activeSession.count()).toBe(1);
    const got = await repo.getActiveSession();
    expect(got?.bodyweightKg).toBe(90);
  });

  it('clearActiveSession removes the session', async () => {
    await repo.saveActiveSession(makeSession());
    await repo.clearActiveSession();
    expect(await repo.getActiveSession()).toBeUndefined();
  });

  it('getActiveSession is undefined when none exists', async () => {
    expect(await repo.getActiveSession()).toBeUndefined();
  });
});

describe('LocalRepository — finishActiveSession', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('returns undefined when there is no active session', async () => {
    expect(await repo.finishActiveSession()).toBeUndefined();
  });

  it('produces a Workout with only done sets and clears the session', async () => {
    await repo.saveActiveSession(makeSession());
    const workout = await repo.finishActiveSession();

    expect(workout).toBeDefined();
    // Saved + retrievable.
    const all = await repo.getWorkouts();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(workout!.id);

    // Only the two `done` sets survived (the not-done third was dropped).
    expect(workout!.exercises).toHaveLength(1);
    expect(workout!.exercises[0].sets).toHaveLength(2);
    expect(workout!.exercises[0].sets.map((s) => s.reps)).toEqual([5, 4]);

    // Metadata defaults.
    expect(workout!.dateConfidence).toBe('high');
    expect(workout!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(workout!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(workout!.splitCanonical).toBe('push');
    expect(workout!.bodyweightKg).toBe(87);
    expect(workout!.id).toBeTruthy();

    // Session is gone.
    expect(await repo.getActiveSession()).toBeUndefined();
  });

  it('drops exercises whose sets are all not-done', async () => {
    const session = makeSession({
      exercises: [
        {
          id: 'ae1',
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench Press',
          unit: 'kg',
          sets: [makeSet({ id: 's1', done: false }), makeSet({ id: 's2', done: false })],
        },
      ],
    });
    await repo.saveActiveSession(session);
    const workout = await repo.finishActiveSession();
    expect(workout!.exercises).toHaveLength(0);
  });

  it('applies meta overrides for bodyweight and split', async () => {
    await repo.saveActiveSession(makeSession({ bodyweightKg: 87, splitCanonical: 'push' }));
    const workout = await repo.finishActiveSession({ bodyweightKg: 90, splitCanonical: 'pull' });
    expect(workout!.bodyweightKg).toBe(90);
    expect(workout!.splitCanonical).toBe('pull');
  });

  it('falls back to unknown split when none set anywhere', async () => {
    const session = makeSession();
    delete (session as { splitCanonical?: unknown }).splitCanonical;
    await repo.saveActiveSession(session);
    const workout = await repo.finishActiveSession();
    expect(workout!.splitCanonical).toBe('unknown');
  });

  it('carries the optional rpe onto saved sets', async () => {
    const session = makeSession({
      exercises: [
        {
          id: 'ae1',
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench Press',
          unit: 'kg',
          sets: [makeSet({ id: 's1', rpe: 8.5, done: true })],
        },
      ],
    });
    await repo.saveActiveSession(session);
    const workout = await repo.finishActiveSession();
    expect(workout!.exercises[0].sets[0].rpe).toBe(8.5);
  });
});

describe('LocalRepository — routines CRUD', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('save then get round-trips a routine', async () => {
    const r = makeRoutine();
    await repo.saveRoutine(r);
    const all = await repo.getRoutines();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(r);
  });

  it('saveRoutine upserts on the same id (no duplicates)', async () => {
    await repo.saveRoutine(makeRoutine({ name: 'Push Day' }));
    await repo.saveRoutine(makeRoutine({ name: 'Push Day v2' }));
    const all = await repo.getRoutines();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Push Day v2');
  });

  it('deleteRoutine removes only the targeted routine', async () => {
    await repo.saveRoutine(makeRoutine({ id: 'r1' }));
    await repo.saveRoutine(makeRoutine({ id: 'r2', name: 'Pull Day' }));
    await repo.deleteRoutine('r1');
    const all = await repo.getRoutines();
    expect(all.map((r) => r.id)).toEqual(['r2']);
  });
});

describe('LocalRepository — settings', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('returns sensible defaults when none stored', async () => {
    const s = await repo.getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.barWeightKg).toBe(20);
    expect(s.availablePlatesKg).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(s.defaultRestSeconds).toBe(120);
    expect(s.unit).toBe('kg');
  });

  it('save then get round-trips settings (without the storage id leaking)', async () => {
    const custom: AppSettings = {
      barWeightKg: 15,
      availablePlatesKg: [20, 10, 5, 2.5],
      defaultRestSeconds: 90,
      unit: 'lb',
    };
    await repo.saveSettings(custom);
    const got = await repo.getSettings();
    expect(got).toEqual(custom);
    expect((got as unknown as Record<string, unknown>).id).toBeUndefined();
  });
});

describe('LocalRepository — clearAll covers new tables', () => {
  it('clears active session, routines and settings too', async () => {
    await repo.saveActiveSession(makeSession());
    await repo.saveRoutine(makeRoutine());
    await repo.saveSettings({ ...DEFAULT_SETTINGS, barWeightKg: 15 });

    await repo.clearAll();

    expect(await repo.getActiveSession()).toBeUndefined();
    expect(await repo.getRoutines()).toHaveLength(0);
    // Settings revert to defaults (row cleared).
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
