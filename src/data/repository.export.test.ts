import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_KEY, db } from './db';
import { DEFAULT_SETTINGS, LocalRepository } from './repository';
import type { Workout } from '@/types/models';

const repo = new LocalRepository();

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

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
        sets: [{ weightKg: 105, reps: 5, raw: '105x5' }],
      },
    ],
    ...overrides,
  };
}

describe('LocalRepository — export/import', () => {
  beforeEach(async () => {
    await repo.clearAll();
  });

  it('exports all persistent tables and restores them on import', async () => {
    await repo.saveWorkouts([
      makeWorkout({ id: 'wa' }),
      makeWorkout({ id: 'wb', date: '2024-09-02', splitCanonical: 'pull' }),
    ]);
    await repo.saveSettings({ ...DEFAULT_SETTINGS, unit: 'lb', barWeightKg: 45 });

    const blob = await repo.exportData();
    const exported = JSON.parse(await readBlobText(blob));

    expect(exported.app).toBe('RepLog');
    expect(exported.version).toBe(1);
    expect(typeof exported.exportedAt).toBe('string');
    expect(exported.data.workouts).toHaveLength(2);
    expect(exported.data.settings).toHaveLength(1);
    expect(exported.data.settings[0].id).toBe(SETTINGS_KEY);
    expect(exported.data.notes).toEqual([]);
    expect(exported.data.customExercises).toEqual([]);
    expect(exported.data.routines).toEqual([]);
    expect(exported.data).not.toHaveProperty('activeSession');

    await db.transaction('rw', [db.notes, db.workouts, db.customExercises, db.routines, db.settings], async () => {
      await Promise.all([
        db.notes.clear(),
        db.workouts.clear(),
        db.customExercises.clear(),
        db.routines.clear(),
        db.settings.clear(),
      ]);
    });

    expect(await repo.getWorkouts()).toHaveLength(0);

    await repo.importData(exported);

    const workouts = await repo.getWorkouts();
    expect(workouts).toHaveLength(2);
    expect(workouts.map((w) => w.id).sort()).toEqual(['wa', 'wb']);

    const settings = await repo.getSettings();
    expect(settings.unit).toBe('lb');
    expect(settings.barWeightKg).toBe(45);
  });

  it('omits aiApiKey from exported settings', async () => {
    await repo.saveSettings({
      ...DEFAULT_SETTINGS,
      aiApiKey: 'sk-or-secret-should-not-export',
      aiModel: 'meta-llama/llama-3.3-70b-instruct:free',
    });

    const blob = await repo.exportData();
    const exported = JSON.parse(await readBlobText(blob));

    expect(exported.data.settings).toHaveLength(1);
    expect(exported.data.settings[0]).not.toHaveProperty('aiApiKey');
    expect(exported.data.settings[0].aiModel).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });

  it('rejects backups from other apps', async () => {
    await expect(
      repo.importData({ app: 'OtherApp', version: 1, exportedAt: '', data: {} }),
    ).rejects.toThrow('Not a RepLog backup file');
  });
});