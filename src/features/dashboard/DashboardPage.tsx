import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Dumbbell, LineChart, Scale, Trophy, Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { AreaChartCard } from '@/components/charts/AreaChartCard';
import { Button } from '@/components/ui/button';
import { useBests, useBlocks, useBodyweightSeries, useWorkouts } from '@/data/hooks';
import { epley1rm } from '@/analytics/epley';
import { createCatalog } from '@/parser/catalog';
import { formatWeight } from '@/lib/units';
import type { ExerciseBest, Workout } from '@/types/models';
import { SplitHistoryStrip } from './SplitHistoryStrip';
import { LiftSelect } from './LiftSelect';

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
          description="Import your training notes — screenshots or pasted text — and your all-time bests, est. 1RMs, and progression charts will appear here."
          action={
            <Button asChild>
              <Link to="/import">
                <Upload className="size-4" strokeWidth={1.75} />
                Import your notes
              </Link>
            </Button>
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
      </div>
    </div>
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
