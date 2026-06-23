import { describe, expect, it } from 'vitest';
import { averageHash, hammingDistance, isNearDuplicate } from './video';

/** Build an 8×8 RGBA buffer from a 64-entry grayscale array (0–255). */
function frame(grays: number[]): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(64 * 4);
  for (let i = 0; i < 64; i++) {
    const g = grays[i] ?? 0;
    buf[i * 4] = g;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = g;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

describe('video frame dedup contract', () => {
  it('identical frames have zero Hamming distance and count as near-duplicates', () => {
    const grays = Array.from({ length: 64 }, (_, i) => (i % 8) * 32);
    const a = frame(grays);
    const b = frame([...grays]);
    expect(hammingDistance(averageHash(a), averageHash(b))).toBe(0);
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it('a tiny single-pixel jitter stays under the dedup threshold', () => {
    const grays: number[] = Array.from({ length: 64 }, (_, i) => (i < 32 ? 10 : 240));
    const a = frame(grays);
    const jittered = [...grays];
    jittered[63] = 200; // one pixel changes brightness slightly
    const b = frame(jittered);
    expect(hammingDistance(averageHash(a), averageHash(b))).toBeLessThanOrEqual(4);
    expect(isNearDuplicate(a, b, 4)).toBe(true);
  });

  it('a clearly different frame exceeds the threshold and is kept', () => {
    const a = frame(Array.from({ length: 64 }, (_, i) => (i < 32 ? 0 : 255)));
    // Invert the brightness pattern — most bits flip.
    const b = frame(Array.from({ length: 64 }, (_, i) => (i < 32 ? 255 : 0)));
    expect(hammingDistance(averageHash(a), averageHash(b))).toBeGreaterThan(4);
    expect(isNearDuplicate(a, b, 4)).toBe(false);
  });
});
