import Dexie, { type EntityTable } from 'dexie';
import type {
  ActiveSession,
  AppSettings,
  ExerciseDef,
  Program,
  RawNote,
  Routine,
  Workout,
} from '@/types/models';

/**
 * RepLog's local persistence (IndexedDB via Dexie).
 *
 * Workouts/notes/customExercises are documents keyed by their string `id`.
 * The v1.1 logger adds three more (additive — v1 tables are untouched):
 *  - `activeSession`: at most one row, key 'current' — the in-progress workout.
 *  - `routines`: reusable templates, keyed by id.
 *  - `settings`: a single row, key 'app' — bar/plate/rest/unit preferences.
 *
 * `activeSession`/`settings` use an explicit string primary key (`id`) so they
 * can be addressed by a stable constant rather than auto-generated keys.
 */
export class RepLogDB extends Dexie {
  notes!: EntityTable<RawNote, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  customExercises!: EntityTable<ExerciseDef, 'id'>;
  activeSession!: EntityTable<ActiveSession & { id: string }, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  settings!: EntityTable<AppSettings & { id: string }, 'id'>;
  programs!: EntityTable<Program, 'id'>;

  constructor() {
    super('replog');
    this.version(1).stores({
      notes: 'id, status, importedAt',
      workouts: 'id, date, splitCanonical, blockId, sourceNoteId',
      customExercises: 'id',
    });
    // v2 (additive): live logger tables. Existing tables are re-declared
    // unchanged so Dexie keeps them; the three new ones are created on upgrade.
    this.version(2).stores({
      notes: 'id, status, importedAt',
      workouts: 'id, date, splitCanonical, blockId, sourceNoteId',
      customExercises: 'id',
      activeSession: 'id',
      routines: 'id, updatedAt',
      settings: 'id',
    });
    // v3 (additive): program generator table. Existing tables re-declared unchanged.
    this.version(3).stores({
      notes: 'id, status, importedAt',
      workouts: 'id, date, splitCanonical, blockId, sourceNoteId',
      customExercises: 'id',
      activeSession: 'id',
      routines: 'id, updatedAt',
      settings: 'id',
      programs: 'id, updatedAt',
    });
  }
}

export const db = new RepLogDB();

/** Stable single-row keys for the singleton tables. */
export const ACTIVE_SESSION_KEY = 'current';
export const SETTINGS_KEY = 'app';
