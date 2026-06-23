import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createCatalog } from '@/parser/catalog';
import { db } from '@/data/db';

/** Resolve a catalog/custom/unknown exerciseId to a display name. */
export function useExerciseName(): (exerciseId: string) => string {
  const custom = useLiveQuery(() => db.customExercises.toArray(), [], []);
  const catalog = useMemo(() => createCatalog(custom), [custom]);
  return useMemo(() => {
    const byId = new Map(catalog.all().map((d) => [d.id, d.canonicalName]));
    return (exerciseId: string): string => {
      const known = byId.get(exerciseId);
      if (known) return known;
      const slug = exerciseId.replace(/^(unknown|custom):/, '').replace(/[-_]/g, ' ');
      return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || exerciseId;
    };
  }, [catalog]);
}