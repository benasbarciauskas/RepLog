import { describe, expect, it } from 'vitest';
import { bodyweightSeries } from '../bodyweight';
import { fixtureWorkouts } from './fixtures';

describe('bodyweightSeries', () => {
  it('returns only workouts that recorded a bodyweight', () => {
    const series = bodyweightSeries(fixtureWorkouts);
    // wA(87), wB(88), wD(89) have weight; wC has null → skipped.
    expect(series).toEqual([
      { date: '2023-06-19', kg: 87 },
      { date: '2023-07-10', kg: 88 },
      { date: '2023-09-15', kg: 89 },
    ]);
  });

  it('returns dates in ascending order even when input is unsorted', () => {
    const shuffled = [...fixtureWorkouts].reverse();
    const series = bodyweightSeries(shuffled);
    const dates = series.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('returns an empty array when no workout has bodyweight', () => {
    const none = fixtureWorkouts.map((w) => ({ ...w, bodyweightKg: null }));
    expect(bodyweightSeries(none)).toEqual([]);
  });
});
