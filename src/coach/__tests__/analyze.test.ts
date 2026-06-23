import { describe, expect, it } from 'vitest';
import { analyzeImbalances, muscleCoverage } from '../analyze';
import type { ExerciseBest, Workout, WorkoutExercise } from '@/types/models';

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

function workout(exercises: WorkoutExercise[]): Workout {
  return {
    id: 'w1',
    date: '2026-06-01',
    dateConfidence: 'high',
    bodyweightKg: 80,
    splitCanonical: 'push',
    splitRaw: null,
    blockId: null,
    sourceNoteId: 'n1',
    exercises,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function ex(exerciseId: string, nWorkingSets: number): WorkoutExercise {
  return {
    exerciseId,
    rawName: exerciseId,
    unit: 'kg',
    sets: Array.from({ length: nWorkingSets }, (_, i) => ({
      weightKg: 100,
      reps: 5,
      raw: `100x5#${i}`,
    })),
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
    // row-bench is med, band [0.70, 0.90]. ratio 0.40 is far below min*0.92.
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

  it('flags a weak weighted pull-up vs barbell row deficit (pullup-row)', () => {
    const bests = [best('barbell-row', 100), best('weighted-pull-up', 50)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'pullup-row')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('flag'); // 0.50 < 0.90*0.92, med-confidence caps at flag
    expect(f.ratio).toBeCloseTo(0.5, 5);
    expect(f.message).toMatch(/weighted pull-up/i);
    expect(f.message).toMatch(/lats/i);
    expect(f.muscles).toContain('lats');
  });

  it('marks an in-band weighted pull-up vs barbell row as ok (pullup-row)', () => {
    const bests = [best('barbell-row', 100), best('weighted-pull-up', 100)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'pullup-row')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('ok'); // 1.00 in [0.9, 1.1]
  });

  it('flags a weak Romanian deadlift vs back squat deficit (rdl-squat)', () => {
    const bests = [best('back-squat', 150), best('romanian-deadlift', 90)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'rdl-squat')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('flag'); // 0.60 < 0.80*0.92
    expect(f.ratio).toBeCloseTo(0.6, 5);
    expect(f.message).toMatch(/Romanian deadlift/i);
    expect(f.message).toMatch(/hamstring/i);
    expect(f.muscles).toContain('hamstrings');
  });

  it('marks an in-band Romanian deadlift vs back squat as ok (rdl-squat)', () => {
    const bests = [best('back-squat', 150), best('romanian-deadlift', 127.5)];
    const f = analyzeImbalances(bests).find((x) => x.ruleId === 'rdl-squat')!;
    expect(f).toBeDefined();
    expect(f.severity).toBe('ok'); // 0.85 in [0.8, 1.0]
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

describe('muscleCoverage', () => {
  it('counts working sets per muscle and classifies coverage', () => {
    const workouts = [
      workout([
        ex('barbell-bench-press', 8), // chest (+ front-delts, triceps secondary)
        ex('overhead-press', 2), // front-delts/triceps
      ]),
    ];
    const coverage = muscleCoverage(workouts);
    const byMuscle = Object.fromEntries(coverage.map((c) => [c.muscle, c]));

    // chest gets 8 sets -> ok
    expect(byMuscle['chest'].sets).toBeGreaterThanOrEqual(8);
    expect(byMuscle['chest'].status).toBe('ok');

    // a muscle nobody trained -> never (0 sets)
    expect(byMuscle['calves'].sets).toBe(0);
    expect(byMuscle['calves'].status).toBe('never');

    // every MuscleGroup is represented in the output
    expect(coverage.length).toBe(16);
  });

  it('marks a lightly-trained muscle as undertrained', () => {
    // a single exercise with only a few sets touching hamstrings
    const workouts = [workout([ex('deadlift', 3)])]; // deadlift -> hamstrings/glutes/lower-back
    const coverage = muscleCoverage(workouts);
    const ham = coverage.find((c) => c.muscle === 'hamstrings')!;
    expect(ham.sets).toBeGreaterThan(0);
    expect(ham.sets).toBeLessThan(6);
    expect(ham.status).toBe('undertrained');
  });

  it('contributes nothing for uncatalogued exercises', () => {
    const workouts = [workout([ex('unknown:mystery-machine', 10)])];
    const coverage = muscleCoverage(workouts);
    expect(coverage.every((c) => c.sets === 0)).toBe(true);
    expect(coverage.every((c) => c.status === 'never')).toBe(true);
  });
});
