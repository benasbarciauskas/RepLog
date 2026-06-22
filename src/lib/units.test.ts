import { describe, expect, it } from 'vitest';
import { formatWeight, kgToLb, lbToKg } from './units';

describe('units', () => {
  it('kgToLb(100) ≈ 220.46', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
  });

  it('lbToKg(220.46) ≈ 100', () => {
    expect(lbToKg(220.46)).toBeCloseTo(100, 2);
  });

  it('round-trip kg -> lb -> kg is stable', () => {
    for (const kg of [0, 20, 42.5, 87.5, 140, 222.5]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 6);
    }
  });

  it('formatWeight renders kg with the kg suffix', () => {
    expect(formatWeight(105, 'kg')).toBe('105 kg');
    expect(formatWeight(42.5, 'kg')).toBe('42.5 kg');
  });

  it('formatWeight converts to lb and rounds to 1 decimal', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5 lb');
  });

  it('formatWeight handles null (bodyweight / unspecified)', () => {
    expect(formatWeight(null, 'kg')).toBe('BW');
    expect(formatWeight(null, 'lb')).toBe('BW');
  });

  it('formatWeight drops trailing .0', () => {
    expect(formatWeight(105.0, 'kg')).toBe('105 kg');
  });
});
