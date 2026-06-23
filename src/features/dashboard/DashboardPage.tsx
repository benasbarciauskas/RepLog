import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  CalendarDays,
  Dumbbell,
  Flame,
  LineChart,
  type LucideProps,
  Scale,
  Trophy,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { AreaChartCard } from '@/components/charts/AreaChartCard';
import { RingGauge, type GaugeTone } from '@/components/charts/RingGauge';
import { Button } from '@/components/ui/button';
import { useBests, useBlocks, useBodyweightSeries, useWorkouts } from '@/data/hooks';
import { epley1rm } from '@/analytics/epley';
import { balanceScore, overallLabel } from '@/coach/score';
import { createCatalog } from '@/parser/catalog';
import { formatWeight } from '@/lib/units';
import type { ExerciseBest, Workout } from '@/types/models';
import { ClearAllDataButton, TrySampleDataButton } from '@/features/data/DataActions';
import { SplitHistoryStrip } from './SplitHistoryStrip';
import { LiftSelect } from './LiftSelect';
import { dashboardStats } from './stats';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Resolve a catalog/unknown exerciseId to a display name. */
function useNameResolver() {
  const catalog = useMemo(() => createCatalog(), []);
  return useMemo(() => {
    const byId = new Map(catalog.all().map((d) => [d.id, d.canonicalName]));
    return (exerciseId: string): string => {
      const known = byId.get(exerciseId);
      if (known) return known;
      // unknown:<slug> → title-cased slug
      const slug = exerciseId.replace(/^unknown:/, '').replace(/[-_]/g, ' ');
      return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || exerciseId;
    };
  }, [catalog]);
}

/** Short ISO date → "13 Sep '23" for chart ticks. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} '${y.slice(2)}`;
}

/** Friendly date for a card hint, e.g. "13 Sep 2023". */
function longDate(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
}

/**
 * Best est-1RM per session for one exercise, chronological — the PR-timeline
 * series. Warmups excluded; bodyweight-only sets skipped (no external load).
 */
function e1rmSeries(
  workouts: Workout[],
  exerciseId: string,
): { date: string; e1rm: number }[] {
  const series: { date: string; e1rm: number }[] = [];
  for (const w of workouts) {
    let best = 0;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (s.isWarmup || s.weightKg == null) continue;
        const e = epley1rm(s.weightKg, s.reps);
        if (e > best) best = e;
      }
    }
    if (best > 0) series.push({ date: w.date, e1rm: Math.round(best * 10) / 10 });
  }
  return series;
}

/** Bests that have a loaded best (i.e. a real weight PR to show), ranked by est-1RM. */
function rankedBests(bests: ExerciseBest[]): ExerciseBest[] {
  return [...bests]
    .filter((b) => b.maxWeightKg != null)
    .sort((a, b) => (b.bestE1rmKg ?? 0) - (a.bestE1rmKg ?? 0));
}

export default function DashboardPage() {
  const workouts = useWorkouts();
  const bests = useBests();
  const blocks = useBlocks();
  const bodyweight = useBodyweightSeries();
  const resolveName = useNameResolver();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const loaded = useMemo(() => rankedBests(bests), [bests]);

  const score = useMemo(() => balanceScore(bests), [bests]);
  const stats = useMemo(() => dashboardStats(workouts, bests), [workouts, bests]);

  // Lift selector for the PR timeline — default to the strongest lift.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timelineId = selectedId ?? loaded[0]?.exerciseId ?? null;
  const timeline = useMemo(
    () => (timelineId ? e1rmSeries(workouts, timelineId) : []),
    [workouts, timelineId],
  );

  // Empty: no data at all → CTA to import.
  if (workouts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Your numbers"
          title="Dashboard"
          description="All-time bests, PR timeline, and your training history at a glance."
        />
        <EmptyState
          icon={Dumbbell}
          title="No workouts yet"
          description="Import your training notes — screenshots or pasted text — and your all-time bests, est. 1RMs, and progression charts will appear here. Or load a few demo workouts to look around first."
          action={
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/import">
                  <Upload className="size-4" strokeWidth={1.75} />
                  Import your notes
                </Link>
              </Button>
              <TrySampleDataButton variant="outline" />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your numbers"
        title="Dashboard"
        description="All-time bests, PR timeline, and your training history at a glance."
      />

      <div className="space-y-10">
        {/* Balance Score hero + progress cards */}
        <section
          aria-labelledby="overview-heading"
          className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr] lg:items-stretch"
        >
          <h2 id="overview-heading" className="sr-only">
            Overview
          </h2>

          {/* Balance Score ring → links to the coach */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <Link
              to="/coach"
              className="group flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm transition-colors hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {score.overall != null ? (
                <>
                  <RingGauge
                    value={score.overall}
                    size={140}
                    tone={scoreTone(score.overall)}
                    label="Balance"
                    ariaLabel={`Balance Score ${score.overall} out of 100`}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    {overallLabel(score.overall)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-highlight">
                    Open coach
                    <ArrowUpRight className="size-3.5" strokeWidth={2} />
                  </span>
                </>
              ) : (
                <>
                  <RingGauge value={0} size={140} tone="muted" showValue={false} label="Balance">
                    <span className="text-2xl font-semibold text-muted-foreground">—</span>
                  </RingGauge>
                  <span className="max-w-[12rem] text-xs text-muted-foreground">
                    Log two comparable lifts to unlock your Balance Score.
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-highlight">
                    Open coach
                    <ArrowUpRight className="size-3.5" strokeWidth={2} />
                  </span>
                </>
              )}
            </Link>
          </motion.div>

          {/* Progress cards */}
          <div className="grid grid-cols-2 gap-4">
            <ProgressCard
              label="This week"
              value={stats.thisWeekVolumeKg}
              suffix=" kg"
              decimals={stats.thisWeekVolumeKg % 1 === 0 ? 0 : 1}
              hint={
                stats.weeklyVolumeDeltaPct != null
                  ? `${stats.weeklyVolumeDeltaPct >= 0 ? '+' : ''}${stats.weeklyVolumeDeltaPct}% vs last week`
                  : 'Volume lifted'
              }
              icon={LineChart}
              index={0}
              reduce={Boolean(reduce)}
            />
            <ProgressCard
              label="Streak"
              value={stats.streakWeeks}
              suffix={stats.streakWeeks === 1 ? ' wk' : ' wks'}
              hint="Consecutive weeks trained"
              tone="highlight"
              icon={Flame}
              index={1}
              reduce={Boolean(reduce)}
            />
            <ProgressCard
              label="This month"
              value={stats.workoutsThisMonth}
              hint={stats.workoutsThisMonth === 1 ? 'Workout logged' : 'Workouts logged'}
              icon={CalendarDays}
              index={2}
              reduce={Boolean(reduce)}
            />
            <ProgressCard
              label="PRs this month"
              value={stats.prsThisPeriod}
              hint="In the last 30 days"
              tone="highlight"
              icon={Trophy}
              index={3}
              reduce={Boolean(reduce)}
            />
          </div>
        </section>

        {/* All-time bests grid */}
        <section aria-labelledby="bests-heading">
          <SectionTitle id="bests-heading" icon={Trophy}>
            All-time bests
          </SectionTitle>
          {loaded.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No weighted PRs yet"
              description="Log a weighted lift (not just bodyweight) to start tracking maxes and estimated 1RMs."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loaded.map((best, i) => {
                const name = resolveName(best.exerciseId);
                const e1rm = best.bestE1rmKg ?? best.maxWeightKg ?? 0;
                return (
                  <motion.div
                    key={best.exerciseId}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      duration: 0.28,
                      ease: EASE_OUT,
                      delay: Math.min(i, 8) * 0.04,
                    }}
                  >
                    <StatCard
                      label={name}
                      value={best.maxWeightKg ?? 0}
                      suffix=" kg"
                      decimals={best.maxWeightKg != null && !Number.isInteger(best.maxWeightKg) ? 1 : 0}
                      tone="highlight"
                      icon={Trophy}
                      interactive
                      onClick={() => navigate(`/exercise/${best.exerciseId}`)}
                      hint={`Est. 1RM ${formatWeight(e1rm, 'kg')}${
                        best.maxWeightDate ? ` · ${longDate(best.maxWeightDate)}` : ''
                      }`}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* PR timeline */}
        {timelineId ? (
          <section aria-labelledby="timeline-heading">
            <SectionTitle id="timeline-heading" icon={LineChart}>
              PR timeline
            </SectionTitle>
            {timeline.length >= 2 ? (
              <LineChartCard
                title={resolveName(timelineId)}
                description="Estimated 1RM over time"
                data={timeline}
                xKey="date"
                dataKey="e1rm"
                seriesLabel="Est. 1RM (kg)"
                xTickFormatter={(v) => shortDate(String(v))}
                headerAction={
                  loaded.length > 1 ? (
                    <LiftSelect
                      value={timelineId}
                      onValueChange={setSelectedId}
                      options={loaded.map((b) => ({
                        value: b.exerciseId,
                        label: resolveName(b.exerciseId),
                      }))}
                    />
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={LineChart}
                title="Not enough history to chart"
                description="Log this lift across at least two sessions to see your est. 1RM progression."
              />
            )}
          </section>
        ) : null}

        {/* Bodyweight trend */}
        {bodyweight.length >= 2 ? (
          <section aria-labelledby="bw-heading">
            <SectionTitle id="bw-heading" icon={Scale}>
              Bodyweight trend
            </SectionTitle>
            <AreaChartCard
              title="Bodyweight"
              description="Recorded bodyweight over time"
              data={bodyweight}
              xKey="date"
              dataKey="kg"
              seriesLabel="Bodyweight (kg)"
              xTickFormatter={(v) => shortDate(String(v))}
            />
          </section>
        ) : null}

        {/* Split history */}
        {blocks.length > 0 ? (
          <section aria-labelledby="splits-heading">
            <SectionTitle id="splits-heading" icon={Dumbbell}>
              Split history
            </SectionTitle>
            <SplitHistoryStrip blocks={blocks} />
          </section>
        ) : null}

        {/* Data controls — quiet, at the bottom. On-device only, so reset
            lives here rather than competing with the page title. */}
        <section
          aria-label="Data"
          className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs text-muted-foreground">
            All of this lives in this browser only. Nothing is uploaded.
          </p>
          <ClearAllDataButton />
        </section>
      </div>
    </div>
  );
}

/** Balance Score → ring tone (acid-lime only for strong). */
function scoreTone(score: number): GaugeTone {
  if (score >= 75) return 'highlight';
  if (score >= 50) return 'warn';
  return 'destructive';
}

function ProgressCard({
  label,
  value,
  suffix,
  decimals = 0,
  hint,
  tone = 'default',
  icon,
  index,
  reduce,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  hint?: string;
  tone?: 'default' | 'highlight';
  icon: React.ComponentType<LucideProps>;
  index: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.28, ease: EASE_OUT, delay: Math.min(index, 4) * 0.04 }}
    >
      <StatCard
        label={label}
        value={value}
        suffix={suffix}
        decimals={decimals}
        tone={tone}
        icon={icon}
        hint={hint}
      />
    </motion.div>
  );
}

function SectionTitle({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
    >
      <Icon className="size-4 text-highlight" strokeWidth={1.75} />
      {children}
    </h2>
  );
}
