import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ChevronRight, Dumbbell, History, Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { useSettings, useWorkouts } from '@/data/hooks';
import { createCatalog } from '@/parser/catalog';
import { formatWeight } from '@/lib/units';
import { workoutVolumeKg } from '@/features/dashboard/stats';
import type { Unit, Workout } from '@/types/models';
import { SPLIT_LABELS, groupByMonth } from './history';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** Resolve a catalog/unknown exerciseId to a display name. */
function useNameResolver() {
  const catalog = useMemo(() => createCatalog(), []);
  return useMemo(() => {
    const byId = new Map(catalog.all().map((d) => [d.id, d.canonicalName]));
    return (exerciseId: string): string => {
      const known = byId.get(exerciseId);
      if (known) return known;
      const slug = exerciseId.replace(/^unknown:/, '').replace(/[-_]/g, ' ');
      return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || exerciseId;
    };
  }, [catalog]);
}

export default function HistoryPage() {
  const workouts = useWorkouts();
  const settings = useSettings();
  const reduce = useReducedMotion();
  const resolveName = useNameResolver();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const months = useMemo(() => groupByMonth(workouts), [workouts]);
  const selected = useMemo(
    () => (selectedId ? workouts.find((w) => w.id === selectedId) ?? null : null),
    [workouts, selectedId],
  );

  // Empty → CTA to log or import.
  if (workouts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Your log"
          title="History"
          description="Every workout you've logged, newest first — tap one to see the full session."
        />
        <EmptyState
          icon={History}
          title="No workouts yet"
          description="Start logging your training, or import past notes — every session lands here with its full set detail."
          action={
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/log">
                  <Dumbbell className="size-4" strokeWidth={1.75} />
                  Start a workout
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import">
                  <Upload className="size-4" strokeWidth={1.75} />
                  Import your notes
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // Detail view.
  if (selected) {
    return (
      <WorkoutDetail
        workout={selected}
        unit={settings.unit}
        resolveName={resolveName}
        reduce={Boolean(reduce)}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  // List view.
  return (
    <div>
      <PageHeader
        eyebrow="Your log"
        title="History"
        description="Every workout you've logged, newest first — tap one to see the full session."
      />

      <div className="space-y-8">
        {months.map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`}>
            <h2
              id={`month-${month.key}`}
              className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {month.label}
            </h2>
            <ul className="space-y-2">
              {month.rows.map((row, i) => (
                <motion.li
                  key={row.id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.24, ease: EASE_OUT, delay: Math.min(i, 10) * 0.03 }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {longDate(row.date)}
                        </span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {row.splitLabel}
                        </span>
                      </div>
                      <p className="tnum mt-1 text-xs text-muted-foreground">
                        {row.exerciseCount}{' '}
                        {row.exerciseCount === 1 ? 'exercise' : 'exercises'} · {row.setCount}{' '}
                        {row.setCount === 1 ? 'set' : 'sets'}
                        {row.volumeKg > 0
                          ? ` · ${formatWeight(row.volumeKg, settings.unit)} volume`
                          : ''}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                </motion.li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function WorkoutDetail({
  workout,
  unit,
  resolveName,
  reduce,
  onBack,
}: {
  workout: Workout;
  unit: Unit;
  resolveName: (id: string) => string;
  reduce: boolean;
  onBack: () => void;
}) {
  const volume = Math.round(workoutVolumeKg(workout) * 10) / 10;
  const splitLabel = SPLIT_LABELS[workout.splitCanonical] ?? workout.splitCanonical;

  return (
    <div>
      <PageHeader
        eyebrow={splitLabel}
        title={longDate(workout.date)}
        description={
          volume > 0
            ? `${formatWeight(volume, unit)} total volume across ${workout.exercises.length} ${
                workout.exercises.length === 1 ? 'exercise' : 'exercises'
              }.`
            : `${workout.exercises.length} ${
                workout.exercises.length === 1 ? 'exercise' : 'exercises'
              } logged.`
        }
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back
          </Button>
        }
      />

      {workout.bodyweightKg != null ? (
        <p className="tnum mb-6 text-sm text-muted-foreground">
          Bodyweight: {formatWeight(workout.bodyweightKg, unit)}
        </p>
      ) : null}

      <div className="space-y-4">
        {workout.exercises.map((ex, exIdx) => {
          let workingNo = 0;
          return (
            <motion.section
              key={`${ex.exerciseId}-${exIdx}`}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.26, ease: EASE_OUT, delay: Math.min(exIdx, 8) * 0.03 }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {resolveName(ex.exerciseId)}
                </h2>
                <Link
                  to={`/exercise/${ex.exerciseId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-highlight hover:underline"
                >
                  Progress
                  <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden />
                </Link>
              </div>
              <ul className="divide-y divide-border/60">
                {ex.sets.map((set, i) => {
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
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
