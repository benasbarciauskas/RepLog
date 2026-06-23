import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useSettings } from '@/data/hooks';
import { formatWeight, kgToLb } from '@/lib/units';
import type { Unit, Workout } from '@/types/models';
import { buildPrTimeline, type PrEvent } from './lib/prTimeline';
import { useExerciseName } from './useExerciseName';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
}

function formatDelta(deltaKg: number, unit: Unit, isFirst: boolean): string {
  if (isFirst) return 'first';
  const value = unit === 'lb' ? kgToLb(deltaKg) : deltaKg;
  const trimmed = Number(value.toFixed(1)).toString();
  return `+${trimmed}${unit}`;
}

function kindLabel(kind: PrEvent['kind']): string {
  return kind === 'weight' ? 'Heaviest set' : 'Est. 1RM';
}

const SELECT_CLASS =
  'w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export function PrTimeline({ workouts }: { workouts: Workout[] }) {
  const settings = useSettings();
  const resolveName = useExerciseName();
  const reduce = useReducedMotion();
  const unit = settings.unit;

  const events = useMemo(() => buildPrTimeline(workouts), [workouts]);

  const liftOptions = useMemo(() => {
    const ids = [...new Set(events.map((e) => e.exerciseId))].sort((a, b) =>
      resolveName(a).localeCompare(resolveName(b)),
    );
    return ids;
  }, [events, resolveName]);

  const [liftFilter, setLiftFilter] = useState<string>('all');

  const filtered = useMemo(
    () =>
      liftFilter === 'all'
        ? events
        : events.filter((e) => e.exerciseId === liftFilter),
    [events, liftFilter],
  );

  const months = useMemo(() => {
    const groups = new Map<string, PrEvent[]>();
    for (const ev of filtered) {
      const key = monthKey(ev.date);
      const list = groups.get(key) ?? [];
      list.push(ev);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, rows]) => ({ key, label: monthLabel(key), rows }));
  }, [filtered]);

  return (
    <section aria-labelledby="pr-timeline-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="pr-timeline-heading"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          <Trophy className="size-4 text-highlight" strokeWidth={1.75} />
          PR timeline
        </h2>
        {liftOptions.length > 0 ? (
          <select
            aria-label="Filter by lift"
            className={SELECT_CLASS}
            value={liftFilter}
            onChange={(e) => setLiftFilter(e.target.value)}
          >
            <option value="all">All lifts</option>
            {liftOptions.map((id) => (
              <option key={id} value={id}>
                {resolveName(id)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No personal records yet — log loaded working sets to see your PR feed.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PRs for this lift.</p>
      ) : (
        <div className="space-y-8">
          {months.map((month) => (
            <div key={month.key}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {month.label}
              </h3>
              <ul className="space-y-2">
                {month.rows.map((ev, i) => (
                  <PrRow
                    key={`${ev.date}-${ev.exerciseId}-${ev.kind}`}
                    event={ev}
                    unit={unit}
                    name={resolveName(ev.exerciseId)}
                    index={i}
                    reduce={Boolean(reduce)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PrRow({
  event,
  unit,
  name,
  index,
  reduce,
}: {
  event: PrEvent;
  unit: Unit;
  name: string;
  index: number;
  reduce: boolean;
}) {
  const dotColor = event.kind === 'weight' ? 'bg-highlight' : 'bg-emerald-500';

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay: Math.min(index, 10) * 0.03 }}
    >
      <Link
        to={`/exercise/${event.exerciseId}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className={`size-2.5 shrink-0 rounded-full ${dotColor}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">{kindLabel(event.kind)}</span>
          </div>
          <p className="tnum mt-0.5 text-sm text-foreground">
            {formatWeight(event.valueKg, unit)}
            {event.kind === 'weight' && event.reps != null ? (
              <span className="text-muted-foreground"> × {event.reps}</span>
            ) : null}
          </p>
        </div>
        <span
          className={`tnum shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            event.isFirst
              ? 'bg-surface text-muted-foreground'
              : 'bg-emerald-500/15 text-emerald-400'
          }`}
        >
          {formatDelta(event.deltaKg, unit, event.isFirst)}
        </span>
      </Link>
    </motion.li>
  );
}