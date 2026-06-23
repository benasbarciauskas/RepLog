import type { ExerciseDef, MovementPattern, MuscleGroup } from '@/types/models';

export interface SimilarExercise {
  def: ExerciseDef;
  score: number;
  reason: string;
}

const PATTERN_LABELS: Record<MovementPattern, string> = {
  'horizontal-press': 'horizontal press',
  'vertical-press': 'vertical press',
  'horizontal-pull': 'horizontal pull',
  'vertical-pull': 'vertical pull',
  squat: 'squat',
  hinge: 'hinge',
  lunge: 'lunge',
  isolation: 'isolation',
  carry: 'carry',
  cardio: 'cardio',
};

function sharedMuscles(a: MuscleGroup[], b: MuscleGroup[]): MuscleGroup[] {
  const setB = new Set(b);
  return a.filter((m) => setB.has(m));
}

function formatMuscleList(muscles: MuscleGroup[]): string {
  return muscles.map((m) => m.replace(/-/g, ' ')).join(', ');
}

function buildReason(
  sharedPrimary: MuscleGroup[],
  samePattern: boolean,
  pattern: MovementPattern,
): string {
  const parts: string[] = [];

  if (sharedPrimary.length > 0) {
    if (sharedPrimary.length === 1) {
      parts.push(`Hits ${formatMuscleList(sharedPrimary)}`);
    } else {
      parts.push(`Same target: ${formatMuscleList(sharedPrimary)}`);
    }
  }

  if (samePattern) {
    parts.push(`similar movement (${PATTERN_LABELS[pattern]})`);
  }

  return parts.join(' · ');
}

/**
 * Deterministic similarity ranking for exercise substitution. On-device only;
 * scores candidates by shared primary muscles, movement pattern, category, and
 * secondary muscles.
 */
export function similarExercises(
  exerciseId: string,
  catalog: ExerciseDef[],
  limit = 6,
): SimilarExercise[] {
  if (exerciseId.startsWith('unknown:')) {
    return [];
  }

  const target = catalog.find((d) => d.id === exerciseId);
  if (!target) {
    return [];
  }

  const results: SimilarExercise[] = [];

  for (const candidate of catalog) {
    if (candidate.id === exerciseId) continue;
    if (candidate.category === 'cardio') continue;

    const sharedPrimary = sharedMuscles(target.primaryMuscles, candidate.primaryMuscles);
    const sharedSecondary = sharedMuscles(target.secondaryMuscles, candidate.secondaryMuscles);
    const samePattern = target.pattern === candidate.pattern;
    const sameCategory = target.category === candidate.category;

    let score = 0;
    score += sharedPrimary.length * 3;
    if (samePattern) score += 2;
    if (sameCategory) score += 1;
    score += sharedSecondary.length * 0.5;

    if (score <= 0 || (sharedPrimary.length === 0 && !samePattern)) continue;

    results.push({
      def: candidate,
      score,
      reason: buildReason(sharedPrimary, samePattern, target.pattern),
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.def.canonicalName.localeCompare(b.def.canonicalName);
  });

  return results.slice(0, limit);
}