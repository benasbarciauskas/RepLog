import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog';
import { parseNotes } from '../parseNotes';
import { MULTI_SESSION_NOTE, PPL_NOTE } from './fixtures/notes';

const cat = createCatalog();

describe('parseNotes — single PPL session', () => {
  const result = parseNotes(PPL_NOTE, cat);

  it('produces at least one workout', () => {
    expect(result.workouts.length).toBeGreaterThanOrEqual(1);
  });

  it('detects the date (26 Aug 2024) at high confidence', () => {
    const w = result.workouts[0];
    expect(w.date).toBe('2024-08-26');
    expect(w.dateConfidence).toBe('high');
  });

  it('detects the split (push)', () => {
    expect(result.workouts[0].splitCanonical).toBe('push');
  });

  it('captures bodyweight (88)', () => {
    expect(result.workouts[0].bodyweightKg).toBe(88);
  });

  it('parses at least three exercises with correct ids', () => {
    const w = result.workouts[0];
    expect(w.exercises.length).toBeGreaterThanOrEqual(3);
    const ids = w.exercises.map((e) => e.exerciseId);
    expect(ids).toContain('barbell-bench-press');
    expect(ids).toContain('overhead-press');
    expect(ids).toContain('incline-bench');
  });

  it('flags the uncatalogued cable bicep isos as unknown but keeps the sets', () => {
    const w = result.workouts[0];
    const iso = w.exercises.find((e) => e.exerciseId.startsWith('unknown:'));
    expect(iso).toBeTruthy();
    expect(iso?.sets.map((s) => s.reps)).toEqual([11, 12]);
  });
});

describe('parseNotes — multi-session note', () => {
  const result = parseNotes(MULTI_SESSION_NOTE, cat);

  it('segments into multiple workouts', () => {
    expect(result.workouts.length).toBeGreaterThanOrEqual(3);
  });

  it('detects the marathon session as cardio', () => {
    const cardio = result.workouts.find((w) => w.splitCanonical === 'cardio');
    expect(cardio).toBeTruthy();
  });

  it('resolves the weighted pull-up session correctly', () => {
    const pull = result.workouts.find((w) =>
      w.exercises.some((e) => e.exerciseId === 'weighted-pull-up'),
    );
    expect(pull).toBeTruthy();
    const wpu = pull!.exercises.find((e) => e.exerciseId === 'weighted-pull-up')!;
    expect(wpu.sets.map((s) => s.reps)).toEqual([5, 5, 5, 5, 7, 13]);
    expect(wpu.sets.every((s) => s.weightKg === 30)).toBe(true);
  });

  it('keeps a bodyweight pull-up set in the same session as pull-up', () => {
    const pull = result.workouts.find((w) =>
      w.exercises.some((e) => e.exerciseId === 'weighted-pull-up'),
    )!;
    const bw = pull.exercises.find((e) => e.exerciseId === 'pull-up');
    expect(bw).toBeTruthy();
    expect(bw?.sets.slice(0, 3).map((s) => s.reps)).toEqual([20, 16, 12]);
  });

  it('flags the inline "archers x 10" secondary exercise as a warning (not silently dropped)', () => {
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /archer/i.test(w))).toBe(true);
  });
});
