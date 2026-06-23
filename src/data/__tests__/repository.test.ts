import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { LocalRepository } from '../repository';
import type { ExerciseDef, RawNote, Workout } from '@/types/models';

const repo = new LocalRepository();

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    date: '2024-08-26',
    dateConfidence: 'high',
    bodyweightKg: 87,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2024-08-26T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Benchpress',
        unit: 'kg',
        sets: [
          { weightKg: 105, reps: 5, raw: '105x5' },
          { weightKg: 105, reps: 4, raw: '4' },
        ],
      },
    ],
    ...overrides,
  };
}

function makeNote(overrides: Partial<RawNote> = {}): RawNote {
  return {
    id: 'n1',
    sourceType: 'paste',
    rawText: 'Benchpress 5x5: 105x 5, 5, 5, 5, 4',
    importedAt: '2024-08-26T09:59:00.000Z',
    status: 'parsed',
    ...overrides,
  };
}

function makeExerciseDef(overrides: Partial<ExerciseDef> = {}): ExerciseDef {
  return {
    id: 'cable-bicep-iso',
    canonicalName: 'Cable Bicep Iso',
    aliases: ['cable bicep isos'],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    ...overrides,
  };
}

describe('LocalRepository', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('round-trips a note: add then get', async () => {
    const note = makeNote();
    await repo.addNote(note);
    const notes = await repo.getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual(note);
  });

  it('round-trips workouts: save then get + getWorkout by id', async () => {
    const a = makeWorkout({ id: 'wa' });
    const b = makeWorkout({ id: 'wb', date: '2024-09-02', splitCanonical: 'pull' });
    await repo.saveWorkouts([a, b]);

    const all = await repo.getWorkouts();
    expect(all).toHaveLength(2);
    expect(all.map((w) => w.id).sort()).toEqual(['wa', 'wb']);

    const got = await repo.getWorkout('wa');
    expect(got).toEqual(a);
    expect(got?.exercises[0].sets[0].weightKg).toBe(105);

    expect(await repo.getWorkout('missing')).toBeUndefined();
  });

  it('saveWorkouts upserts existing ids (no duplicates)', async () => {
    const w = makeWorkout({ id: 'dup', bodyweightKg: 87 });
    await repo.saveWorkouts([w]);
    await repo.saveWorkouts([{ ...w, bodyweightKg: 88 }]);
    const all = await repo.getWorkouts();
    expect(all).toHaveLength(1);
    expect(all[0].bodyweightKg).toBe(88);
  });

  it('deleteWorkout removes only the targeted workout', async () => {
    await repo.saveWorkouts([makeWorkout({ id: 'wa' }), makeWorkout({ id: 'wb' })]);
    await repo.deleteWorkout('wa');
    const all = await repo.getWorkouts();
    expect(all.map((w) => w.id)).toEqual(['wb']);
  });

  it('addCustomExercise then getCustomExercises round-trips', async () => {
    const def = makeExerciseDef();
    await repo.addCustomExercise(def);
    const customs = await repo.getCustomExercises();
    expect(customs).toHaveLength(1);
    expect(customs[0]).toEqual(def);
  });

  it('clearAll empties every table', async () => {
    await repo.addNote(makeNote());
    await repo.saveWorkouts([makeWorkout()]);
    await repo.addCustomExercise(makeExerciseDef());

    await repo.clearAll();

    expect(await repo.getNotes()).toHaveLength(0);
    expect(await repo.getWorkouts()).toHaveLength(0);
    expect(await repo.getCustomExercises()).toHaveLength(0);
  });

  it('exposes the underlying Dexie tables', () => {
    expect(db.notes).toBeDefined();
    expect(db.workouts).toBeDefined();
    expect(db.customExercises).toBeDefined();
  });
});
