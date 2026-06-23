import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '@/parser/catalog';
import { similarExercises } from '@/program/substitute';

describe('similarExercises', () => {
  const catalog = BUILTIN_EXERCISES;

  it('ranks chest horizontal-press alternatives for barbell bench press', () => {
    const results = similarExercises('barbell-bench-press', catalog);
    const ids = results.map((r) => r.def.id);

    expect(ids).not.toContain('barbell-bench-press');
    expect(ids).not.toContain('running');
    expect(ids).not.toContain('back-squat');

    expect(ids[0]).toBe('dumbbell-bench-press');
    expect(ids).toContain('incline-bench');
    expect(ids).toContain('incline-dumbbell-press');
  });

  it('returns empty for unknown or missing exercise ids', () => {
    expect(similarExercises('unknown:custom-lift', catalog)).toEqual([]);
    expect(similarExercises('not-in-catalog', catalog)).toEqual([]);
  });

  it('builds reason strings from shared muscles and movement pattern', () => {
    const results = similarExercises('barbell-bench-press', catalog);
    expect(results.length).toBeGreaterThan(0);

    for (const r of results) {
      expect(r.reason.length).toBeGreaterThan(0);
      expect(
        r.reason.toLowerCase().includes('chest') ||
          r.reason.toLowerCase().includes('horizontal press'),
      ).toBe(true);
    }

    const dbBench = results.find((r) => r.def.id === 'dumbbell-bench-press');
    expect(dbBench?.reason).toMatch(/chest/i);
    expect(dbBench?.reason).toMatch(/horizontal press/i);
  });

  it('respects the result limit', () => {
    expect(similarExercises('barbell-bench-press', catalog, 3)).toHaveLength(3);
    expect(similarExercises('barbell-bench-press', catalog, 1)).toHaveLength(1);
  });

  it('excludes cardio exercises from candidates', () => {
    const results = similarExercises('back-squat', catalog);
    expect(results.every((r) => r.def.category !== 'cardio')).toBe(true);
    expect(results.every((r) => r.def.id !== 'running')).toBe(true);
  });
});