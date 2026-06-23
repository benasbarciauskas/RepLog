import { describe, expect, it } from 'vitest';
import { inferBlocks } from '@/analytics/blocks';
import { fixtureWorkouts } from '@/analytics/__tests__/fixtures';
import { compareBlocks, summarizeBlock } from '../lib/blockCompare';
import type { TrainingBlock, Workout } from '@/types/models';

function workout(overrides: Partial<Workout>): Workout {
  return {
    id: 'w1',
    date: '2024-01-01',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2024-01-01T10:00:00.000Z',
    exercises: [],
    ...overrides,
  };
}

describe('summarizeBlock', () => {
  it('counts sessions in the block date range and split', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const pushBlock = blocks[0];
    const summary = summarizeBlock(pushBlock, fixtureWorkouts);
    expect(summary.sessions).toBe(2);
  });

  it('sums volume over working loaded sets (warm-ups excluded, BW = 0)', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const pushBlock = blocks[0];
    const summary = summarizeBlock(pushBlock, fixtureWorkouts);
    // wA: 105*5 + 105*5 = 1050; wB: 140*3 + 130*5 = 1070 → 2120
    expect(summary.totalVolumeKg).toBe(2120);
  });

  it('averages bodyweight when some sessions have null', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const pullBlock = blocks[blocks.length - 1];
    const summary = summarizeBlock(pullBlock, fixtureWorkouts);
    // wC null, wD 89 → avg 89
    expect(summary.avgBodyweightKg).toBe(89);
  });

  it('returns null avg bodyweight when all sessions lack bodyweight', () => {
    const block: TrainingBlock = {
      id: 'b1',
      startDate: '2024-01-01',
      endDate: '2024-01-02',
      splitCanonical: 'push',
      label: 'test',
    };
    const workouts: Workout[] = [
      workout({ date: '2024-01-01', bodyweightKg: null }),
      workout({ id: 'w2', date: '2024-01-02', bodyweightKg: null }),
    ];
    const summary = summarizeBlock(block, workouts);
    expect(summary.avgBodyweightKg).toBeNull();
  });
});

describe('compareBlocks', () => {
  it('computes session and volume deltas between two blocks', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const a = summarizeBlock(blocks[0], fixtureWorkouts);
    const b = summarizeBlock(blocks[blocks.length - 1], fixtureWorkouts);
    const diff = compareBlocks(a, b);

    expect(diff.sessions.a).toBe(2);
    expect(diff.sessions.b).toBe(2);
    expect(diff.sessions.delta).toBe(0);
    expect(diff.volumeKg.delta).toBe(b.totalVolumeKg - a.totalVolumeKg);
  });

  it('returns null volume pct when block A volume is zero', () => {
    const empty: BlockSummaryLike = {
      blockId: 'empty',
      sessions: 0,
      totalVolumeKg: 0,
      avgBodyweightKg: null,
      bestE1rmByExercise: new Map(),
    };
    const filled: BlockSummaryLike = {
      blockId: 'filled',
      sessions: 1,
      totalVolumeKg: 500,
      avgBodyweightKg: 80,
      bestE1rmByExercise: new Map([['barbell-bench-press', 120]]),
    };
    const diff = compareBlocks(empty, filled);
    expect(diff.volumeKg.pct).toBeNull();
  });

  it('includes only lifts trained in both blocks', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const a = summarizeBlock(blocks[0], fixtureWorkouts);
    const b = summarizeBlock(blocks[blocks.length - 1], fixtureWorkouts);
    const diff = compareBlocks(a, b);

    const ids = diff.lifts.map((l) => l.exerciseId);
    expect(ids).toContain('barbell-bench-press');
    expect(ids).not.toContain('pull-up');
  });

  it('computes e1RM deltas for shared lifts', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const a = summarizeBlock(blocks[0], fixtureWorkouts);
    const b = summarizeBlock(blocks[blocks.length - 1], fixtureWorkouts);
    const diff = compareBlocks(a, b);

    const bench = diff.lifts.find((l) => l.exerciseId === 'barbell-bench-press')!;
    expect(bench.a).not.toBeNull();
    expect(bench.b).not.toBeNull();
    expect(bench.deltaKg).toBeCloseTo((bench.b as number) - (bench.a as number), 1);
  });
});

type BlockSummaryLike = ReturnType<typeof summarizeBlock>;