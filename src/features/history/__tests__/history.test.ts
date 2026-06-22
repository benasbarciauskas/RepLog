import { describe, expect, it } from 'vitest';
import { groupByMonth, historyRows } from '../history';
import type { SetEntry, SplitCanonical, Workout } from '@/types/models';

function workout(
  id: string,
  date: string,
  split: SplitCanonical,
  sets: SetEntry[],
): Workout {
  return {
    id,
    date,
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: split,
    splitRaw: null,
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

describe('historyRows', () => {
  it('lists workouts newest-first with split label, counts, and volume', () => {
    const workouts = [
      workout('a', '2023-06-19', 'push', [s(100, 5), s(60, 5, { isWarmup: true })]),
      workout('b', '2023-07-10', 'legs', [s(140, 3)]),
    ];
    const rows = historyRows(workouts);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']); // newest first
    const push = rows.find((r) => r.id === 'a')!;
    expect(push.splitLabel).toBe('Push');
    expect(push.exerciseCount).toBe(1);
    expect(push.setCount).toBe(1); // warm-up excluded
    expect(push.volumeKg).toBe(500);
  });

  it('maps an unknown split to "Mixed"', () => {
    const rows = historyRows([workout('a', '2023-06-19', 'unknown', [s(100, 5)])]);
    expect(rows[0].splitLabel).toBe('Mixed');
  });
});

describe('groupByMonth', () => {
  it('groups rows into newest-first months with human labels', () => {
    const workouts = [
      workout('a', '2023-06-19', 'push', [s(100, 5)]),
      workout('b', '2023-07-10', 'legs', [s(140, 3)]),
      workout('c', '2023-07-25', 'pull', [s(80, 8)]),
    ];
    const months = groupByMonth(workouts);
    expect(months.map((m) => m.label)).toEqual(['July 2023', 'June 2023']);
    expect(months[0].rows.map((r) => r.id)).toEqual(['c', 'b']); // newest in-month first
  });

  it('returns an empty array for no workouts', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
