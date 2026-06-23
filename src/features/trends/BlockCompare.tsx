import { useMemo, useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { inferBlocks } from '@/analytics/blocks';
import { useSettings } from '@/data/hooks';
import { formatWeight, kgToLb } from '@/lib/units';
import type { Unit, Workout } from '@/types/models';
import { compareBlocks, summarizeBlock } from './lib/blockCompare';
import { useExerciseName } from './useExerciseName';

const SELECT_CLASS =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

function formatNum(n: number | null, unit: Unit, isWeight = false): string {
  if (n == null) return '—';
  if (isWeight) return formatWeight(n, unit);
  return Number(n.toFixed(1)).toString();
}

function formatDelta(
  delta: number | null,
  unit: Unit,
  isWeight = false,
): { text: string; tone: 'up' | 'muted' } {
  if (delta == null) return { text: '—', tone: 'muted' };
  if (delta === 0) return { text: '0', tone: 'muted' };
  const value = isWeight && unit === 'lb' ? kgToLb(delta) : delta;
  const trimmed = Number(value.toFixed(1)).toString();
  const prefix = delta > 0 ? '+' : '';
  const suffix = isWeight ? unit : '';
  return {
    text: `${prefix}${trimmed}${suffix}`,
    tone: delta > 0 ? 'up' : 'muted',
  };
}

function formatPct(pct: number | null): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(0)}%`;
}

export function BlockCompare({ workouts }: { workouts: Workout[] }) {
  const settings = useSettings();
  const resolveName = useExerciseName();
  const unit = settings.unit;

  const blocks = useMemo(() => inferBlocks(workouts), [workouts]);

  const defaultA = blocks.length >= 2 ? blocks[blocks.length - 2].id : '';
  const defaultB = blocks.length >= 1 ? blocks[blocks.length - 1].id : '';

  const [blockAId, setBlockAId] = useState(defaultA);
  const [blockBId, setBlockBId] = useState(defaultB);

  const effectiveAId = blocks.some((b) => b.id === blockAId) ? blockAId : defaultA;
  const effectiveBId = blocks.some((b) => b.id === blockBId) ? blockBId : defaultB;

  const blockA = blocks.find((b) => b.id === effectiveAId);
  const blockB = blocks.find((b) => b.id === effectiveBId);

  const diff = useMemo(() => {
    if (!blockA || !blockB) return null;
    return compareBlocks(
      summarizeBlock(blockA, workouts),
      summarizeBlock(blockB, workouts),
    );
  }, [blockA, blockB, workouts]);

  if (blocks.length < 2) {
    return (
      <section aria-labelledby="block-compare-heading">
        <h2
          id="block-compare-heading"
          className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          <GitCompareArrows className="size-4 text-highlight" strokeWidth={1.75} />
          Block compare
        </h2>
        <p className="text-sm text-muted-foreground">
          Need at least two training blocks to compare.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="block-compare-heading">
      <h2
        id="block-compare-heading"
        className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        <GitCompareArrows className="size-4 text-highlight" strokeWidth={1.75} />
        Block compare
      </h2>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="block-a" className="mb-1 block text-xs font-medium text-muted-foreground">
            Block A
          </label>
          <select
            id="block-a"
            aria-label="Select block A"
            className={SELECT_CLASS}
            value={effectiveAId}
            onChange={(e) => setBlockAId(e.target.value)}
          >
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="block-b" className="mb-1 block text-xs font-medium text-muted-foreground">
            Block B
          </label>
          <select
            id="block-b"
            aria-label="Select block B"
            className={SELECT_CLASS}
            value={effectiveBId}
            onChange={(e) => setBlockBId(e.target.value)}
          >
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {diff ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Metric</th>
                <th className="tnum px-4 py-3 font-semibold">A</th>
                <th className="tnum px-4 py-3 font-semibold">B</th>
                <th className="tnum px-4 py-3 font-semibold">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <MetricRow
                label="Sessions"
                a={String(diff.sessions.a)}
                b={String(diff.sessions.b)}
                delta={formatDelta(diff.sessions.delta, unit)}
              />
              <MetricRow
                label="Volume"
                a={formatNum(diff.volumeKg.a, unit, true)}
                b={formatNum(diff.volumeKg.b, unit, true)}
                delta={formatDelta(diff.volumeKg.delta, unit, true)}
                extra={formatPct(diff.volumeKg.pct)}
              />
              <MetricRow
                label="Bodyweight"
                a={formatNum(diff.bodyweightKg.a, unit, true)}
                b={formatNum(diff.bodyweightKg.b, unit, true)}
                delta={formatDelta(diff.bodyweightKg.delta, unit, true)}
              />
              {diff.lifts.map((lift) => (
                <MetricRow
                  key={lift.exerciseId}
                  label={resolveName(lift.exerciseId)}
                  a={formatNum(lift.a, unit, true)}
                  b={formatNum(lift.b, unit, true)}
                  delta={formatDelta(lift.deltaKg, unit, true)}
                  sub
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function MetricRow({
  label,
  a,
  b,
  delta,
  extra,
  sub,
}: {
  label: string;
  a: string;
  b: string;
  delta: { text: string; tone: 'up' | 'muted' };
  extra?: string;
  sub?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-3 ${sub ? 'pl-6 text-muted-foreground' : 'font-medium text-foreground'}`}>
        {label}
        {extra ? (
          <span className="tnum ml-1 text-xs text-muted-foreground">({extra})</span>
        ) : null}
      </td>
      <td className="tnum px-4 py-3 text-foreground">{a}</td>
      <td className="tnum px-4 py-3 text-foreground">{b}</td>
      <td
        className={`tnum px-4 py-3 font-medium ${
          delta.tone === 'up' ? 'text-emerald-400' : 'text-muted-foreground'
        }`}
      >
        {delta.text}
      </td>
    </tr>
  );
}