import type { CoachFinding, ExerciseBest, FindingSeverity, MuscleGroup } from '@/types/models';
import { RATIO_RULES, type RatioRule } from './ratios';

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
