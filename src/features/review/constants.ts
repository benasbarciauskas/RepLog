import type { MuscleGroup, SplitCanonical } from '@/types/models';

/** Selectable splits with human labels (drives the per-workout split <select>). */
export const SPLIT_OPTIONS: { value: SplitCanonical; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
  { value: 'chest-back', label: 'Chest + Back' },
  { value: 'chest-tris', label: 'Chest + Triceps' },
  { value: 'back-bis', label: 'Back + Biceps' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'full-body', label: 'Full Body' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'unknown', label: 'Unknown' },
];

/** Muscle tags offered when adding an uncatalogued exercise to the catalog. */
export const MUSCLE_OPTIONS: MuscleGroup[] = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'lats',
  'traps',
  'upper-back',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'lower-back',
];

/** Pretty label for a muscle-group token. */
export function muscleLabel(m: MuscleGroup): string {
  return m
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
