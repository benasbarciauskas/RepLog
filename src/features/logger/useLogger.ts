import { useCallback, useEffect, useRef, useState } from 'react';
import { repository } from '@/data/repository';
import { useActiveSession } from '@/data/hooks';
import type { ActiveExercise, ActiveSession, ActiveSet } from '@/types/models';
import { makeActiveExercise, makeEmptySet, restDeadlineFrom } from './lib';

/**
 * The active session, plus the persisted rest-timer deadline. The deadline is a
 * logger-local field that rides along in the stored session object (Dexie keeps
 * extra keys), so a refresh resumes the running rest timer — WITHOUT changing
 * the typed `ActiveSession` contract owned by the data layer.
 */
export type LoggerSession = ActiveSession & { restDeadlineMs?: number | null };

/** Persist debounce — frequent edits coalesce into one write. */
const SAVE_DEBOUNCE_MS = 250;

/**
 * Owns all live-session mutations + persistence. Reads the session live via
 * `useActiveSession()` and mirrors it into local state for snappy, optimistic
 * edits, debouncing the IndexedDB write so every keystroke doesn't thrash disk.
 * The persisted object is the single source of truth for resumability (§1.7).
 */
export function useLogger() {
  const live = useActiveSession() as LoggerSession | undefined;
  const [session, setSession] = useState<LoggerSession | undefined>(live);
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // Adopt the live value whenever it changes AND we have no pending local edit
  // (so an external clear/finish, or the initial load, syncs in without
  // clobbering an in-flight optimistic edit).
  useEffect(() => {
    if (!dirty.current) setSession(live);
  }, [live]);

  const flush = useCallback((next: LoggerSession) => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      dirty.current = false;
      void repository.saveActiveSession(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Apply an optimistic update, then schedule a debounced persist.
  const update = useCallback(
    (mut: (s: LoggerSession) => LoggerSession) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = mut(prev);
        dirty.current = true;
        flush(next);
        return next;
      });
    },
    [flush],
  );

  // Persist immediately (used for destructive / navigation-adjacent actions).
  const persistNow = useCallback(async (next: LoggerSession) => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    dirty.current = false;
    await repository.saveActiveSession(next);
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  // --- session lifecycle ---------------------------------------------------

  const start = useCallback(
    async (seed: LoggerSession) => {
      dirty.current = false;
      setSession(seed);
      await repository.saveActiveSession(seed);
    },
    [],
  );

  const discard = useCallback(async () => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    dirty.current = false;
    setSession(undefined);
    await repository.clearActiveSession();
  }, []);

  // --- exercise mutations --------------------------------------------------

  const addExercise = useCallback(
    (exerciseId: string, rawName: string, restSeconds?: number) =>
      update((s) => ({
        ...s,
        exercises: [...s.exercises, makeActiveExercise(exerciseId, rawName, { restSeconds })],
      })),
    [update],
  );

  const removeExercise = useCallback(
    (exId: string) =>
      update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== exId) })),
    [update],
  );

  const moveExercise = useCallback(
    (exId: string, dir: -1 | 1) =>
      update((s) => {
        const idx = s.exercises.findIndex((e) => e.id === exId);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= s.exercises.length) return s;
        const next = [...s.exercises];
        [next[idx], next[to]] = [next[to], next[idx]];
        return { ...s, exercises: next };
      }),
    [update],
  );

  const patchExercise = useCallback(
    (exId: string, patch: Partial<ActiveExercise>) =>
      update((s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)),
      })),
    [update],
  );

  // --- set mutations -------------------------------------------------------

  const mapSets = (
    s: LoggerSession,
    exId: string,
    fn: (sets: ActiveSet[]) => ActiveSet[],
  ): LoggerSession => ({
    ...s,
    exercises: s.exercises.map((e) => (e.id === exId ? { ...e, sets: fn(e.sets) } : e)),
  });

  const addSet = useCallback(
    (exId: string) =>
      update((s) =>
        mapSets(s, exId, (sets) => {
          // Carry the last set's weight/reps as a sensible starting point.
          const last = sets[sets.length - 1];
          const seed = makeEmptySet();
          if (last) {
            seed.weightKg = last.weightKg;
            seed.reps = last.reps;
          }
          return [...sets, seed];
        }),
      ),
    [update],
  );

  const removeSet = useCallback(
    (exId: string, setId: string) =>
      update((s) => mapSets(s, exId, (sets) => sets.filter((x) => x.id !== setId))),
    [update],
  );

  const patchSet = useCallback(
    (exId: string, setId: string, patch: Partial<ActiveSet>) =>
      update((s) => mapSets(s, exId, (sets) => sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)))),
    [update],
  );

  // --- rest timer (deadline persisted in session) --------------------------

  /** Toggle a set done; on becoming done, auto-start the rest timer. */
  const toggleDone = useCallback(
    (exId: string, setId: string, restSeconds: number) =>
      update((s) => {
        let nowDone = false;
        const next = mapSets(s, exId, (sets) =>
          sets.map((x) => {
            if (x.id !== setId) return x;
            nowDone = !x.done;
            return { ...x, done: nowDone };
          }),
        );
        // Only (re)start rest when a set transitions to done.
        if (nowDone) {
          return { ...next, restDeadlineMs: restDeadlineFrom(Date.now(), restSeconds) };
        }
        return next;
      }),
    [update],
  );

  const setRestDeadline = useCallback(
    (deadlineMs: number | null) => update((s) => ({ ...s, restDeadlineMs: deadlineMs })),
    [update],
  );

  const clearRest = useCallback(() => setRestDeadline(null), [setRestDeadline]);

  return {
    session,
    // lifecycle
    start,
    discard,
    persistNow,
    // exercises
    addExercise,
    removeExercise,
    moveExercise,
    patchExercise,
    // sets
    addSet,
    removeSet,
    patchSet,
    toggleDone,
    // rest
    setRestDeadline,
    clearRest,
  };
}
