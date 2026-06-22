import { describe, expect, it } from 'vitest';
import { isWorkoutRelated } from '../relevance';
import { PPL_NOTE } from './fixtures/notes';

describe('isWorkoutRelated', () => {
  it('keeps a real workout note (split + sets)', () => {
    expect(isWorkoutRelated(PPL_NOTE)).toBe(true);
  });

  it('keeps a bare set-data line with no split keyword', () => {
    expect(isWorkoutRelated('Benchpress 5x5: 105x 5, 5, 5, 5, 4')).toBe(true);
  });

  it('keeps a lone split header', () => {
    expect(isWorkoutRelated('Monday - Chest and Back')).toBe(true);
  });

  it('keeps a date + bodyweight session header', () => {
    expect(isWorkoutRelated('28 Aug 2024\nPull - 87 kgs')).toBe(true);
  });

  it('drops a grocery list', () => {
    const grocery = `Groceries
- milk
- eggs
- bread
- 2 bananas
- coffee beans`;
    expect(isWorkoutRelated(grocery)).toBe(false);
  });

  it('drops a random note with no workout signal', () => {
    const random = `Call the dentist on Thursday.
Remember: parking permit renews next month.
Idea: weekend trip to the coast.`;
    expect(isWorkoutRelated(random)).toBe(false);
  });

  it('drops empty / whitespace input', () => {
    expect(isWorkoutRelated('')).toBe(false);
    expect(isWorkoutRelated('   \n  \n')).toBe(false);
  });
});
