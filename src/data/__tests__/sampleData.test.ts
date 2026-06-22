import { describe, expect, it } from 'vitest';
import { SAMPLE_WORKOUTS } from '../sampleData';
import { computeBests } from '@/analytics/bests';
import { analyzeImbalances } from '@/coach/analyze';
import { createCatalog } from '@/parser/catalog';
import type { Workout } from '@/types/models';

/**
 * The sample dataset is a product surface: the "Try with sample data" button
 * promises a populated dashboard + a meaningful coach finding. These tests lock
 * that promise in so a future catalog/coach change can't silently gut the demo.
 */
describe('SAMPLE_WORKOUTS', () => {
  it('is a non-trivial set of valid workouts', () => {
    expect(SAMPLE_WORKOUTS.length).toBeGreaterThanOrEqual(4);
    for (const w of SAMPLE_WORKOUTS as Workout[]) {
      expect(w.id).toMatch(/^sample-/);
      expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.exercises.length).toBeGreaterThan(0);
    }
  });

  it('uses only canonical (non-unknown) catalog exerciseIds', () => {
    const known = new Set(createCatalog().all().map((d) => d.id));
    for (const w of SAMPLE_WORKOUTS) {
      for (const ex of w.exercises) {
        expect(ex.exerciseId.startsWith('unknown:')).toBe(false);
        expect(known.has(ex.exerciseId)).toBe(true);
      }
    }
  });

  it('produces a visible PR grid (several loaded bests)', () => {
    const loaded = computeBests(SAMPLE_WORKOUTS).filter((b) => b.maxWeightKg != null);
    expect(loaded.length).toBeGreaterThanOrEqual(5);
    // The headline 140kg bench day should land as the bench max.
    const bench = loaded.find((b) => b.exerciseId === 'barbell-bench-press');
    expect(bench?.maxWeightKg).toBe(140);
  });

  it('surfaces at least one priority coach finding', () => {
    const findings = analyzeImbalances(computeBests(SAMPLE_WORKOUTS));
    expect(findings.some((f) => f.severity === 'priority')).toBe(true);
    // Specifically the canonical OHP-vs-bench front-delt deficit.
    const ohp = findings.find((f) => f.ruleId === 'ohp-bench');
    expect(ohp?.severity).toBe('priority');
  });
});
