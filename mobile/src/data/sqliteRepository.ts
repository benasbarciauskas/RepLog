import * as SQLite from 'expo-sqlite';

import { newId } from '@core/lib/id';
import type { Repository } from '@core/data/repository';
import type {
  ActiveSession,
  AppSettings,
  ExerciseDef,
  RawNote,
  Routine,
  SplitCanonical,
  Workout,
  WorkoutExercise,
  SetEntry,
} from '@core/types/models';

const SETTINGS_KEY = 'app';
const ACTIVE_SESSION_KEY = 'current';

const EXPORT_APP = 'RepLog';
const EXPORT_VERSION = 1;

/** Default logger preferences (kg, 20 kg bar, standard plate set, 2-min rest). */
const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
  aiModel: 'meta-llama/llama-3.3-70b-instruct:free',
};

type RepLogExportFile = {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    notes?: RawNote[];
    workouts?: Workout[];
    customExercises?: ExerciseDef[];
    routines?: Routine[];
    settings?: (AppSettings & { id: string })[];
  };
};

function todayISO(): string {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function stripSettingsKey(stored: AppSettings & { id: string }): AppSettings {
  return {
    barWeightKg: stored.barWeightKg,
    availablePlatesKg: stored.availablePlatesKg,
    defaultRestSeconds: stored.defaultRestSeconds,
    unit: stored.unit,
    ...(stored.aiApiKey !== undefined ? { aiApiKey: stored.aiApiKey } : {}),
    ...(stored.aiModel !== undefined ? { aiModel: stored.aiModel } : {}),
  };
}

class SqliteRepository implements Repository {
  private db = SQLite.openDatabaseSync('replog.db');

  constructor() {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customExercises (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS activeSession (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
    `);
  }

  private getRow<T>(table: string, id: string): T | undefined {
    const row = this.db.getFirstSync<{ data: string }>(
      `SELECT data FROM ${table} WHERE id = ?`,
      [id],
    );
    if (!row) return undefined;
    return JSON.parse(row.data) as T;
  }

  private putRow<T extends { id: string }>(table: string, row: T): void {
    this.db.runSync(
      `INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`,
      [row.id, JSON.stringify(row)],
    );
  }

  private listRows<T>(table: string): T[] {
    const rows = this.db.getAllSync<{ data: string }>(`SELECT data FROM ${table}`);
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  private deleteRow(table: string, id: string): void {
    this.db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  private clearTable(table: string): void {
    this.db.runSync(`DELETE FROM ${table}`);
  }

  async addNote(n: RawNote): Promise<void> {
    this.putRow('notes', n);
  }

  async getNotes(): Promise<RawNote[]> {
    throw new Error('not implemented');
  }

  async saveWorkouts(w: Workout[]): Promise<void> {
    for (const workout of w) {
      this.putRow('workouts', workout);
    }
  }

  async getWorkouts(): Promise<Workout[]> {
    return this.listRows<Workout>('workouts');
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.getRow<Workout>('workouts', id);
  }

  async deleteWorkout(id: string): Promise<void> {
    throw new Error('not implemented');
  }

  async getCustomExercises(): Promise<ExerciseDef[]> {
    return this.listRows<ExerciseDef>('customExercises');
  }

  async addCustomExercise(d: ExerciseDef): Promise<void> {
    this.putRow('customExercises', d);
  }

  async getActiveSession(): Promise<ActiveSession | undefined> {
    return this.getRow<ActiveSession>('activeSession', ACTIVE_SESSION_KEY);
  }

  async saveActiveSession(s: ActiveSession): Promise<void> {
    this.putRow('activeSession', { ...s, id: ACTIVE_SESSION_KEY });
  }

  async clearActiveSession(): Promise<void> {
    this.deleteRow('activeSession', ACTIVE_SESSION_KEY);
  }

  async finishActiveSession(meta?: {
    bodyweightKg?: number | null;
    splitCanonical?: SplitCanonical;
  }): Promise<Workout | undefined> {
    const session = await this.getActiveSession();
    if (!session) return undefined;

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
      bodyweightKg: meta?.bodyweightKg ?? session.bodyweightKg ?? null,
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
    return this.listRows<Routine>('routines');
  }

  async saveRoutine(r: Routine): Promise<void> {
    throw new Error('not implemented');
  }

  async deleteRoutine(id: string): Promise<void> {
    throw new Error('not implemented');
  }

  async getSettings(): Promise<AppSettings> {
    const stored = this.getRow<AppSettings & { id: string }>('settings', SETTINGS_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    return stripSettingsKey(stored);
  }

  async saveSettings(s: AppSettings): Promise<void> {
    this.putRow('settings', { ...s, id: SETTINGS_KEY });
  }

  async exportData(): Promise<Blob> {
    const [notes, workouts, customExercises, routines, settings] = await Promise.all([
      this.listRows<RawNote>('notes'),
      this.getWorkouts(),
      this.getCustomExercises(),
      this.getRoutines(),
      this.listRows<AppSettings & { id: string }>('settings'),
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
      data: { notes, workouts, customExercises, routines, settings: safeSettings },
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

    if (data.notes !== undefined) {
      if (!Array.isArray(data.notes)) throw new Error('Invalid backup: "notes" must be an array');
      this.clearTable('notes');
      for (const note of data.notes) this.putRow('notes', note);
    }
    if (data.workouts !== undefined) {
      if (!Array.isArray(data.workouts)) throw new Error('Invalid backup: "workouts" must be an array');
      this.clearTable('workouts');
      for (const workout of data.workouts) this.putRow('workouts', workout);
    }
    if (data.customExercises !== undefined) {
      if (!Array.isArray(data.customExercises)) {
        throw new Error('Invalid backup: "customExercises" must be an array');
      }
      this.clearTable('customExercises');
      for (const exercise of data.customExercises) this.putRow('customExercises', exercise);
    }
    if (data.routines !== undefined) {
      if (!Array.isArray(data.routines)) throw new Error('Invalid backup: "routines" must be an array');
      this.clearTable('routines');
      for (const routine of data.routines) this.putRow('routines', routine);
    }
    if (data.settings !== undefined) {
      if (!Array.isArray(data.settings)) throw new Error('Invalid backup: "settings" must be an array');
      this.clearTable('settings');
      for (const setting of data.settings) this.putRow('settings', setting);
    }
  }

  async clearAll(): Promise<void> {
    throw new Error('not implemented');
  }
}

export const repository: Repository = new SqliteRepository();