import { describe, expect, it } from 'vitest';
import { RATIO_RULES } from '../ratios';
import type { MuscleGroup } from '@/types/models';

const HIGH_CONFIDENCE_IDS = ['ohp-bench', 'squat-bench', 'frontsquat-backsquat'];

const EXPECTED_RULE_IDS = [
  'ohp-bench',
  'row-bench',
  'squat-bench',
  'deadlift-squat',
  'pullup-bench',
  'pullup-row',
  'incline-flat',
  'frontsquat-backsquat',
  'rdl-squat',
];

describe('RATIO_RULES', () => {
  it('defines all verified rules with the expected ids', () => {
    expect(RATIO_RULES.map((r) => r.id).sort()).toEqual([...EXPECTED_RULE_IDS].sort());
  });

  it('uses canonical exerciseIds that match the parser/catalog', () => {
    const canonicalIds = new Set([
      'overhead-press',
      'barbell-bench-press',
      'barbell-row',
      'back-squat',
      'deadlift',
      'weighted-pull-up',
      'incline-bench',
      'front-squat',
      'romanian-deadlift',
    ]);
    for (const rule of RATIO_RULES) {
      expect(canonicalIds.has(rule.numerator)).toBe(true);
      expect(canonicalIds.has(rule.denominator)).toBe(true);
    }
  });

  it('marks exactly the three high-confidence rules', () => {
    const high = RATIO_RULES.filter((r) => r.confidence === 'high').map((r) => r.id);
    expect(high.sort()).toEqual([...HIGH_CONFIDENCE_IDS].sort());
  });

  it('uses the verified bands from established strength-ratio references', () => {
    const byId = Object.fromEntries(RATIO_RULES.map((r) => [r.id, r]));
    expect([byId['ohp-bench'].healthyMin, byId['ohp-bench'].healthyMax]).toEqual([0.6, 0.7]);
    expect([byId['row-bench'].healthyMin, byId['row-bench'].healthyMax]).toEqual([0.7, 0.9]);
    expect([byId['squat-bench'].healthyMin, byId['squat-bench'].healthyMax]).toEqual([1.3, 1.5]);
    expect([byId['deadlift-squat'].healthyMin, byId['deadlift-squat'].healthyMax]).toEqual([
      1.1, 1.3,
    ]);
    expect([byId['pullup-bench'].healthyMin, byId['pullup-bench'].healthyMax]).toEqual([0.9, 1.2]);
    expect([byId['pullup-row'].healthyMin, byId['pullup-row'].healthyMax]).toEqual([0.9, 1.1]);
    expect([byId['incline-flat'].healthyMin, byId['incline-flat'].healthyMax]).toEqual([0.8, 0.9]);
    expect([
      byId['frontsquat-backsquat'].healthyMin,
      byId['frontsquat-backsquat'].healthyMax,
    ]).toEqual([0.8, 0.85]);
    expect([byId['rdl-squat'].healthyMin, byId['rdl-squat'].healthyMax]).toEqual([0.8, 1.0]);
  });

  it('attaches deficit muscles to every rule', () => {
    for (const rule of RATIO_RULES) {
      expect(rule.deficitMuscles.length).toBeGreaterThan(0);
    }
    const ohp = RATIO_RULES.find((r) => r.id === 'ohp-bench')!;
    const expected: MuscleGroup[] = ['front-delts', 'triceps'];
    expect(ohp.deficitMuscles).toEqual(expect.arrayContaining(expected));
  });
});