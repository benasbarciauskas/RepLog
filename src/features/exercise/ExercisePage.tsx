import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Dumbbell, LineChart, ListOrdered, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { Button } from '@/components/ui/button';
import { useBests, useSettings, useWorkouts } from '@/data/hooks';
import { createCatalog } from '@/parser/catalog';
import { formatWeight } from '@/lib/units';
import type { MuscleGroup, RepPR } from '@/types/models';
import { SegmentedControl } from './SegmentedControl';
import {
  METRICS,
  RANGES,
  filterByRange,
  metricSeries,
  sessionHistory,
  type MetricKey,
  type RangeKey,
  type SessionSet,
} from './progress';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} '${y.slice(2)}`;
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const workouts = useWorkouts();
  const bests = useBests();
  const settings = useSettings();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [metric, setMetric] = useState<MetricKey>('e1rm');
  const [range, setRange] = useState<RangeKey>('all');

  const unit = settings.unit;

  const def = useMemo(() => {
    if (!id) return null;
    const catalog = createCatalog();
    return catalog.all().find((d) => d.id === id) ?? null;
  }, [id]);

  const best = useMemo(
    () => (id ? bests.find((b) => b.exerciseId === id) ?? null : null),
    [bests, id],
  );

  // Full metric series, then filtered to the selected time range.
  const fullSeries = useMemo(
    () => (id ? metricSeries(workouts, id, metric) : []),
    [workouts, id, metric],
  );
  const rangeMonths = RANGES.find((r) => r.key === range)?.months ?? null;
  const series = useMemo(
    () => filterByRange(fullSeries, rangeMonths),
    [fullSeries, rangeMonths],
  );

  const history = useMemo(
    () => (id ? sessionHistory(workouts, id) : []),
    [workouts, id],
  );
  const rangedHistory = useMemo(
    () => filterByRange(history, rangeMonths),
    [history, rangeMonths],
  );

  const metricMeta = METRICS.find((m) => m.key === metric)!;

  // Display name: catalog canonical, else de-slugged id.
  const name = useMemo(() => {
    if (def) return def.canonicalName;
    if (!id) return 'Exercise';
    const slug = id.replace(/^unknown:/, '').replace(/[-_]/g, ' ');
    return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || id;
  }, [def, id]);

  const muscles = useMemo(() => {
    if (!def) return [] as MuscleGroup[];
    return [...new Set([...def.primaryMuscles, ...def.secondaryMuscles])];
  }, [def]);

  const backButton = (
    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
      <ArrowLeft className="size-4" strokeWidth={1.75} />
      Back
    </Button>
  );

  // No id at all → graceful guard.
  if (!id) {
    return (
      <div>
        <PageHeader eyebrow="Exercise" title="Exercise" actions={backButton} />
        <EmptyState
          icon={Dumbbell}
          title="No exercise selected"
          description="Open a lift from your dashboard to see its progression and PR history."
          action={
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const hasData = best != null || history.length > 0;
  // The chart's series unit follows the metric; reps has no unit.
  const seriesLabel =
    metricMeta.unit === 'kg' ? `${metricMeta.short} (${unit})` : metricMeta.short;

  return (
    <div>
      <PageHeader
        eyebrow="Exercise"
        title={name}
        description={
          muscles.length > 0
            ? `Works ${muscles.map(humanMuscle).join(', ')}.`
            : 'Progression by metric, PR history, and every past session.'
        }
        actions={backButton}
      />

      {!hasData ? (
        <EmptyState
          icon={Dumbbell}
          title="No data for this lift yet"
          description="Once you've logged this exercise, its progression chart and session history will appear here."
          action={
            <Button asChild variant="outline">
              <Link to="/">Back to dashboard</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {/* Headline bests */}
          {best ? (
            <section aria-labelledby="ex-bests-heading">
              <h2 id="ex-bests-heading" className="sr-only">
                All-time bests
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Best weight"
                  value={best.maxWeightKg ?? 0}
                  suffix=" kg"
                  decimals={
                    best.maxWeightKg != null && !Number.isInteger(best.maxWeightKg) ? 1 : 0
                  }
                  display={best.maxWeightKg == null ? 'BW' : undefined}
                  tone="highlight"
                  icon={Trophy}
                  hint={best.maxWeightDate ? longDate(best.maxWeightDate) : undefined}
                />
                <StatCard
                  label="Est. 1RM"
                  value={best.bestE1rmKg ?? 0}
                  suffix=" kg"
                  decimals={
                    best.bestE1rmKg != null && !Number.isInteger(best.bestE1rmKg) ? 1 : 0
                  }
                  display={best.bestE1rmKg == null ? '—' : undefined}
                  icon={LineChart}
                  hint={best.bestE1rmDate ? longDate(best.bestE1rmDate) : undefined}
                />
                <StatCard
                  label="Rep PRs"
                  value={best.repPRs.length}
                  icon={Dumbbell}
                  hint="distinct rep counts logged"
                />
              </div>
            </section>
          ) : null}

          {/* Progression — metric toggle + range selector drive the chart */}
          <section aria-labelledby="ex-progress-heading">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2
                id="ex-progress-heading"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <LineChart className="size-4 text-highlight" strokeWidth={1.75} />
                Progression
              </h2>
              <SegmentedControl
                size="compact"
                ariaLabel="Time range"
                options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
                value={range}
                onChange={setRange}
              />
            </div>

            <div className="mb-4">
              <SegmentedControl
                ariaLabel="Progression metric"
                options={METRICS.map((m) => ({ value: m.key, label: m.short }))}
                value={metric}
                onChange={setMetric}
                className="flex-wrap"
              />
            </div>

            {series.length >= 2 ? (
              <LineChartCard
                title={metricMeta.label}
                description={`${metricMeta.label} per session over time`}
                data={series}
                xKey="date"
                dataKey="value"
                seriesLabel={seriesLabel}
                xTickFormatter={(v) => shortDate(String(v))}
              />
            ) : (
              <EmptyState
                icon={LineChart}
                title="Not enough sessions to chart"
                description="Log this lift across at least two sessions in this range to see the trend. Try widening the time range or switching the metric."
              />
            )}
          </section>

          {/* Per-session set history */}
          <section aria-labelledby="ex-history-heading">
            <h2
              id="ex-history-heading"
              className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              <ListOrdered className="size-4 text-highlight" strokeWidth={1.75} />
              Session history
            </h2>
            {rangedHistory.length > 0 ? (
              <ol className="space-y-3">
                {rangedHistory.map((row, i) => (
                  <SessionCard
                    key={row.workoutId}
                    date={row.date}
                    sets={row.sets}
                    volumeKg={row.sessionVolumeKg}
                    unit={unit}
                    index={i}
                    reduce={Boolean(reduce)}
                  />
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={ListOrdered}
                title="No sessions in this range"
                description="Widen the time range to see past sessions for this lift."
              />
            )}
          </section>

          {/* PR history list */}
          {best && best.repPRs.length > 0 ? (
            <section aria-labelledby="ex-pr-heading">
              <h2
                id="ex-pr-heading"
                className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                <Trophy className="size-4 text-highlight" strokeWidth={1.75} />
                PR history
              </h2>
              <RepPrList prs={best.repPRs} unit={unit} reduce={Boolean(reduce)} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  date,
  sets,
  volumeKg,
  unit,
  index,
  reduce,
}: {
  date: string;
  sets: SessionSet[];
  volumeKg: number;
  unit: 'kg' | 'lb';
  index: number;
  reduce: boolean;
}) {
  // Number only the working sets (warm-ups shown but not counted).
  let workingNo = 0;
  return (
    <motion.li
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.26, ease: EASE_OUT, delay: Math.min(index, 8) * 0.03 }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{longDate(date)}</span>
        {volumeKg > 0 ? (
          <span className="tnum text-xs text-muted-foreground">
            {formatWeight(volumeKg, unit)} volume
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-border/60">
        {sets.map((set, i) => {
          const setNo = set.isWarmup ? null : ++workingNo;
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2">
                {set.isWarmup ? (
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Warm-up
                  </span>
                ) : (
                  <span className="tnum w-5 text-center text-xs text-muted-foreground">
                    {setNo}
                  </span>
                )}
                <span className="tnum font-medium text-foreground">
                  {formatWeight(set.weightKg, unit)} × {set.reps}
                </span>
              </span>
              {set.rpe != null ? (
                <span className="tnum text-xs text-muted-foreground">RPE {set.rpe}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </motion.li>
  );
}

function RepPrList({
  prs,
  unit,
  reduce,
}: {
  prs: RepPR[];
  unit: 'kg' | 'lb';
  reduce: boolean;
}) {
  // Heaviest first.
  const ordered = [...prs].sort((a, b) => b.weightKg - a.weightKg);
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {ordered.map((pr, i) => {
        // weightKg 0 = bodyweight rep-PR.
        const isBw = pr.weightKg === 0;
        return (
          <motion.li
            key={`${pr.reps}-${pr.weightKg}`}
            className="flex items-center justify-between gap-4 px-5 py-3.5"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.24, ease: EASE_OUT, delay: Math.min(i, 10) * 0.03 }}
          >
            <div className="flex items-baseline gap-2">
              <span className="tnum text-lg font-semibold text-foreground">
                {isBw ? 'BW' : formatWeight(pr.weightKg, unit)}
              </span>
              <span className="text-sm text-muted-foreground">
                × {pr.reps} {pr.reps === 1 ? 'rep' : 'reps'}
              </span>
            </div>
            <span className="tnum text-xs text-muted-foreground">{longDate(pr.date)}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}
