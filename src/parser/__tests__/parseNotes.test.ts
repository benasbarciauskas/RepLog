import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog';
import { parseNotes } from '../parseNotes';
import { MESSY_DIALECT_NOTE, MULTI_SESSION_NOTE, PPL_NOTE } from './fixtures/notes';

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

  it('still segments into exactly four workouts (regression)', () => {
    expect(result.workouts.length).toBe(4);
  });
});

describe('parseNotes — messy dialect smoke note', () => {
  const result = parseNotes(MESSY_DIALECT_NOTE, cat, 2024);

  it('segments into two workouts', () => {
    expect(result.workouts.length).toBe(2);
  });

  it('parses push session on 14 Oct with bodyweight 88', () => {
    const push = result.workouts[0];
    expect(push.date).toBe('2024-10-14');
    expect(push.splitCanonical).toBe('push');
    expect(push.bodyweightKg).toBe(88);
  });

  it('captures all push-day exercises with sets', () => {
    const push = result.workouts[0];
    expect(push.exercises.length).toBe(3);
    const bench = push.exercises.find((e) => e.exerciseId === 'barbell-bench-press')!;
    expect(bench.sets).toHaveLength(3);
    const ohp = push.exercises.find((e) => e.exerciseId === 'overhead-press')!;
    expect(ohp.sets.map((s) => s.reps)).toEqual([5, 5, 4]);
  });

  it('parses legs session with scheme and slash-list sets', () => {
    const legs = result.workouts[1];
    expect(legs.splitCanonical).toBe('legs');
    const squat = legs.exercises.find((e) => e.exerciseId === 'back-squat')!;
    expect(squat.sets).toHaveLength(5);
    const pullups = legs.exercises.find((e) => e.exerciseId === 'pull-up')!;
    expect(pullups.sets.map((s) => s.reps)).toEqual([12, 10, 8]);
  });

  it('produces NO false inline-remainder warnings for the messy dialects (regression)', () => {
    // Every line here parses cleanly; the widened space/scheme/slash set formats
    // must not be mis-flagged as unparsed inline entries.
    expect(result.warnings).toEqual([]);
  });
});


describe('parseNotes — mid-line slash rep-list is not a date (regression)', () => {
  // Integration repro: in a FULL note a bodyweight line "pullups 12/10" was
  // mis-consumed as the workout DATE (2026-12-10) and the exercise was dropped,
  // because date extraction ran on the exercise line and chrono read "12/10" as
  // a date. The session is undated; the pullups must survive with 2 sets.
  const note = `wed legs\npullups 12/10\nsquat 140 x5x5`;
  const result = parseNotes(note, cat, 2026);
  const legs = result.workouts[result.workouts.length - 1];

  it('does NOT date the session from the mid-line "12/10" rep-list', () => {
    expect(legs.date).not.toBe('2026-12-10');
    expect(legs.date).toBe('');
  });

  it('keeps the bodyweight pullups exercise with 2 sets (reps 12, 10)', () => {
    const pullups = legs.exercises.find((e) => e.exerciseId === 'pull-up');
    expect(pullups).toBeTruthy();
    expect(pullups!.sets.map((set) => set.reps)).toEqual([12, 10]);
    expect(pullups!.sets.every((set) => set.weightKg === null)).toBe(true);
  });

  it('also keeps the squat exercise (both exercises present, none dropped)', () => {
    const ids = legs.exercises.map((e) => e.exerciseId);
    expect(ids).toContain('pull-up');
    expect(ids).toContain('back-squat');
  });

  it('produces no false inline-remainder warnings', () => {
    expect(result.warnings).toEqual([]);
  });
});
