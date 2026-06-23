import type { SplitCanonical, TrainingBlock, Workout } from '@/types/models';

/** A new training block starts once the gap exceeds this many days. */
const GAP_DAYS = 21;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SPLIT_LABELS: Record<SplitCanonical, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  'chest-back': 'Chest & Back',
  'chest-tris': 'Chest & Triceps',
  'back-bis': 'Back & Biceps',
  shoulders: 'Shoulders',
  arms: 'Arms',
  'full-body': 'Full Body',
  cardio: 'Cardio',
  unknown: 'Mixed',
};

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.abs(b - a) / MS_PER_DAY;
}

/** "19 Jun" / "13 Sep 2023" — year only on the end of a range, like the spec example. */
function formatDay(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  const day = String(Number(d));
  return withYear ? `${day} ${month} ${y}` : `${day} ${month}`;
}

function labelFor(startIso: string, endIso: string, split: SplitCanonical): string {
  const splitName = SPLIT_LABELS[split] ?? split;
  if (startIso === endIso) {
    return `${formatDay(startIso, true)} · ${splitName}`;
  }
  const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4);
  // e.g. "19 Jun – 13 Sep 2023 · Push"
  return `${formatDay(startIso, !sameYear)} – ${formatDay(endIso, true)} · ${splitName}`;
}

/**
 * Group chronologically-ordered sessions into training blocks. A new block
 * begins when EITHER the gap from the previous session exceeds ~21 days OR the
 * canonical split changes. Each block is labelled with its date range + split,
 * e.g. "19 Jun – 13 Sep 2023 · Push".
 */
export function inferBlocks(workouts: Workout[]): TrainingBlock[] {
  if (workouts.length === 0) return [];

  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  const blocks: TrainingBlock[] = [];
  let startIdx = 0;

  const flush = (fromIdx: number, toIdx: number) => {
    const first = ordered[fromIdx];
    const last = ordered[toIdx];
    blocks.push({
      id: `block-${first.date}-${last.date}-${first.splitCanonical}`,
      startDate: first.date,
      endDate: last.date,
      splitCanonical: first.splitCanonical,
      label: labelFor(first.date, last.date, first.splitCanonical),
    });
  };

  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const gapTooBig = daysBetween(prev.date, cur.date) > GAP_DAYS;
    const splitChanged = cur.splitCanonical !== prev.splitCanonical;
    if (gapTooBig || splitChanged) {
      flush(startIdx, i - 1);
      startIdx = i;
    }
  }
  flush(startIdx, ordered.length - 1);

  return blocks;
}
