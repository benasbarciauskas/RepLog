/**
 * Estimated one-rep max via the Epley formula: w * (1 + reps/30).
 * For reps === 1 this returns slightly above the raw weight (1 + 1/30),
 * matching the spec's expectation that epley1rm(100, 1) ≈ 103.33.
 */
export function epley1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}
