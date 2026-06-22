import { describe, expect, it } from 'vitest';
import { RATIO_RULES } from '../ratios';
import type { MuscleGroup } from '@/types/models';

const HIGH_CONFIDENCE_IDS = ['ohp-bench', 'squat-bench', 'frontsquat-backsquat'];

describe('RATIO_RULES', () => {
  it('defines all seven verified rules with the expected ids', () => {
    expect(RATIO_RULES.map((r) => r.id).sort()).toEqual(
      [
        'ohp-bench',
        'row-bench',
        'squat-bench',
        'deadlift-squat',
        'pullup-bench',
        'incline-flat',
        'frontsquat-backsquat',
      ].sort(),
    );
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

  it('uses the verified bands from the research doc', () => {
    const byId = Object.fromEntries(RATIO_RULES.map((r) => [r.id, r]));
    expect([byId['ohp-bench'].healthyMin, byId['ohp-bench'].healthyMax]).toEqual([0.6, 0.67]);
    expect([byId['row-bench'].healthyMin, byId['row-bench'].healthyMax]).toEqual([0.75, 0.9]);
    expect([byId['squat-bench'].healthyMin, byId['squat-bench'].healthyMax]).toEqual([1.3, 1.5]);
    expect([byId['deadlift-squat'].healthyMin, byId['deadlift-squat'].healthyMax]).toEqual([
      1.15, 1.25,
    ]);
    expect([byId['pullup-bench'].healthyMin, byId['pullup-bench'].healthyMax]).toEqual([0.9, 1.2]);
    expect([byId['incline-flat'].healthyMin, byId['incline-flat'].healthyMax]).toEqual([0.8, 0.9]);
    expect([
      byId['frontsquat-backsquat'].healthyMin,
      byId['frontsquat-backsquat'].healthyMax,
    ]).toEqual([0.8, 0.9]);
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
