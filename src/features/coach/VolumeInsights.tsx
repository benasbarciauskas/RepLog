import { useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, Info } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { createCatalog } from '@/parser/catalog';
import {
  volumeRecommendations,
  volumeReport,
  workoutsInVolumeWindow,
  type MuscleVolume,
} from '@/program/volume';
import { useActiveProgram, useCustomExercises, useWorkouts } from '@/data/hooks';
import type { MuscleGroup } from '@/types/models';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_META: Record<
  MuscleVolume['status'],
  { label: string; pill: string; bar: string }
> = {
  under: {
    label: 'Under',
    pill: 'bg-warn/12 text-warn border-warn/30',
    bar: 'bg-warn',
  },
  optimal: {
    label: 'Optimal',
    pill: 'bg-highlight-muted text-highlight border-highlight/30',
    bar: 'bg-highlight',
  },
  high: {
    label: 'High',
    pill: 'bg-destructive/12 text-destructive border-destructive/30',
    bar: 'bg-destructive/70',
  },
};

function VolumeBar({ row }: { row: MuscleVolume }) {
  const max = Math.max(row.mav * 1.25, row.sets, row.mev);
  const fillPct = max > 0 ? Math.min(100, (row.sets / max) * 100) : 0;
  const mevPct = (row.mev / max) * 100;
  const mavPct = (row.mav / max) * 100;
  const meta = STATUS_META[row.status];

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface">
      <div
        className="absolute inset-y-0 rounded-full bg-muted/40"
        style={{ left: `${mevPct}%`, width: `${mavPct - mevPct}%` }}
        aria-hidden
      />
      <div
        className={cn('absolute inset-y-0 left-0 rounded-full transition-all', meta.bar)}
        style={{ width: `${fillPct}%` }}
        aria-hidden
      />
    </div>
  );
}

function VolumeRow({ row, index, reduce }: { row: MuscleVolume; index: number; reduce: boolean }) {
  const meta = STATUS_META[row.status];
  const setsLabel = Number.isInteger(row.sets) ? String(row.sets) : row.sets.toFixed(1);

  return (
    <motion.li
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay: Math.min(index, 8) * 0.03 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{humanMuscle(row.muscle)}</span>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            meta.pill,
          )}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="tnum font-medium text-foreground">{setsLabel} sets</span>
        <span className="tnum">
          {setsLabel} / {row.mev}–{row.mav}
        </span>
      </div>
      <div className="mt-2">
        <VolumeBar row={row} />
      </div>
    </motion.li>
  );
}

function VolumeRecommendation({ text, index, reduce }: { text: string; index: number; reduce: boolean }) {
  return (
    <motion.li
      className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay: Math.min(index, 6) * 0.04 }}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warn/12 text-warn">
        <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </motion.li>
  );
}

export function VolumeInsights() {
  const workouts = useWorkouts();
  const customExercises = useCustomExercises();
  const activeProgram = useActiveProgram();
  const reduce = useReducedMotion();

  const catalog = useMemo(() => createCatalog(customExercises).all(), [customExercises]);

  const report = useMemo(
    () =>
      volumeReport(workouts, catalog, {
        experience: activeProgram?.config.experience,
      }),
    [workouts, catalog, activeProgram?.config.experience],
  );

  const recommendations = useMemo(() => volumeRecommendations(report), [report]);
  const windowCount = useMemo(() => workoutsInVolumeWindow(workouts), [workouts]);

  return (
    <section aria-labelledby="volume-heading">
      <h2
        id="volume-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        <BarChart3 className="size-4 text-highlight" strokeWidth={1.75} />
        Weekly volume
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Working sets per muscle over the last 7 days vs healthy ranges.
      </p>

      {windowCount < 1 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
          Log a workout this week to see volume.
        </p>
      ) : (
        <div className="space-y-6">
          {recommendations.length > 0 ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="size-3.5 text-warn" strokeWidth={1.75} />
                Volume priorities
              </h3>
              <ul className="space-y-2">
                {recommendations.map((text, i) => (
                  <VolumeRecommendation key={text} text={text} index={i} reduce={Boolean(reduce)} />
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-highlight/30 bg-highlight-muted/40 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-highlight">
                <CheckCircle2 className="size-4" strokeWidth={1.75} />
                Volume on track
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every tracked muscle sits in a healthy weekly range.
              </p>
            </div>
          )}

          <ul className="space-y-3">
            {report.map((row, i) => (
              <VolumeRow key={row.muscle} row={row} index={i} reduce={Boolean(reduce)} />
            ))}
          </ul>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            Primary muscles count 1 set per working set; secondary muscles count 0.5. Warm-ups are
            excluded.
          </p>
        </div>
      )}
    </section>
  );
}