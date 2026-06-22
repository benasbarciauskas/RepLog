import { describe, expect, it } from 'vitest';
import { detectSplit, extractBodyweight, extractDate } from '../fields';

describe('extractBodyweight', () => {
  it('parses "87ish kgs" from a date+weight line', () => {
    expect(extractBodyweight('19 June 87ish kgs')).toBe(87);
  });

  it('parses a bare "Weight 88" line', () => {
    expect(extractBodyweight('Weight 88')).toBe(88);
  });

  it('parses "bodyweight: 90.5kg"', () => {
    expect(extractBodyweight('bodyweight: 90.5kg')).toBe(90.5);
  });

  it('parses "BW 84kg"', () => {
    expect(extractBodyweight('BW 84kg')).toBe(84);
  });

  it('returns null when there is no bodyweight signal', () => {
    expect(extractBodyweight('Benchpress 5x5: 105x 5, 5, 5')).toBeNull();
    expect(extractBodyweight('Monday - Chest and Back')).toBeNull();
  });
});

describe('detectSplit', () => {
  it('detects chest-back from "Chest and Back"', () => {
    expect(detectSplit('Monday - Chest and Back').canonical).toBe('chest-back');
  });

  it('detects push from "Day 1: Push"', () => {
    expect(detectSplit('Day 1: Push').canonical).toBe('push');
  });

  it('detects cardio from a marathon line', () => {
    expect(detectSplit('Marathon (42.2km - 6:16 pace)').canonical).toBe('cardio');
  });

  it('detects pull / legs / common PPL splits', () => {
    expect(detectSplit('Pull day').canonical).toBe('pull');
    expect(detectSplit('Leg Day').canonical).toBe('legs');
    expect(detectSplit('Upper').canonical).toBe('upper');
    expect(detectSplit('Lower body').canonical).toBe('lower');
  });

  it('keeps the raw matched text', () => {
    const r = detectSplit('Day 1: Push');
    expect(r.raw).toBeTruthy();
    expect(r.raw?.toLowerCase()).toContain('push');
  });

  it('returns unknown when nothing matches', () => {
    expect(detectSplit('105x5, 120x5').canonical).toBe('unknown');
    expect(detectSplit('105x5, 120x5').raw).toBeNull();
  });
});

describe('extractDate', () => {
  it('parses "13 Nov" with a year hint at high confidence', () => {
    expect(extractDate('13 Nov', 2023)).toMatchObject({
      date: '2023-11-13',
      confidence: 'high',
    });
  });

  it('parses a full date "26 Aug 2024" at high confidence', () => {
    expect(extractDate('Workout from 26 Aug 2024 (PPL)')).toMatchObject({
      date: '2024-08-26',
      confidence: 'high',
    });
  });

  it('parses "19 June" with year hint', () => {
    expect(extractDate('19 June 87ish kgs', 2023)).toMatchObject({
      date: '2023-06-19',
      confidence: 'high',
    });
  });

  it('returns null when there is no date', () => {
    expect(extractDate('Benchpress 5x5: 105x 5, 5, 5')).toBeNull();
  });
});
