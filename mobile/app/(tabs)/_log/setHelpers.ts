import type { PreviousSet } from '@core/features/logger/lib';
import type { Unit } from '@core/types/models';

import { kgToLb, lbToKg } from '@/lib/format';

export function displayNum(n: number | null, unit: Unit): string {
  if (n == null) return '';
  const v = unit === 'lb' ? kgToLb(n) : n;
  return Number(v.toFixed(2)).toString();
}

export function parseToKg(raw: string, unit: Unit): number | null {
  if (raw.trim() === '') return null;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return null;
  const kg = unit === 'lb' ? lbToKg(v) : v;
  return Math.max(0, kg);
}

export function previousLabel(previous: PreviousSet | null, unit: Unit): string {
  if (!previous) return '—';
  const w = displayNum(previous.weightKg, unit) || 'BW';
  return `${w}×${previous.reps}`;
}