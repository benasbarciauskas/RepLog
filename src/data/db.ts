import Dexie, { type EntityTable } from 'dexie';
import type { ExerciseDef, RawNote, Workout } from '@/types/models';

/**
 * RepLog's local persistence (IndexedDB via Dexie).
 *
 * Three tables, all keyed by their string `id`. Workouts are stored as a
 * single document (exercises/sets nested) — querying is done in memory by the
 * analytics/coach layers, so we only need a primary index plus `date` for
 * cheap chronological ordering.
 */
export class RepLogDB extends Dexie {
  notes!: EntityTable<RawNote, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  customExercises!: EntityTable<ExerciseDef, 'id'>;

  constructor() {
    super('replog');
    this.version(1).stores({
      notes: 'id, status, importedAt',
      workouts: 'id, date, splitCanonical, blockId, sourceNoteId',
      customExercises: 'id',
    });
  }
}

export const db = new RepLogDB();
