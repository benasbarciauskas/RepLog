import { describe, expect, it } from 'vitest';
import { inferBlocks } from '../blocks';
import { fixtureWorkouts } from './fixtures';

describe('inferBlocks', () => {
  it('splits into ≥2 blocks across a >21d gap and a split change', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('orders blocks chronologically and covers each session date range', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    expect(blocks[0].startDate).toBe('2023-06-19');
    expect(blocks[0].endDate).toBe('2023-07-10');
    const last = blocks[blocks.length - 1];
    expect(last.startDate).toBe('2023-09-13');
    expect(last.endDate).toBe('2023-09-15');
  });

  it('labels each block with its date range and split', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    // Spec example: "19 Jun – 13 Sep 2023 · PPL". Labels include the split name.
    expect(blocks[0].label).toMatch(/Push/i);
    expect(blocks[0].label).toMatch(/2023/);
    expect(blocks[blocks.length - 1].label).toMatch(/Pull/i);
  });

  it('assigns a stable id to each block', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('keeps a contiguous same-split run within a >21d window in one block', () => {
    const blocks = inferBlocks(fixtureWorkouts);
    // wC (Sep 13) and wD (Sep 15) are both pull, 2 days apart → same block.
    const last = blocks[blocks.length - 1];
    expect(last.splitCanonical).toBe('pull');
    expect(last.startDate).toBe('2023-09-13');
    expect(last.endDate).toBe('2023-09-15');
  });

  it('returns an empty array for no workouts', () => {
    expect(inferBlocks([])).toEqual([]);
  });
});
