import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog';
import { parseExerciseLine } from '../exerciseLine';

const cat = createCatalog();

describe('parseExerciseLine', () => {
  it('parses "WEIGHTx REPS, REPS..." with kg and a leading scheme prefix to strip', () => {
    const ex = parseExerciseLine('Benchpress 5x5: 105x 5, 5, 5, 5, 4', cat)[0];
    expect(ex).toMatchObject({
      exerciseId: 'barbell-bench-press',
      sets: [
        { weightKg: 105, reps: 5 },
        { weightKg: 105, reps: 5 },
        { weightKg: 105, reps: 5 },
        { weightKg: 105, reps: 5 },
        { weightKg: 105, reps: 4 },
      ],
    });
  });

  it('parses kgs unit + extra reps (weighted pull-up)', () => {
    const ex = parseExerciseLine('Weighted pullups 5x5: 30kgsx 5, 5, 5, 5, 7, 13', cat)[0];
    expect(ex.exerciseId).toBe('weighted-pull-up');
    expect(ex.sets.map((s) => s.reps)).toEqual([5, 5, 5, 5, 7, 13]);
    expect(ex.sets.every((s) => s.weightKg === 30)).toBe(true);
  });

  it('parses per-set weights, third inheriting prior weight, preserving raw', () => {
    const ex = parseExerciseLine('Bench: 125x5, 120x5, 5', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 125, reps: 5, raw: '125x5' },
      { weightKg: 120, reps: 5, raw: '120x5' },
      { weightKg: 120, reps: 5, raw: '5' },
    ]);
  });

  it('parses bodyweight pull-ups (no weight -> null, pull-up id)', () => {
    const ex = parseExerciseLine('Pullups: 20, 16, 12', cat)[0];
    expect(ex).toMatchObject({
      exerciseId: 'pull-up',
      sets: [
        { weightKg: null, reps: 20 },
        { weightKg: null, reps: 16 },
        { weightKg: null, reps: 12 },
      ],
    });
  });

  it('parses "x" before reps with kg + space variants', () => {
    const ex = parseExerciseLine('OHP: 70kgx5, 60kgx 8', cat)[0];
    expect(ex.exerciseId).toBe('overhead-press');
    expect(ex.sets).toEqual([
      { weightKg: 70, reps: 5, raw: '70kgx5' },
      { weightKg: 60, reps: 8, raw: '60kgx 8' },
    ]);
  });

  it('parses decimal weights and resolves added-weight pull-ups to weighted-pull-up', () => {
    const ex = parseExerciseLine('Pull-ups: 42.5 x6, 6, 6', cat)[0];
    expect(ex.exerciseId).toBe('weighted-pull-up');
    expect(ex.sets[0]).toMatchObject({ weightKg: 42.5, reps: 6 });
    expect(ex.sets.map((s) => s.reps)).toEqual([6, 6, 6]);
  });

  it('parses uncatalogued exercises to an unknown: id but still extracts sets', () => {
    const ex = parseExerciseLine('Cable bicep isos: 20kg x 11, 12', cat)[0];
    expect(ex.exerciseId).toMatch(/^unknown:/);
    expect(ex.sets).toEqual([
      { weightKg: 20, reps: 11, raw: '20kg x 11' },
      { weightKg: 20, reps: 12, raw: '12' },
    ]);
  });

  it('ignores trailing "..." truncation', () => {
    const ex = parseExerciseLine('Squat: 100x5, 110x5, ...', cat)[0];
    expect(ex.exerciseId).toBe('back-squat');
    expect(ex.sets).toEqual([
      { weightKg: 100, reps: 5, raw: '100x5' },
      { weightKg: 110, reps: 5, raw: '110x5' },
    ]);
  });

  it('returns [] for lines with no set data', () => {
    expect(parseExerciseLine('Monday - Chest and Back', cat)).toEqual([]);
    expect(parseExerciseLine('', cat)).toEqual([]);
  });

  it('sets the unit to kg', () => {
    const ex = parseExerciseLine('Bench: 100x5', cat)[0];
    expect(ex.unit).toBe('kg');
  });

  it('parses space-separated weight×rep tokens', () => {
    const ex = parseExerciseLine('bench press 100x5 102.5x5 105x4', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 100, reps: 5, raw: '100x5' },
      { weightKg: 102.5, reps: 5, raw: '102.5x5' },
      { weightKg: 105, reps: 4, raw: '105x4' },
    ]);
  });

  it('parses slash rep-lists after a leading weight', () => {
    const ex = parseExerciseLine('ohp 60kg 5/5/4', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 60, reps: 5, raw: '5' },
      { weightKg: 60, reps: 5, raw: '5' },
      { weightKg: 60, reps: 4, raw: '4' },
    ]);
  });

  it('parses bodyweight slash rep-lists', () => {
    const ex = parseExerciseLine('pullups 12/10/8', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: null, reps: 12, raw: '12' },
      { weightKg: null, reps: 10, raw: '10' },
      { weightKg: null, reps: 8, raw: '8' },
    ]);
  });

  it('parses a two-value bodyweight slash rep-list (no data loss when both <=12)', () => {
    const ex = parseExerciseLine('pullups 12/10', cat)[0];
    expect(ex.exerciseId).toBe('pull-up');
    expect(ex.sets).toEqual([
      { weightKg: null, reps: 12, raw: '12' },
      { weightKg: null, reps: 10, raw: '10' },
    ]);
  });

  it('parses a two-value bodyweight slash rep-list with both values <=12 (10/8)', () => {
    const ex = parseExerciseLine('pullups 10/8', cat)[0];
    expect(ex.exerciseId).toBe('pull-up');
    expect(ex.sets).toEqual([
      { weightKg: null, reps: 10, raw: '10' },
      { weightKg: null, reps: 8, raw: '8' },
    ]);
  });

  it('still parses a weighted two-value slash list after a leading weight (dips 20/15)', () => {
    const ex = parseExerciseLine('dips 20/15', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: null, reps: 20, raw: '20' },
      { weightKg: null, reps: 15, raw: '15' },
    ]);
  });

  it('parses WEIGHT xNxM scheme shorthand as N sets of M reps', () => {
    const ex = parseExerciseLine('squat 140 x5x5', cat)[0];
    expect(ex.sets).toHaveLength(5);
    expect(ex.sets.every((s) => s.weightKg === 140 && s.reps === 5)).toBe(true);
  });

  it('parses carried-weight x-rep tokens', () => {
    const ex = parseExerciseLine('tri pushdown 25 x12 x12 x15', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 25, reps: 12, raw: 'x12' },
      { weightKg: 25, reps: 12, raw: 'x12' },
      { weightKg: 25, reps: 15, raw: 'x15' },
    ]);
  });

  it('parses weight with unit followed by x-rep tokens', () => {
    const ex = parseExerciseLine('RDL 100kg x8 x8', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 100, reps: 8, raw: 'x8' },
      { weightKg: 100, reps: 8, raw: 'x8' },
    ]);
  });
  it('expands sets x reps @ weight schemes to identical sets', () => {
    const ex = parseExerciseLine('Squat: 3x8 @ 100kg', cat)[0];
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets.every((s) => s.weightKg === 100 && s.reps === 8)).toBe(true);
  });

  it('expands spaced scheme "3 x 8 @ 100"', () => {
    const ex = parseExerciseLine('Bench: 3 x 8 @ 100', cat)[0];
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets.every((s) => s.weightKg === 100 && s.reps === 8)).toBe(true);
  });

  it('expands a sets x reps @ weight scheme written as 5x5 @ 100', () => {
    const ex = parseExerciseLine('Bench: 5x5 @ 100', cat)[0];
    expect(ex.sets).toHaveLength(5);
    expect(ex.sets.every((s) => s.weightKg === 100 && s.reps === 5)).toBe(true);
  });

  it('parses "weight for reps" notation', () => {
    const ex = parseExerciseLine('Deadlift: 100kg for 8, 100 for 8 reps', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 100, reps: 8, raw: '100kg for 8' },
      { weightKg: 100, reps: 8, raw: '100 for 8 reps' },
    ]);
  });

  it('parses a single "weight for reps" set (100 for 5)', () => {
    const ex = parseExerciseLine('Bench: 100 for 5', cat)[0];
    expect(ex.sets).toEqual([{ weightKg: 100, reps: 5, raw: '100 for 5' }]);
  });

  it('parses reps-first notation', () => {
    const ex = parseExerciseLine('OHP: 8 reps x 100kg, 8 @ 100kg', cat)[0];
    expect(ex.sets).toEqual([
      { weightKg: 100, reps: 8, raw: '8 reps x 100kg' },
      { weightKg: 100, reps: 8, raw: '8 @ 100kg' },
    ]);
  });

  it('parses reps-first "5 reps @ 100"', () => {
    const ex = parseExerciseLine('Bench: 5 reps @ 100', cat)[0];
    expect(ex.sets).toEqual([{ weightKg: 100, reps: 5, raw: '5 reps @ 100' }]);
  });

  it('uses the top of a rep range (100x8-10 -> reps 10)', () => {
    const ex = parseExerciseLine('Bench: 100x8-10', cat)[0];
    expect(ex.sets[0]).toMatchObject({ weightKg: 100, reps: 10 });
  });

  it('expands slash drop sets (100/90/80 x 5)', () => {
    const ex = parseExerciseLine('Squat: 100/90/80 x 5', cat)[0];
    expect(ex.sets.map((s) => s.weightKg)).toEqual([100, 90, 80]);
    expect(ex.sets.every((s) => s.reps === 5)).toBe(true);
  });

  it('expands comma drop sets with shared reps (100,90,80 x 5)', () => {
    const ex = parseExerciseLine('Squat: 100,90,80 x 5', cat)[0];
    expect(ex.sets.map((s) => s.weightKg)).toEqual([100, 90, 80]);
    expect(ex.sets.every((s) => s.reps === 5)).toBe(true);
  });

  it('parses comma-separated drop weights after a set context', () => {
    const ex = parseExerciseLine('Bench: 100x5, 90, 80', cat)[0];
    expect(ex.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [100, 5],
      [90, 5],
      [80, 5],
    ]);
  });

  it('parses AMRAP with null reps', () => {
    const ex = parseExerciseLine('Bench: 100x amrap, 100 x AMRAP', cat)[0];
    expect(ex.sets[0]).toMatchObject({ weightKg: 100, reps: null, raw: '100x amrap' });
    expect(ex.sets[1]).toMatchObject({ weightKg: 100, reps: null, raw: '100 x AMRAP' });
  });

  it('parses AMRAP shorthand 100xF with null reps', () => {
    const ex = parseExerciseLine('Bench: 100xF', cat)[0];
    expect(ex.sets[0]).toMatchObject({ weightKg: 100, reps: null });
  });

  it('parses inline added-weight bodyweight moves', () => {
    const pull = parseExerciseLine('pull ups +10kg x 8', cat)[0];
    expect(pull.exerciseId).toBe('weighted-pull-up');
    expect(pull.sets[0]).toMatchObject({ weightKg: 10, reps: 8 });

    const dips = parseExerciseLine('dips bw+20 x 6', cat)[0];
    expect(dips.exerciseId).toBe('dips');
    expect(dips.sets[0]).toMatchObject({ weightKg: 20, reps: 6 });
  });

  it('captures trailing RPE without breaking set parse', () => {
    const ex = parseExerciseLine('Squat: 100x5 @8, 100x5 @RPE8', cat)[0];
    expect(ex.sets[0]).toMatchObject({ weightKg: 100, reps: 5, rpe: 8 });
    expect(ex.sets[1]).toMatchObject({ weightKg: 100, reps: 5, rpe: 8 });
  });

  it('converts lb/lbs to kg', () => {
    const ex = parseExerciseLine('Bench: 225lb x 5', cat)[0];
    expect(ex.sets[0].weightKg).toBeCloseTo(102.06, 1);
    expect(ex.sets[0].reps).toBe(5);
  });

  it('converts a spaced lb weight to kg (225 lb x 5)', () => {
    const ex = parseExerciseLine('Bench: 225 lb x 5', cat)[0];
    expect(ex.sets[0].weightKg).toBeCloseTo(102.06, 1);
    expect(ex.sets[0].reps).toBe(5);
  });
});
