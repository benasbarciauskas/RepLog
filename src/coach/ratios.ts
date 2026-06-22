import type { MuscleGroup } from '@/types/models';

/**
 * A strength-ratio standard. `ratio = numerator 1RM / denominator 1RM` (unit-free).
 * Bands + confidence come from the verified research pass:
 * docs/superpowers/research/strength-ratios.md.
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
    id: 'ohp-bench',
    numerator: 'overhead-press',
    denominator: 'barbell-bench-press',
    healthyMin: 0.6,
    healthyMax: 0.67,
    confidence: 'high',
    deficitMuscles: ['front-delts', 'triceps'],
    label: 'Overhead press vs bench press',
  },
  {
    id: 'row-bench',
    numerator: 'barbell-row',
    denominator: 'barbell-bench-press',
    healthyMin: 0.75,
    healthyMax: 0.9,
    confidence: 'med',
    deficitMuscles: ['upper-back', 'lats'],
    label: 'Barbell row vs bench press',
  },
  {
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
    id: 'deadlift-squat',
    numerator: 'deadlift',
    denominator: 'back-squat',
    healthyMin: 1.15,
    healthyMax: 1.25,
    confidence: 'med',
    deficitMuscles: ['hamstrings', 'glutes', 'lower-back'],
    label: 'Deadlift vs back squat',
  },
  {
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
    id: 'frontsquat-backsquat',
    numerator: 'front-squat',
    denominator: 'back-squat',
    healthyMin: 0.8,
    healthyMax: 0.9,
    confidence: 'high',
    deficitMuscles: ['quads', 'upper-back', 'abs'],
    label: 'Front squat vs back squat',
  },
];
