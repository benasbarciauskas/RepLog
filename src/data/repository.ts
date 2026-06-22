import type { ExerciseDef, RawNote, Workout } from '@/types/models';
import { db } from './db';

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
  clearAll(): Promise<void>;
}

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

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.notes, db.workouts, db.customExercises, async () => {
      await Promise.all([
        db.notes.clear(),
        db.workouts.clear(),
        db.customExercises.clear(),
      ]);
    });
  }
}

/** Default shared instance used across the app. */
export const repository: Repository = new LocalRepository();
