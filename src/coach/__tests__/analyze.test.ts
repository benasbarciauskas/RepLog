import { describe, expect, it } from 'vitest';
import { analyzeImbalances } from '../analyze';
import type { ExerciseBest } from '@/types/models';

/** Build a minimal ExerciseBest with only the fields the coach engine reads. */
function best(exerciseId: string, bestE1rmKg: number | null): ExerciseBest {
  return {
    exerciseId,
    maxWeightKg: bestE1rmKg,
    maxWeightDate: bestE1rmKg == null ? null : '2026-06-01',
    bestE1rmKg,
    bestE1rmDate: bestE1rmKg == null ? null : '2026-06-01',
    repPRs: [],
  };
}

describe('analyzeImbalances', () => {
  it('flags a deep ohp/bench deficit as priority (high-confidence rule)', () => {
    const bests = [best('barbell-bench-press', 150), best('overhead-press', 75)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'ohp-bench')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('priority'); // 75/150 = 0.50 < 0.60*0.92
    expect(f.muscles).toContain('front-delts');
    expect(f.message).toMatch(/front delt/i);
    expect(f.ratio).toBeCloseTo(0.5, 5);
  });

  it('marks an in-band ohp/bench ratio as ok', () => {
    const bests = [best('barbell-bench-press', 150), best('overhead-press', 100)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'ohp-bench')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('ok'); // 100/150 = 0.667 >= 0.60
  });

  it('caps a med-confidence rule below band at flag (never priority)', () => {
    // row-bench is med, band [0.75, 0.90]. ratio 0.40 is far below min*0.92.
    const bests = [best('barbell-bench-press', 150), best('barbell-row', 60)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'row-bench')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('flag'); // capped, would be priority if it were high-confidence
    expect(f.message).toMatch(/may be|consider/i); // hedged wording
  });

  it('emits a priority red flag when deadlift is below squat (ratio < 1.0)', () => {
    const bests = [best('deadlift', 100), best('back-squat', 120)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'deadlift-squat')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('priority'); // 100/120 = 0.83 < 1.0
    expect(f.ratio).toBeCloseTo(0.833, 2);
  });

  it('produces no finding when the denominator lift is missing', () => {
    const bests = [best('overhead-press', 75)]; // no bench at all
    expect(analyzeImbalances(bests).some((x) => x.ruleId === 'ohp-bench')).toBe(false);
  });

  it('produces no finding when a lift has a null bestE1rmKg', () => {
    const bests = [best('barbell-bench-press', null), best('overhead-press', 75)];
    expect(analyzeImbalances(bests).some((x) => x.ruleId === 'ohp-bench')).toBe(false);
  });

  it('names both lifts with their actual kg, the ratio, and the healthy floor', () => {
    const bests = [best('barbell-bench-press', 150), best('overhead-press', 75)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'ohp-bench')!;
    expect(f.message).toContain('150kg');
    expect(f.message).toContain('75kg');
    expect(f.message).toContain('0.50');
    expect(f.message).toMatch(/0\.60/);
  });

  it('orders findings priority -> flag -> ok', () => {
    const bests = [
      best('barbell-bench-press', 150),
      best('overhead-press', 75), // priority (ohp-bench)
      best('barbell-row', 120), // ok-ish (row-bench: 0.80 in band)
      best('back-squat', 138), // squat-bench 0.92 -> flag
    ];
    const findings = analyzeImbalances(bests);
    const order = { priority: 0, flag: 1, ok: 2 };
    for (let i = 1; i < findings.length; i++) {
      expect(order[findings[i].severity]).toBeGreaterThanOrEqual(order[findings[i - 1].severity]);
    }
  });
});
