import { useCallback, useEffect, useRef, useState } from 'react';

import {
  makeActiveExercise,
  makeEmptySet,
  restDeadlineFrom,
} from '@core/features/logger/lib';
import type { ActiveExercise, ActiveSession, ActiveSet } from '@core/types/models';

import { repository } from '@/data/sqliteRepository';
import { refreshData, useActiveSession } from '@/hooks/useData';

export type LoggerSession = ActiveSession & { restDeadlineMs?: number | null };

const SAVE_DEBOUNCE_MS = 250;

export function useLogger() {
  const live = useActiveSession() as LoggerSession | undefined;
  const [session, setSession] = useState<LoggerSession | undefined>(live);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty.current) setSession(live);
  }, [live]);

  const flush = useCallback((next: LoggerSession) => {
    if (saveTimer.current != null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirty.current = false;
      void repository.saveActiveSession(next).then(() => refreshData());
    }, SAVE_DEBOUNCE_MS);
  }, []);

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

  const persistNow = useCallback(async (next: LoggerSession) => {
    if (saveTimer.current != null) clearTimeout(saveTimer.current);
    dirty.current = false;
    await repository.saveActiveSession(next);
    refreshData();
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current != null) clearTimeout(saveTimer.current);
    },
    [],
  );

  const start = useCallback(async (seed: LoggerSession) => {
    dirty.current = false;
    setSession(seed);
    await repository.saveActiveSession(seed);
    refreshData();
  }, []);

  const discard = useCallback(async () => {
    if (saveTimer.current != null) clearTimeout(saveTimer.current);
    dirty.current = false;
    setSession(undefined);
    await repository.clearActiveSession();
    refreshData();
  }, []);

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
      update((s) =>
        mapSets(s, exId, (sets) => sets.map((x) => (x.id === setId ? { ...x, ...patch } : x))),
      ),
    [update],
  );

  const toggleDone = useCallback(
    (exId: string, setId: string, restSeconds: number, prefill?: Partial<ActiveSet>) =>
      update((s) => {
        let nowDone = false;
        const next = mapSets(s, exId, (sets) =>
          sets.map((x) => {
            if (x.id !== setId) return x;
            nowDone = !x.done;
            return { ...x, ...prefill, done: nowDone };
          }),
        );
        if (nowDone) {
          return { ...next, restDeadlineMs: restDeadlineFrom(Date.now(), restSeconds) };
        }
        return next;
      }),
    [update],
  );

  const clearRest = useCallback(
    () => update((s) => ({ ...s, restDeadlineMs: null })),
    [update],
  );

  return {
    session,
    start,
    discard,
    persistNow,
    addExercise,
    removeExercise,
    addSet,
    removeSet,
    patchSet,
    toggleDone,
    clearRest,
  };
}