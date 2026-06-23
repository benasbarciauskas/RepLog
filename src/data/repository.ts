import type {
  ActiveSession,
  AppSettings,
  ExerciseDef,
  Program,
  RawNote,
  Routine,
  SetEntry,
  SplitCanonical,
  Workout,
  WorkoutExercise,
} from '@/types/models';
import { newId } from '@/lib/id';
import { ACTIVE_SESSION_KEY, db, SETTINGS_KEY } from './db';

/** Default logger preferences (kg, 20 kg bar, standard plate set, 2-min rest). */
export const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
  aiModel: 'meta-llama/llama-3.3-70b-instruct:free',
};

/** Today's date as an ISO `yyyy-mm-dd` string (local time). */
function todayISO(): string {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

/** Drop the storage-only singleton `id` key, returning the plain settings shape. */
export function stripSettingsKey(stored: AppSettings & { id: string }): AppSettings {
  return {
    barWeightKg: stored.barWeightKg,
    availablePlatesKg: stored.availablePlatesKg,
    defaultRestSeconds: stored.defaultRestSeconds,
    unit: stored.unit,
    ...(stored.aiApiKey !== undefined ? { aiApiKey: stored.aiApiKey } : {}),
    ...(stored.aiModel !== undefined ? { aiModel: stored.aiModel } : {}),
  };
}

/**
 * Storage seam. The app talks only to this interface so a future cloud-sync /
 * WebLLM backend can be dropped in without touching feature code.
 */
export interface Repository {
  addNote(n: RawNote): Promise<void>;
  getNotes(): Promise<RawNote[]>;
  saveWorkouts(w: Workout[]): Promise<void>;
  getWorkouts(): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  deleteWorkout(id: string): Promise<void>;
  getCustomExercises(): Promise<ExerciseDef[]>;
  addCustomExercise(d: ExerciseDef): Promise<void>;

  // --- v1.1 live logger ----------------------------------------------------
  getActiveSession(): Promise<ActiveSession | undefined>;
  saveActiveSession(s: ActiveSession): Promise<void>;
  clearActiveSession(): Promise<void>;
  /**
   * Convert the active session's `done` sets into a saved `Workout`, persist it,
   * then clear the active session. Returns the created Workout. Resolves to
   * `undefined` only if there is no active session.
   */
  finishActiveSession(meta?: {
    bodyweightKg?: number | null;
    splitCanonical?: SplitCanonical;
  }): Promise<Workout | undefined>;

  getRoutines(): Promise<Routine[]>;
  saveRoutine(r: Routine): Promise<void>;
  deleteRoutine(id: string): Promise<void>;

  getSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;

  getActiveProgram(): Promise<Program | undefined>;
  saveProgram(p: Program): Promise<void>;
  deleteProgram(id: string): Promise<void>;

  exportData(): Promise<Blob>;
  importData(json: string | object): Promise<void>;

  clearAll(): Promise<void>;
}

const EXPORT_APP = 'RepLog';
const EXPORT_VERSION = 1;

/** On-disk backup shape (v1). `activeSession` is intentionally excluded. */
export type RepLogExportFile = {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    notes?: RawNote[];
    workouts?: Workout[];
    customExercises?: ExerciseDef[];
    routines?: Routine[];
    settings?: (AppSettings & { id: string })[];
    programs?: Program[];
  };
};

/** Dexie/IndexedDB-backed implementation. */
export class LocalRepository implements Repository {
  async addNote(n: RawNote): Promise<void> {
    await db.notes.put(n);
  }

  async getNotes(): Promise<RawNote[]> {
    return db.notes.toArray();
  }

  async saveWorkouts(w: Workout[]): Promise<void> {
    await db.workouts.bulkPut(w);
  }

  async getWorkouts(): Promise<Workout[]> {
    return db.workouts.toArray();
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return db.workouts.get(id);
  }

  async deleteWorkout(id: string): Promise<void> {
    await db.workouts.delete(id);
  }

  async getCustomExercises(): Promise<ExerciseDef[]> {
    return db.customExercises.toArray();
  }

  async addCustomExercise(d: ExerciseDef): Promise<void> {
    await db.customExercises.put(d);
  }

  // --- v1.1 live logger ----------------------------------------------------

  async getActiveSession(): Promise<ActiveSession | undefined> {
    return db.activeSession.get(ACTIVE_SESSION_KEY);
  }

  async saveActiveSession(s: ActiveSession): Promise<void> {
    // Persist under the stable singleton key regardless of the session's own id.
    await db.activeSession.put({ ...s, id: ACTIVE_SESSION_KEY });
  }

  async clearActiveSession(): Promise<void> {
    await db.activeSession.delete(ACTIVE_SESSION_KEY);
  }

  async finishActiveSession(meta?: {
    bodyweightKg?: number | null;
    splitCanonical?: SplitCanonical;
  }): Promise<Workout | undefined> {
    const session = await this.getActiveSession();
    if (!session) return undefined;

    // Only `done` sets are saved; an exercise with no done sets is dropped.
    const exercises: WorkoutExercise[] = session.exercises
      .map((ex): WorkoutExercise => {
        const sets: SetEntry[] = ex.sets
          .filter((s) => s.done)
          .map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps ?? 0,
            rpe: s.rpe ?? null,
            isWarmup: s.isWarmup,
            raw: '',
          }));
        return {
          exerciseId: ex.exerciseId,
          rawName: ex.rawName,
          unit: ex.unit,
          sets,
        };
      })
      .filter((ex) => ex.sets.length > 0);

    const workout: Workout = {
      id: newId(),
      date: todayISO(),
      dateConfidence: 'high',
      bodyweightKg:
        meta?.bodyweightKg ?? session.bodyweightKg ?? null,
      splitCanonical: meta?.splitCanonical ?? session.splitCanonical ?? 'unknown',
      splitRaw: null,
      blockId: null,
      sourceNoteId: '',
      exercises,
      createdAt: new Date().toISOString(),
    };

    await this.saveWorkouts([workout]);
    await this.clearActiveSession();
    return workout;
  }

  async getRoutines(): Promise<Routine[]> {
    return db.routines.toArray();
  }

  async saveRoutine(r: Routine): Promise<void> {
    await db.routines.put(r);
  }

  async deleteRoutine(id: string): Promise<void> {
    await db.routines.delete(id);
  }

  async getSettings(): Promise<AppSettings> {
    const stored = await db.settings.get(SETTINGS_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    return stripSettingsKey(stored);
  }

  async saveSettings(s: AppSettings): Promise<void> {
    await db.settings.put({ ...s, id: SETTINGS_KEY });
  }

  async getActiveProgram(): Promise<Program | undefined> {
    const programs = await db.programs.orderBy('updatedAt').reverse().toArray();
    return programs[0];
  }

  async saveProgram(p: Program): Promise<void> {
    await db.programs.put(p);
  }

  async deleteProgram(id: string): Promise<void> {
    await db.programs.delete(id);
  }

  async exportData(): Promise<Blob> {
    const [notes, workouts, customExercises, routines, settings, programs] = await Promise.all([
      db.notes.toArray(),
      db.workouts.toArray(),
      db.customExercises.toArray(),
      db.routines.toArray(),
      db.settings.toArray(),
      db.programs.toArray(),
    ]);

    const safeSettings = settings.map((s) => {
      const rest = { ...s };
      delete rest.aiApiKey;
      return rest;
    });

    const payload: RepLogExportFile = {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data: { notes, workouts, customExercises, routines, settings: safeSettings, programs },
    };

    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  async importData(json: string | object): Promise<void> {
    const parsed: RepLogExportFile =
      typeof json === 'string' ? (JSON.parse(json) as RepLogExportFile) : (json as RepLogExportFile);

    if (parsed.app !== EXPORT_APP) {
      throw new Error('Not a RepLog backup file');
    }

    const data = parsed.data ?? {};
    const importTables = [
      db.notes,
      db.workouts,
      db.customExercises,
      db.routines,
      db.settings,
      db.programs,
    ];

    await db.transaction('rw', importTables, async () => {
      if (data.notes !== undefined) {
        if (!Array.isArray(data.notes)) throw new Error('Invalid backup: "notes" must be an array');
        await db.notes.clear();
        if (data.notes.length > 0) await db.notes.bulkPut(data.notes);
      }
      if (data.workouts !== undefined) {
        if (!Array.isArray(data.workouts)) throw new Error('Invalid backup: "workouts" must be an array');
        await db.workouts.clear();
        if (data.workouts.length > 0) await db.workouts.bulkPut(data.workouts);
      }
      if (data.customExercises !== undefined) {
        if (!Array.isArray(data.customExercises)) {
          throw new Error('Invalid backup: "customExercises" must be an array');
        }
        await db.customExercises.clear();
        if (data.customExercises.length > 0) await db.customExercises.bulkPut(data.customExercises);
      }
      if (data.routines !== undefined) {
        if (!Array.isArray(data.routines)) throw new Error('Invalid backup: "routines" must be an array');
        await db.routines.clear();
        if (data.routines.length > 0) await db.routines.bulkPut(data.routines);
      }
      if (data.settings !== undefined) {
        if (!Array.isArray(data.settings)) throw new Error('Invalid backup: "settings" must be an array');
        await db.settings.clear();
        if (data.settings.length > 0) await db.settings.bulkPut(data.settings);
      }
      if (data.programs !== undefined) {
        if (!Array.isArray(data.programs)) throw new Error('Invalid backup: "programs" must be an array');
        await db.programs.clear();
        if (data.programs.length > 0) await db.programs.bulkPut(data.programs);
      }
    });
  }

  async clearAll(): Promise<void> {
    // Array form of the table list — the variadic overload caps at 6 tables.
    const tables = [
      db.notes,
      db.workouts,
      db.customExercises,
      db.activeSession,
      db.routines,
      db.settings,
      db.programs,
    ];
    await db.transaction('rw', tables, async () => {
      await Promise.all(tables.map((t) => t.clear()));
    });
  }
}

/** Default shared instance used across the app. */
export const repository: Repository = new LocalRepository();
