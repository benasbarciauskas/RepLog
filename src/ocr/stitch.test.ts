import { describe, expect, it } from 'vitest';
import { stitchOcrText } from './stitch';

describe('stitchOcrText', () => {
  it('merges two overlapping fragments into one corpus, deduping the overlap', () => {
    const frameA = `26 Aug 2024
Push day
Benchpress: 105x5, 5, 5
OHP: 70kgx5`;
    // Frame B overlaps the bottom of frame A (scroll), then reveals new lines.
    const frameB = `OHP: 70kgx5
Incline bench: 80x8, 80x8
Cable curls: 20x12`;

    const corpus = stitchOcrText([frameA, frameB]);
    const lines = corpus.split('\n').filter((l) => l.trim() !== '');

    // The overlapping "OHP: 70kgx5" appears exactly once.
    expect(lines.filter((l) => l.startsWith('OHP'))).toHaveLength(1);
    // All unique workout lines are present, in scroll order.
    expect(lines).toEqual([
      '26 Aug 2024',
      'Push day',
      'Benchpress: 105x5, 5, 5',
      'OHP: 70kgx5',
      'Incline bench: 80x8, 80x8',
      'Cable curls: 20x12',
    ]);
  });

  it('treats lines differing only in whitespace/case/edge-punctuation as duplicates', () => {
    const corpus = stitchOcrText(['Bench Press: 100x5', '  bench press: 100x5.  ']);
    expect(corpus.split('\n').filter((l) => l.trim() !== '')).toHaveLength(1);
  });

  it('preserves first-seen order across three frames', () => {
    const corpus = stitchOcrText(['A\nB', 'B\nC', 'C\nD']);
    expect(corpus.split('\n').filter((l) => l.trim() !== '')).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
});
