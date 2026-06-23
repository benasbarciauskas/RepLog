import { describe, expect, it } from 'vitest';
import { epley1rm } from '../epley';

describe('epley1rm', () => {
  it('estimates 1RM for a 5-rep set (100kg)', () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.67, 1);
  });

  it('estimates 1RM for a 1-rep set (100kg)', () => {
    expect(epley1rm(100, 1)).toBeCloseTo(103.33, 1);
  });

  it('returns the raw weight when reps is 0', () => {
    expect(epley1rm(140, 0)).toBe(140);
  });

  it('scales linearly with weight', () => {
    expect(epley1rm(200, 5)).toBeCloseTo(2 * epley1rm(100, 5), 6);
  });
});
