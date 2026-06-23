import { describe, expect, it } from 'vitest';
import { segmentWorkouts } from '../segment';

describe('segmentWorkouts', () => {
  it('returns a single chunk for a single-session note', () => {
    const note = `Workout from 26 Aug 2024 (PPL)
Benchpress 5x5: 105x5, 5, 5
OHP: 70kgx5, 60kgx8`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('Benchpress');
  });

  it('splits on date headers into multiple chunks', () => {
    const note = `13 Nov
Bench: 100x5, 5
Squat: 140x5

20 Nov
Deadlift: 180x3
Pull-ups: 20, 16`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('13 Nov');
    expect(chunks[1]).toContain('20 Nov');
    expect(chunks[1]).toContain('Deadlift');
  });

  it('splits on a "Workout from <date>" marker', () => {
    const note = `Workout from 26 Aug 2024 (PPL)
Bench: 100x5

Workout from 28 Aug 2024 (Pull)
Row: 80x8`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(2);
  });

  it('drops empty whitespace between sessions', () => {
    const note = `13 Nov
Bench: 100x5


20 Nov
Squat: 140x5`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(2);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });

  it('returns [] for empty input', () => {
    expect(segmentWorkouts('')).toEqual([]);
    expect(segmentWorkouts('   \n  \n')).toEqual([]);
  });

  it('treats a note with no date markers as one chunk', () => {
    const note = `Bench: 100x5, 5
Squat: 140x5`;
    expect(segmentWorkouts(note).length).toBe(1);
  });

  it('splits on weekday-led session headers', () => {
    const note = `mon 14/10 push day @ 88kg
bench press 100x5

wed legs
squat 140 x5x5`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('mon 14/10');
    expect(chunks[1]).toContain('wed legs');
  });

  it('splits on bare weekday + split word headers', () => {
    const note = `Monday push
bench 100x5

wed legs
squat 140x5`;
    const chunks = segmentWorkouts(note);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('Monday push');
    expect(chunks[1]).toContain('wed legs');
  });

  it('does not split on weekday prose inside an exercise line', () => {
    const note = `Bench: 100x5
Monday felt heavy — squat 140x5`;
    expect(segmentWorkouts(note).length).toBe(1);
  });
});
