import { describe, expect, it } from 'vitest';
import { filterByRange, metricSeries, sessionHistory } from '../progress';
import type { SetEntry, Workout } from '@/types/models';

function workout(id: string, date: string, sets: SetEntry[]): Workout {
  return {
    id,
    date,
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: `${date}T10:00:00.000Z`,
    exercises: [{ exerciseId: 'barbell-bench-press', rawName: 'Bench', unit: 'kg', sets }],
  };
}

const s = (weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  weightKg,
  reps,
  raw: `${weightKg}x${reps}`,
  ...extra,
});

describe('metricSeries', () => {
  const workouts = [
    workout('w1', '2024-01-01', [s(100, 5), s(105, 3)]),
    workout('w2', '2024-02-01', [s(110, 5), s(100, 8)]),
  ];

  it('heaviest = top working-set weight per session', () => {
    expect(metricSeries(workouts, 'barbell-bench-press', 'heaviest')).toEqual([
      { date: '2024-01-01', value: 105 },
      { date: '2024-02-01', value: 110 },
    ]);
  });

  it('e1rm uses the best Epley estimate that session', () => {
    const series = metricSeries(workouts, 'barbell-bench-press', 'e1rm');
    // w2: 110x5 → 110*(1+5/30)=128.33 vs 100x8 → 126.67 → 128.3
    expect(series[1].value).toBeCloseTo(128.3, 1);
  });

  it('bestSetVolume = max(weight × reps) over the session', () => {
    const series = metricSeries(workouts, 'barbell-bench-press', 'bestSetVolume');
    // w2: max(110*5=550, 100*8=800) = 800
    expect(series[1].value).toBe(800);
  });

  it('sessionVolume sums weight × reps across working sets', () => {
    const series = metricSeries(workouts, 'barbell-bench-press', 'sessionVolume');
    // w1: 100*5 + 105*3 = 815
    expect(series[0].value).toBe(815);
  });

  it('totalReps counts working-set reps even for bodyweight sessions', () => {
    const bw = [workout('w3', '2024-03-01', [s(null, 12), s(null, 10)])];
    const reps = metricSeries(bw, 'barbell-bench-press', 'totalReps');
    expect(reps).toEqual([{ date: '2024-03-01', value: 22 }]);
    // ...but heaviest has no loaded set, so it's skipped.
    expect(metricSeries(bw, 'barbell-bench-press', 'heaviest')).toEqual([]);
  });

  it('excludes warm-up sets', () => {
    const wu = [workout('w4', '2024-04-01', [s(60, 5, { isWarmup: true }), s(120, 3)])];
    expect(metricSeries(wu, 'barbell-bench-press', 'heaviest')).toEqual([
      { date: '2024-04-01', value: 120 },
    ]);
  });
});

describe('sessionHistory', () => {
  it('lists sessions newest-first with full set detail + summaries', () => {
    const workouts = [
      workout('w1', '2024-01-01', [s(100, 5)]),
      workout('w2', '2024-02-01', [s(60, 5, { isWarmup: true }), s(110, 5), s(110, 5)]),
    ];
    const history = sessionHistory(workouts, 'barbell-bench-press');
    expect(history.map((h) => h.date)).toEqual(['2024-02-01', '2024-01-01']);

    const latest = history[0];
    // All 3 sets retained (warm-up included + marked).
    expect(latest.sets).toHaveLength(3);
    expect(latest.sets[0].isWarmup).toBe(true);
    // Summaries count working sets only (warm-up excluded).
    expect(latest.topSetKg).toBe(110);
    expect(latest.sessionVolumeKg).toBe(1100); // 110*5 + 110*5
    expect(latest.totalReps).toBe(10);
  });

  it('returns empty for an exercise with no sessions', () => {
    expect(sessionHistory([], 'barbell-bench-press')).toEqual([]);
  });
});

describe('filterByRange', () => {
  const rows = [
    { date: '2023-01-01', value: 1 },
    { date: '2023-10-01', value: 2 },
    { date: '2023-12-15', value: 3 },
  ];

  it('returns all rows for the all-time range (null months)', () => {
    expect(filterByRange(rows, null)).toEqual(rows);
  });

  it('keeps rows within N months of the latest data point', () => {
    // Anchored to 2023-12-15; 3M cutoff = 2023-09-15 → keeps Oct + Dec.
    const out = filterByRange(rows, 3, '2023-12-15');
    expect(out.map((r) => r.value)).toEqual([2, 3]);
  });

  it('respects an explicit latestDate anchor', () => {
    // 1M back from 2023-12-15 = 2023-11-15 → only Dec remains.
    expect(filterByRange(rows, 1, '2023-12-15').map((r) => r.value)).toEqual([3]);
  });

  it('is a no-op on empty input', () => {
    expect(filterByRange([], 3)).toEqual([]);
  });
});
