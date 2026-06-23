import type {
  ExerciseCategory,
  ExerciseDef,
  MovementPattern,
  MuscleGroup,
} from '@/types/models';

/** Category tags offered when creating a custom exercise (no cardio). */
export const CUSTOM_CATEGORY_OPTIONS: ExerciseCategory[] = [
  'push',
  'pull',
  'legs',
  'core',
];

/** Movement patterns for custom strength exercises (cardio omitted). */
export const CUSTOM_PATTERN_OPTIONS: MovementPattern[] = [
  'horizontal-press',
  'vertical-press',
  'horizontal-pull',
  'vertical-pull',
  'squat',
  'hinge',
  'lunge',
  'isolation',
  'carry',
];

const MUSCLE_CATEGORY: Record<MuscleGroup, ExerciseCategory> = {
  chest: 'push',
  'front-delts': 'push',
  'side-delts': 'push',
  triceps: 'push',
  'rear-delts': 'pull',
  lats: 'pull',
  traps: 'pull',
  'upper-back': 'pull',
  biceps: 'pull',
  forearms: 'pull',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  'lower-back': 'legs',
  abs: 'core',
};

/** Title-case a category or pattern token for compact selects. */
export function humanToken(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Infer push/pull/legs/core from the chosen primary muscles (majority vote). */
export function inferCategoryFromMuscles(primaryMuscles: MuscleGroup[]): ExerciseCategory {
  if (primaryMuscles.length === 0) return 'push';

  const counts = new Map<ExerciseCategory, number>();
  for (const m of primaryMuscles) {
    const cat = MUSCLE_CATEGORY[m];
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  let best: ExerciseCategory = MUSCLE_CATEGORY[primaryMuscles[0]];
  let bestCount = 0;
  for (const [cat, n] of counts) {
    if (n > bestCount) {
      best = cat;
      bestCount = n;
    }
  }
  return best;
}

export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `x${hashName(name.trim().toLowerCase())}`;
}

/** Small stable string hash (djb2) → base36, for deterministic slug fallback. */
function hashName(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export interface CustomExerciseInput {
  canonicalName: string;
  category?: ExerciseCategory;
  pattern?: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
}

/** Build a persisted custom ExerciseDef with the `custom:<slug>` id scheme. */
export function buildCustomExerciseDef(input: CustomExerciseInput): ExerciseDef {
  const name = input.canonicalName.trim();
  const primaryMuscles = [...input.primaryMuscles];
  const secondaryMuscles = (input.secondaryMuscles ?? []).filter(
    (m) => !primaryMuscles.includes(m),
  );

  return {
    id: `custom:${slugify(name)}`,
    canonicalName: name,
    aliases: [name.toLowerCase()],
    category: input.category ?? inferCategoryFromMuscles(primaryMuscles),
    pattern: input.pattern ?? 'isolation',
    primaryMuscles,
    secondaryMuscles,
  };
}