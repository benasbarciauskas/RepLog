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
});
