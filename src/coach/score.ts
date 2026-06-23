import type { ExerciseBest } from '@/types/models';
import { RATIO_RULES, type RatioRule } from './ratios';

/**
 * Qualitative status for a score, shared by the overall score and each area.
 * Mirrors the coach severity feel: strong → ok, mid → watch, weak → priority.
 */
export type ScoreStatus = 'strong' | 'watch' | 'attention';

export interface AreaScore {
  /** Stable key (rule id, or a synthetic group key like 'push-pull'). */
  key: string;
  /** Human label for the gauge. */
  label: string;
  /** 0–100 sub-score, or null when the area can't be judged (missing lifts). */
  score: number | null;
  /** Qualitative band derived from the score (null score → 'attention'-neutral handled by caller). */
  status: ScoreStatus;
}

export interface BalanceScore {
  /** Headline 0–100, or null when nothing could be scored. */
  overall: number | null;
  /** Per-area sub-scores (one per scorable ratio rule + grouped areas). */
  areas: AreaScore[];
  /** Count of rules that fired (both lifts present). */
  scoredRules: number;
  /** Rules that couldn't fire — surfaced as "unlock more" prompts, never zeros. */
  unlockable: { ruleId: string; label: string }[];
}

/** Confidence → weight. High-confidence ratios dominate the average (spec §4.1). */
const CONFIDENCE_WEIGHT: Record<RatioRule['confidence'], number> = {
  high: 1,
  med: 0.6,
  low: 0.35,
};

/**
 * Width of the smooth fall-off band on each side of [healthyMin, healthyMax],
 * expressed as a fraction of the band's healthyMin. Inside the band → full
 * credit (100). Outside, the score falls linearly to 0 once the observed ratio
 * is this far past the nearest edge. Tuned so a "noticeably off" lift lands low
 * but not instantly zero.
 */
const FALLOFF = 0.5;

/**
 * Score a single observed ratio against a rule's healthy band → 0–100.
 *
 * - In-band (healthyMin ≤ ratio ≤ healthyMax) → 100 (full credit).
 * - Below the band → falls off linearly over `healthyMin * FALLOFF`, clamped 0.
 * - Above the band → falls off linearly over `healthyMax * FALLOFF`, clamped 0.
 *   (Being far ABOVE the band still means an imbalance — the other lift lags.)
 *
 * Deterministic and pure: same inputs → same output.
 */
export function scoreRatio(ratio: number, rule: RatioRule): number {
  const { healthyMin, healthyMax } = rule;
  if (ratio >= healthyMin && ratio <= healthyMax) return 100;

  if (ratio < healthyMin) {
    const span = healthyMin * FALLOFF;
    const deficit = healthyMin - ratio;
    return clamp01((span - deficit) / span) * 100;
  }

  // ratio > healthyMax
  const span = healthyMax * FALLOFF;
  const excess = ratio - healthyMax;
  return clamp01((span - excess) / span) * 100;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Round to a whole number for display (the gauge shows integers). */
function round(n: number): number {
  return Math.round(n);
}

function statusFor(score: number): ScoreStatus {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'watch';
  return 'attention';
}

/**
 * Higher-level "areas" grouped from the underlying ratio rules, so the
 * sub-gauges can show push/pull and upper/lower in addition to per-ratio scores.
 * Each area names the rule ids that contribute to it.
 */
const AREA_GROUPS: { key: string; label: string; ruleIds: string[] }[] = [
  // Push: pressing strength balance (vertical press vs horizontal, upper chest).
  { key: 'push', label: 'Push', ruleIds: ['ohp-bench', 'incline-flat'] },
  // Pull: pulling strength relative to pressing.
  { key: 'pull', label: 'Pull', ruleIds: ['row-bench', 'pullup-bench'] },
  // Lower: squat/deadlift balance vs the rest.
  {
    key: 'lower',
    label: 'Lower body',
    ruleIds: ['squat-bench', 'deadlift-squat', 'frontsquat-backsquat'],
  },
];

/**
 * Compute the deterministic, on-device Balance Score (spec §4.1).
 *
 * For each `RatioRule` whose two lifts both have an e1RM, score how close the
 * observed ratio sits to its healthy band (100 in-band, smooth fall-off outside,
 * clamped to 0). Weight each per-rule score by the rule's `confidence`, then take
 * the weighted average → overall 0–100. Rules that can't fire are excluded from
 * the maths and surfaced as `unlockable` prompts (never scored as zero).
 *
 * Returns `overall: null` when no rule could fire.
 */
export function balanceScore(bests: ExerciseBest[]): BalanceScore {
  const e1rmById = new Map<string, number>();
  for (const b of bests) {
    if (b.bestE1rmKg != null && b.bestE1rmKg > 0) {
      e1rmById.set(b.exerciseId, b.bestE1rmKg);
    }
  }

  // Per-rule scores keyed by rule id, with the rule for grouping/weights.
  const perRule = new Map<string, { rule: RatioRule; score: number }>();
  const areas: AreaScore[] = [];
  const unlockable: { ruleId: string; label: string }[] = [];

  let weightedSum = 0;
  let weightTotal = 0;

  for (const rule of RATIO_RULES) {
    const numKg = e1rmById.get(rule.numerator);
    const denKg = e1rmById.get(rule.denominator);

    if (numKg == null || denKg == null || denKg === 0) {
      unlockable.push({ ruleId: rule.id, label: rule.label });
      continue;
    }

    const ratio = numKg / denKg;
    const score = scoreRatio(ratio, rule);
    perRule.set(rule.id, { rule, score });

    const weight = CONFIDENCE_WEIGHT[rule.confidence];
    weightedSum += score * weight;
    weightTotal += weight;

    areas.push({
      key: rule.id,
      label: rule.label,
      score: round(score),
      status: statusFor(score),
    });
  }

  const overall = weightTotal > 0 ? round(weightedSum / weightTotal) : null;

  // Grouped areas (push/pull/lower), each a confidence-weighted average of its
  // member rules that fired. Groups with no fired members are omitted (so we
  // never show a 0 for "no data").
  const groupAreas: AreaScore[] = [];
  for (const group of AREA_GROUPS) {
    let gSum = 0;
    let gWeight = 0;
    for (const ruleId of group.ruleIds) {
      const entry = perRule.get(ruleId);
      if (!entry) continue;
      const w = CONFIDENCE_WEIGHT[entry.rule.confidence];
      gSum += entry.score * w;
      gWeight += w;
    }
    if (gWeight > 0) {
      const gScore = round(gSum / gWeight);
      groupAreas.push({
        key: group.key,
        label: group.label,
        score: gScore,
        status: statusFor(gScore),
      });
    }
  }

  return {
    overall,
    // Grouped areas first (the headline sub-gauges), then per-ratio detail.
    areas: [...groupAreas, ...areas],
    scoredRules: perRule.size,
    unlockable,
  };
}

/** One-line qualitative label for the overall score ring (spec §4.1). */
export function overallLabel(overall: number | null): string {
  if (overall == null) return 'Not enough lifts yet';
  if (overall >= 85) return 'Well balanced';
  if (overall >= 70) return 'Mostly balanced';
  if (overall >= 50) return 'A few gaps';
  return 'Needs attention';
}
