import type { Unit } from '@/types/models';

/** Exact pounds-per-kilogram conversion factor. */
const LB_PER_KG = 2.2046226218487757;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/**
 * Format a stored kg weight for display in the user's preferred unit.
 * `null` weight (bodyweight / unspecified) renders as "BW".
 * Values are rounded to 1 decimal and trailing ".0" is dropped.
 */
export function formatWeight(weightKg: number | null, unit: Unit): string {
  if (weightKg === null) return 'BW';
  const value = unit === 'lb' ? kgToLb(weightKg) : weightKg;
  return `${trim(value)} ${unit}`;
}

function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}
