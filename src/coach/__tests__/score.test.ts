import { describe, expect, it } from 'vitest';
import { balanceScore, overallLabel, scoreRatio } from '../score';
import { RATIO_RULES } from '../ratios';
import type { ExerciseBest } from '@/types/models';

/** Build a minimal ExerciseBest with just an e1RM (the only field the scorer reads). */
function best(exerciseId: string, e1rm: number | null): ExerciseBest {
  return {
    exerciseId,
    maxWeightKg: e1rm,
    maxWeightDate: e1rm != null ? '2024-01-01' : null,
    bestE1rmKg: e1rm,
    bestE1rmDate: e1rm != null ? '2024-01-01' : null,
    repPRs: [],
  };
}

const ohpBench = RATIO_RULES.find((r) => r.id === 'ohp-bench')!;

describe('scoreRatio', () => {
  it('gives full credit (100) for an in-band ratio', () => {
    // ohp-bench healthy band is [0.6, 0.7]. 0.63 is inside.
    expect(scoreRatio(0.63, ohpBench)).toBe(100);
    expect(scoreRatio(ohpBench.healthyMin, ohpBench)).toBe(100);
    expect(scoreRatio(ohpBench.healthyMax, ohpBench)).toBe(100);
  });

  it('falls off smoothly below the band and clamps to 0 far below', () => {
    const justBelow = scoreRatio(0.57, ohpBench); // small deficit
    const wellBelow = scoreRatio(0.45, ohpBench); // big deficit
    expect(justBelow).toBeGreaterThan(wellBelow);
    expect(justBelow).toBeLessThan(100);
    expect(wellBelow).toBeGreaterThanOrEqual(0);
    // A massive deficit clamps to 0.
    expect(scoreRatio(0.1, ohpBench)).toBe(0);
  });

  it('also penalises being far ABOVE the band (the other lift lags)', () => {
    expect(scoreRatio(0.9, ohpBench)).toBeLessThan(100);
    expect(scoreRatio(2, ohpBench)).toBe(0);
  });

  it('is deterministic — same input, same output', () => {
    expect(scoreRatio(0.5, ohpBench)).toBe(scoreRatio(0.5, ohpBench));
  });
});

describe('balanceScore', () => {
  it('returns a null overall and full unlock list when there is no data', () => {
    const result = balanceScore([]);
    expect(result.overall).toBeNull();
    expect(result.scoredRules).toBe(0);
    expect(result.areas).toEqual([]);
    // Every rule is surfaced as unlockable, none scored as zero.
    expect(result.unlockable.length).toBe(RATIO_RULES.length);
  });

  it('scores in-band lifts high (well-balanced lifter)', () => {
    // Bench 100 → OHP 63 (0.63, in band), squat 140 (1.40, in band),
    // deadlift 165 (1.18 vs squat, in band), front squat 119 (0.85, in band).
    const bests = [
      best('barbell-bench-press', 100),
      best('overhead-press', 63),
      best('back-squat', 140),
      best('deadlift', 165),
      best('front-squat', 119),
    ];
    const result = balanceScore(bests);
    expect(result.overall).not.toBeNull();
    expect(result.overall!).toBeGreaterThanOrEqual(90);
    expect(result.scoredRules).toBeGreaterThan(0);
  });

  it('drops the overall AND the push area for a big OHP/bench deficit', () => {
    // Heavy bench, weak OHP → ohp-bench ratio way below band.
    const balanced = balanceScore([
      best('barbell-bench-press', 100),
      best('overhead-press', 63),
    ]);
    const deficit = balanceScore([
      best('barbell-bench-press', 150),
      best('overhead-press', 60), // 0.40 — far below the 0.6 floor
    ]);

    expect(deficit.overall!).toBeLessThan(balanced.overall!);

    // The push area (built from ohp-bench) should be low and flagged.
    const push = deficit.areas.find((a) => a.key === 'push');
    expect(push).toBeDefined();
    expect(push!.score!).toBeLessThan(50);
    expect(push!.status).toBe('attention');
  });

  it('excludes unscorable rules (missing lift) instead of zeroing them', () => {
    // Only bench + OHP present → only ohp-bench can fire.
    const result = balanceScore([
      best('barbell-bench-press', 100),
      best('overhead-press', 63),
    ]);
    expect(result.scoredRules).toBe(1);
    // The squat/deadlift rules can't fire → unlockable, not scored.
    expect(result.unlockable.some((u) => u.ruleId === 'squat-bench')).toBe(true);
    expect(result.areas.some((a) => a.key === 'squat-bench')).toBe(false);
  });

  it('ignores lifts whose e1RM is null (bodyweight-only / unloaded)', () => {
    const result = balanceScore([
      best('barbell-bench-press', 100),
      best('overhead-press', null), // no loaded e1rm
    ]);
    // ohp-bench can't fire because OHP has no e1rm.
    expect(result.scoredRules).toBe(0);
    expect(result.overall).toBeNull();
  });

  it('weights high-confidence rules more than low-confidence ones', () => {
    // squat-bench is high confidence; pullup-bench is low confidence.
    // Make the high-confidence rule perfect and the low one terrible; overall
    // should sit well above the simple mean (which would be ~50).
    const result = balanceScore([
      best('barbell-bench-press', 100),
      best('back-squat', 140), // squat-bench 1.40 in band → 100, high weight
      best('weighted-pull-up', 5), // pullup-bench 0.05 → 0, low weight
    ]);
    expect(result.overall!).toBeGreaterThan(60);
  });
});

describe('balanceScore — new ratio rules', () => {
  it('lowers overall score when weighted pull-up lags barbell row (pullup-row)', () => {
    const inBand = balanceScore([
      best('barbell-row', 100),
      best('weighted-pull-up', 100),
    ]);
    const outOfBand = balanceScore([
      best('barbell-row', 100),
      best('weighted-pull-up', 50),
    ]);
    expect(outOfBand.overall!).toBeLessThan(inBand.overall!);
    const pull = outOfBand.areas.find((a) => a.key === 'pull');
    expect(pull).toBeDefined();
    expect(pull!.score!).toBeLessThan(75);
  });

  it('lowers overall score when Romanian deadlift lags back squat (rdl-squat)', () => {
    const inBand = balanceScore([
      best('back-squat', 150),
      best('romanian-deadlift', 127.5),
    ]);
    const outOfBand = balanceScore([
      best('back-squat', 150),
      best('romanian-deadlift', 90),
    ]);
    expect(outOfBand.overall!).toBeLessThan(inBand.overall!);
    const lower = outOfBand.areas.find((a) => a.key === 'lower');
    expect(lower).toBeDefined();
    expect(lower!.score!).toBeLessThan(75);
  });
});

describe('overallLabel', () => {
  it('maps score bands to qualitative labels', () => {
    expect(overallLabel(null)).toMatch(/not enough/i);
    expect(overallLabel(90)).toMatch(/well balanced/i);
    expect(overallLabel(72)).toMatch(/balanced/i);
    expect(overallLabel(55)).toMatch(/gaps/i);
    expect(overallLabel(30)).toMatch(/attention/i);
  });
});
