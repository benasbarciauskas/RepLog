import type { MuscleGroup } from '@/types/models';

/**
 * A strength-ratio standard. `ratio = numerator 1RM / denominator 1RM` (unit-free).
 * Bands + confidence are ratio bands derived from established
 * strength-standard references.
 */
export interface RatioRule {
  id: string;
  numerator: string; // canonical exerciseId
  denominator: string; // canonical exerciseId
  healthyMin: number;
  healthyMax: number;
  confidence: 'high' | 'med' | 'low';
  deficitMuscles: MuscleGroup[];
  label: string;
}

/**
 * Verified inter-lift strength-ratio standards. Only `high`-confidence rules may
 * surface as `priority`; `med`/`low` cap at `flag` (see analyzeImbalances).
 */
export const RATIO_RULES: RatioRule[] = [
  {
    // Shoulder press typically tracks ~60–70% of bench in balanced lifters.
    id: 'ohp-bench',
    numerator: 'overhead-press',
    denominator: 'barbell-bench-press',
    healthyMin: 0.6,
    healthyMax: 0.7,
    confidence: 'high',
    deficitMuscles: ['front-delts', 'triceps'],
    label: 'Overhead press vs bench press',
  },
  {
    // Horizontal pull should stay near 70–90% of horizontal push for back/chest balance.
    id: 'row-bench',
    numerator: 'barbell-row',
    denominator: 'barbell-bench-press',
    healthyMin: 0.7,
    healthyMax: 0.9,
    confidence: 'med',
    deficitMuscles: ['upper-back', 'lats'],
    label: 'Barbell row vs bench press',
  },
  {
    // Squat strength commonly exceeds bench by ~30–50% in well-rounded lifters.
    id: 'squat-bench',
    numerator: 'back-squat',
    denominator: 'barbell-bench-press',
    healthyMin: 1.3,
    healthyMax: 1.5,
    confidence: 'high',
    deficitMuscles: ['quads', 'glutes'],
    label: 'Back squat vs bench press',
  },
  {
    // Conventional deadlift usually exceeds back squat by ~10–30% (posterior chain emphasis).
    id: 'deadlift-squat',
    numerator: 'deadlift',
    denominator: 'back-squat',
    healthyMin: 1.1,
    healthyMax: 1.3,
    confidence: 'med',
    deficitMuscles: ['hamstrings', 'glutes', 'lower-back'],
    label: 'Deadlift vs back squat',
  },
  {
    // Weighted vertical pull often lands near bench strength; wide band for bodyweight variability.
    id: 'pullup-bench',
    numerator: 'weighted-pull-up',
    denominator: 'barbell-bench-press',
    healthyMin: 0.9,
    healthyMax: 1.2,
    confidence: 'low',
    deficitMuscles: ['lats', 'biceps'],
    label: 'Weighted pull-up vs bench press',
  },
  {
    // Weighted chin/pull-up total load typically tracks barbell row within ~10%.
    id: 'pullup-row',
    numerator: 'weighted-pull-up',
    denominator: 'barbell-row',
    healthyMin: 0.9,
    healthyMax: 1.1,
    confidence: 'med',
    deficitMuscles: ['lats', 'biceps'],
    label: 'Weighted pull-up vs barbell row',
  },
  {
    // Incline press is usually ~80–90% of flat bench when upper chest is proportionate.
    id: 'incline-flat',
    numerator: 'incline-bench',
    denominator: 'barbell-bench-press',
    healthyMin: 0.8,
    healthyMax: 0.9,
    confidence: 'med',
    deficitMuscles: ['chest'], // upper chest
    label: 'Incline bench vs flat bench',
  },
  {
    // Front squat commonly sits ~80–85% of back squat with adequate quad/core strength.
    id: 'frontsquat-backsquat',
    numerator: 'front-squat',
    denominator: 'back-squat',
    healthyMin: 0.8,
    healthyMax: 0.85,
    confidence: 'high',
    deficitMuscles: ['quads', 'upper-back', 'abs'],
    label: 'Front squat vs back squat',
  },
  {
    // RDL strength often tracks ~80–100% of squat when hamstrings keep pace with quads.
    id: 'rdl-squat',
    numerator: 'romanian-deadlift',
    denominator: 'back-squat',
    healthyMin: 0.8,
    healthyMax: 1.0,
    confidence: 'med',
    deficitMuscles: ['hamstrings', 'glutes'],
    label: 'Romanian deadlift vs back squat',
  },
];