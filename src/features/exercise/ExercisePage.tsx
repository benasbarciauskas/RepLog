import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Dumbbell, LineChart, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { Button } from '@/components/ui/button';
import { useBests, useWorkouts } from '@/data/hooks';
import { epley1rm } from '@/analytics/epley';
import { createCatalog } from '@/parser/catalog';
import { formatWeight } from '@/lib/units';
import type { MuscleGroup, RepPR, Workout } from '@/types/models';

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

/**
 * Per-session top-set weight + best est-1RM for one exercise, chronological.
 * Warmups excluded; bodyweight-only sets skipped from the loaded series.
 */
function progressionSeries(
  workouts: Workout[],
  exerciseId: string,
): { date: string; topSet: number; e1rm: number }[] {
  const series: { date: string; topSet: number; e1rm: number }[] = [];
  for (const w of workouts) {
    let topSet = 0;
    let bestE1rm = 0;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (s.isWarmup || s.weightKg == null) continue;
        if (s.weightKg > topSet) topSet = s.weightKg;
        const e = epley1rm(s.weightKg, s.reps);
        if (e > bestE1rm) bestE1rm = e;
      }
    }
    if (topSet > 0) {
      series.push({
        date: w.date,
        topSet: Math.round(topSet * 10) / 10,
        e1rm: Math.round(bestE1rm * 10) / 10,
      });
    }
  }
  return series;
}

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const workouts = useWorkouts();
  const bests = useBests();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const def = useMemo(() => {
    if (!id) return null;
    const catalog = createCatalog();
    return catalog.all().find((d) => d.id === id) ?? null;
  }, [id]);

  const best = useMemo(
    () => (id ? bests.find((b) => b.exerciseId === id) ?? null : null),
    [bests, id],
  );

  const series = useMemo(
    () => (id ? progressionSeries(workouts, id) : []),
    [workouts, id],
  );

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

  const hasData = best != null || series.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Exercise"
        title={name}
        description={
          muscles.length > 0
            ? `Works ${muscles.map(humanMuscle).join(', ')}.`
            : 'Top-set progression, est. 1RM over time, and your PR history.'
        }
        actions={backButton}
      />

      {!hasData ? (
        <EmptyState
          icon={Dumbbell}
          title="No data for this lift yet"
          description="Once you've logged this exercise, its progression chart and PR history will appear here."
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

          {/* Progression chart */}
          <section aria-labelledby="ex-progress-heading">
            <h2
              id="ex-progress-heading"
              className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              <LineChart className="size-4 text-highlight" strokeWidth={1.75} />
              Progression
            </h2>
            {series.length >= 2 ? (
              <LineChartCard
                title="Estimated 1RM"
                description="Best est. 1RM per session over time"
                data={series}
                xKey="date"
                dataKey="e1rm"
                seriesLabel="Est. 1RM (kg)"
                xTickFormatter={(v) => shortDate(String(v))}
              />
            ) : (
              <EmptyState
                icon={LineChart}
                title="Not enough history to chart"
                description="Log this lift across at least two sessions to see your progression."
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
              <RepPrList prs={best.repPRs} reduce={Boolean(reduce)} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RepPrList({ prs, reduce }: { prs: RepPR[]; reduce: boolean }) {
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
                {isBw ? 'BW' : formatWeight(pr.weightKg, 'kg')}
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
