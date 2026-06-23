import type {
  CoachFinding,
  ExerciseBest,
  FindingSeverity,
  MuscleGroup,
  Workout,
} from '@/types/models';
import { RATIO_RULES, type RatioRule } from './ratios';

/** Every MuscleGroup, so coverage always reports a full body map. */
const ALL_MUSCLES: MuscleGroup[] = [
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

/**
 * Working sets below this count (across the whole dataset) read as undertrained.
 * 0 sets reads as `never`.
 */
const UNDERTRAINED_THRESHOLD = 6;

/**
 * v1 internal exercise -> worked-muscles map for the canonical catalog ids the
 * coach engine knows about. Each set of a listed exercise contributes one
 * working set to every muscle it lists. Uncatalogued / `unknown:` exercises are
 * absent here and therefore contribute nothing to coverage (never fabricate).
 *
 * When the full catalog (Task P) lands, this can be swapped for the catalog's
 * primary+secondary muscle definitions without changing the public contract.
 */
const EXERCISE_MUSCLES: Record<string, MuscleGroup[]> = {
  'barbell-bench-press': ['chest', 'front-delts', 'triceps'],
  'incline-bench': ['chest', 'front-delts', 'triceps'],
  'overhead-press': ['front-delts', 'side-delts', 'triceps'],
  'barbell-row': ['upper-back', 'lats', 'biceps', 'rear-delts'],
  'weighted-pull-up': ['lats', 'biceps', 'upper-back', 'forearms'],
  'back-squat': ['quads', 'glutes', 'lower-back', 'abs'],
  'front-squat': ['quads', 'glutes', 'upper-back', 'abs'],
  deadlift: ['hamstrings', 'glutes', 'lower-back', 'quads', 'traps', 'forearms'],
  'romanian-deadlift': ['hamstrings', 'glutes', 'lower-back'],
};

/** Round to 2dp for stable message strings. */
function fmtRatio(ratio: number): string {
  return ratio.toFixed(2);
}

/** kg as an integer-ish label (drops trailing .0), matching the lift's logged weight feel. */
function fmtKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}kg`;
}

function buildMessage(
  rule: RatioRule,
  numKg: number,
  denKg: number,
  ratio: number,
  severity: FindingSeverity,
  isDeadliftRedFlag: boolean,
): string {
  const hedged = rule.confidence !== 'high';
  const muscleList = rule.deficitMuscles.map(humanMuscle).join(', ');
  const numName = exerciseLabel(rule.numerator);
  const denName = exerciseLabel(rule.denominator);

  if (severity === 'ok') {
    return `Your ${numName} (${fmtKg(numKg)}) is in a healthy ratio to your ${denName} (${fmtKg(denKg)}) — ${fmtRatio(ratio)}, healthy ≥${rule.healthyMin.toFixed(2)}.`;
  }

  if (isDeadliftRedFlag) {
    return `Your ${denName} (${fmtKg(denKg)}) is heavier than your ${numName} (${fmtKg(numKg)}) — ${fmtRatio(ratio)}, but your ${numName} should be the bigger lift (healthy ≥${rule.healthyMin.toFixed(2)}) → posterior chain (${muscleList}) likely lagging.`;
  }

  // flag / priority deficit
  const lagPhrase = hedged
    ? `consider whether ${muscleList} may be lagging`
    : `${muscleList} likely lagging`;
  const verb = hedged ? 'may be under-developed for' : 'is low for';

  return `You ${denVerb(denName)} ${fmtKg(denKg)} but only ${numVerb(numName)} ${fmtKg(numKg)} (${fmtRatio(ratio)}, healthy ≥${rule.healthyMin.toFixed(2)}) — your ${numName} ${verb} your ${denName}; ${lagPhrase}.`;
}

/** Render a MuscleGroup id as readable prose, e.g. 'front-delts' -> 'front delts'. */
function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ');
}

/** Human-friendly exercise label keyed off canonical id. */
function exerciseLabel(id: string): string {
  const labels: Record<string, string> = {
    'overhead-press': 'overhead press',
    'barbell-bench-press': 'bench press',
    'barbell-row': 'barbell row',
    'back-squat': 'back squat',
    deadlift: 'deadlift',
    'weighted-pull-up': 'weighted pull-up',
    'incline-bench': 'incline bench',
    'front-squat': 'front squat',
    'romanian-deadlift': 'Romanian deadlift',
  };
  return labels[id] ?? id;
}

/** Natural verb phrasing for the denominator lift in a deficit message. */
function denVerb(label: string): string {
  if (label === 'bench press') return 'bench';
  return label;
}

/** Natural verb phrasing for the numerator lift in a deficit message. */
function numVerb(label: string): string {
  if (label === 'overhead press') return 'overhead press';
  return label;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  priority: 0,
  flag: 1,
  ok: 2,
};

/**
 * Compare each rule's two lifts and report imbalances.
 *
 * - Skip a rule entirely if either lift has no best (missing or null bestE1rmKg).
 * - severity: ratio >= min -> ok; min*0.92 <= ratio < min -> flag; ratio < min*0.92 -> priority.
 * - Confidence gating: only high-confidence rules may be `priority`; med/low cap at `flag`
 *   and use hedged wording.
 * - Special case (`deadlift-squat`): also emit a priority red flag when ratio < 1.0.
 * - Findings ordered priority -> flag -> ok.
 */
export function analyzeImbalances(bests: ExerciseBest[]): CoachFinding[] {
  const e1rmById = new Map<string, number>();
  for (const b of bests) {
    if (b.bestE1rmKg != null) e1rmById.set(b.exerciseId, b.bestE1rmKg);
  }

  const findings: CoachFinding[] = [];

  for (const rule of RATIO_RULES) {
    const numKg = e1rmById.get(rule.numerator);
    const denKg = e1rmById.get(rule.denominator);
    // Skip when either lift is missing — never fabricate.
    if (numKg == null || denKg == null || denKg === 0) continue;

    const ratio = numKg / denKg;
    const floor = rule.healthyMin * 0.92;

    let severity: FindingSeverity;
    if (ratio >= rule.healthyMin) severity = 'ok';
    else if (ratio >= floor) severity = 'flag';
    else severity = 'priority';

    // Special-case red flag: deadlift below squat is always a priority.
    const isDeadliftRedFlag = rule.id === 'deadlift-squat' && ratio < 1.0;
    if (isDeadliftRedFlag) severity = 'priority';

    // Confidence gating: only high-confidence rules may be priority,
    // except the explicit deadlift<squat red flag above.
    if (severity === 'priority' && rule.confidence !== 'high' && !isDeadliftRedFlag) {
      severity = 'flag';
    }

    findings.push({
      ruleId: rule.id,
      severity,
      ratio,
      message: buildMessage(rule, numKg, denKg, ratio, severity, isDeadliftRedFlag),
      muscles: [...rule.deficitMuscles],
    });
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return findings;
}

/**
 * Count working sets per muscle across all workouts, then classify coverage.
 * Warmup sets are excluded. Exercises not in the internal muscle map contribute
 * nothing (uncatalogued ids can't be attributed to a muscle in v1).
 */
export function muscleCoverage(
  workouts: Workout[],
): { muscle: MuscleGroup; sets: number; status: 'ok' | 'undertrained' | 'never' }[] {
  const setsByMuscle = new Map<MuscleGroup, number>();
  for (const m of ALL_MUSCLES) setsByMuscle.set(m, 0);

  for (const w of workouts) {
    for (const exercise of w.exercises) {
      const muscles = EXERCISE_MUSCLES[exercise.exerciseId];
      if (!muscles) continue; // uncatalogued -> contributes nothing
      const workingSets = exercise.sets.filter((s) => !s.isWarmup).length;
      if (workingSets === 0) continue;
      for (const m of muscles) {
        setsByMuscle.set(m, (setsByMuscle.get(m) ?? 0) + workingSets);
      }
    }
  }

  return ALL_MUSCLES.map((muscle) => {
    const sets = setsByMuscle.get(muscle) ?? 0;
    let status: 'ok' | 'undertrained' | 'never';
    if (sets === 0) status = 'never';
    else if (sets < UNDERTRAINED_THRESHOLD) status = 'undertrained';
    else status = 'ok';
    return { muscle, sets, status };
  });
}
