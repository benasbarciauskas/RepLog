import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { computeBests } from '@core/analytics/bests';
import { analyzeImbalances } from '@core/coach/analyze';
import { balanceScore, type BalanceScore } from '@core/coach/score';
import type {
  ActiveSession,
  AppSettings,
  CoachFinding,
  ExerciseBest,
  ExerciseDef,
  Routine,
  Workout,
} from '@core/types/models';

import { DEFAULT_SETTINGS, repository } from '@/data/sqliteRepository';

// ---------------------------------------------------------------------------
// Pub/sub — dependency-free reactive reloads (no dexie-react-hooks on RN).
// ---------------------------------------------------------------------------

let dataVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return dataVersion;
}

/** Bump the global data version so all `useRepoData` hooks re-fetch. */
export function refreshData(): void {
  dataVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface RepoDataState<T> {
  data: T | undefined;
  loading: boolean;
  refresh: () => void;
}

/**
 * Async loader hook keyed off the global `dataVersion` counter.
 * Call `refreshData()` (or the returned `refresh`) after repository writes.
 */
export function useRepoData<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): RepoDataState<T> {
  const version = useDataVersion();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    refreshData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loader().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version + caller deps drive reloads
  }, [version, ...deps]);

  return { data, loading, refresh };
}

// ---------------------------------------------------------------------------
// Concrete hooks — mirror web `src/data/hooks.ts` shapes against sqlite.
// ---------------------------------------------------------------------------

/** Live list of all stored workouts, ordered by date ascending. */
export function useWorkouts(): Workout[] {
  const { data } = useRepoData(
    async () => {
      const workouts = await repository.getWorkouts();
      return [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    },
    [],
  );
  return data ?? [];
}

/** Live logger settings, falling back to defaults until/unless persisted. */
export function useSettings(): AppSettings {
  const { data } = useRepoData(() => repository.getSettings(), []);
  return data ?? DEFAULT_SETTINGS;
}

/**
 * The in-progress workout. `undefined` means either still loading or no active session.
 */
export function useActiveSession(): ActiveSession | undefined {
  const { data } = useRepoData(() => repository.getActiveSession(), []);
  return data;
}

/** Live list of saved routines, most-recently-updated first. */
export function useRoutines(): Routine[] {
  const { data } = useRepoData(
    async () => {
      const routines = await repository.getRoutines();
      return [...routines].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    [],
  );
  return data ?? [];
}

/** Live list of user-defined custom exercises. */
export function useCustomExercises(): ExerciseDef[] {
  const { data } = useRepoData(() => repository.getCustomExercises(), []);
  return data ?? [];
}

/** All-time bests derived live from stored workouts. Recomputes on data change. */
export function useBests(): ExerciseBest[] {
  const workouts = useWorkouts();
  return useMemo(() => computeBests(workouts), [workouts]);
}

/** Strength-imbalance coach findings (priority → flag → ok), live from the data. */
export function useCoachFindings(): CoachFinding[] {
  const bests = useBests();
  return useMemo(() => analyzeImbalances(bests), [bests]);
}

export interface CoachState {
  score: BalanceScore;
  findings: CoachFinding[];
}

/** Balance score + coach findings — convenience bundle for Dashboard / Coach screens. */
export function useCoach(): CoachState {
  const bests = useBests();
  return useMemo(
    () => ({
      score: balanceScore(bests),
      findings: analyzeImbalances(bests),
    }),
    [bests],
  );
}