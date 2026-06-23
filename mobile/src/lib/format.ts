import { formatWeight as formatWeightCore } from '@core/lib/units';
import type { Unit } from '@core/types/models';

export { formatWeight, kgToLb, lbToKg } from '@core/lib/units';

/** Format a stored kg weight for display in the user's preferred unit. */
export function formatUserWeight(weightKg: number | null, unit: Unit): string {
  return formatWeightCore(weightKg, unit);
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** ISO `yyyy-mm-dd` → "13 Sep '23" (chart ticks). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const month = MONTHS_SHORT[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} '${y.slice(2)}`;
}

/** ISO `yyyy-mm-dd` → "13 Sep 2023" (card hints). */
export function longDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-');
  const month = MONTHS_SHORT[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

/** ISO datetime → locale date/time string for lists. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}