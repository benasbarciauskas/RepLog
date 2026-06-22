import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Info,
  Target,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCoachFindings, useWorkouts } from '@/data/hooks';
import { muscleCoverage } from '@/coach/analyze';
import type { CoachFinding, FindingSeverity, MuscleGroup } from '@/types/models';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const SEVERITY_META: Record<
  FindingSeverity,
  {
    label: string;
    text: string;
    border: string;
    iconBg: string;
    icon: typeof AlertTriangle;
  }
> = {
  priority: {
    label: 'Priority',
    text: 'text-destructive',
    border: 'border-destructive/40',
    iconBg: 'bg-destructive/12 text-destructive',
    icon: AlertTriangle,
  },
  flag: {
    label: 'Watch',
    text: 'text-warn',
    border: 'border-warn/40',
    iconBg: 'bg-warn/12 text-warn',
    icon: Info,
  },
  ok: {
    label: 'In balance',
    text: 'text-highlight',
    border: 'border-border',
    iconBg: 'bg-highlight-muted text-highlight',
    icon: CheckCircle2,
  },
};

export default function CoachPage() {
  const findings = useCoachFindings();
  const workouts = useWorkouts();
  const reduce = useReducedMotion();

  const coverage = useMemo(() => muscleCoverage(workouts), [workouts]);

  const actionable = findings.filter((f) => f.severity !== 'ok');

  // "Focus on" = the muscles named by priority/flag findings, de-duplicated, in
  // severity order (priority first).
  const focusMuscles = useMemo(() => {
    const seen = new Set<MuscleGroup>();
    const out: MuscleGroup[] = [];
    for (const f of actionable) {
      for (const m of f.muscles) {
        if (!seen.has(m)) {
          seen.add(m);
          out.push(m);
        }
      }
    }
    return out;
  }, [actionable]);

  const undertrained = coverage.filter((c) => c.status === 'undertrained');
  const never = coverage.filter((c) => c.status === 'never');

  // No data → encouraging first-run prompt.
  if (workouts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="What's lacking"
          title="Coach"
          description="Where your lifts are out of balance, and the muscles that need attention."
        />
        <EmptyState
          icon={Target}
          title="Nothing to analyze yet"
          description="Import a few workouts and the coach will compare your lifts against healthy strength ratios — for example, log a bench press and an overhead press to unlock front-delt analysis."
          action={
            <Button asChild>
              <Link to="/import">Import your notes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Data exists but no ratio rule could fire (missing lift pairs).
  const noFindings = findings.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="What's lacking"
        title="Coach"
        description="Where your lifts are out of balance, and the muscles that need attention."
      />

      <div className="space-y-10">
        {/* Focus-on summary */}
        <section
          aria-labelledby="focus-heading"
          className={cn(
            'rounded-xl border p-5 shadow-sm',
            actionable.length > 0
              ? 'border-highlight/30 bg-highlight-muted/40'
              : 'border-border bg-card',
          )}
        >
          <h2
            id="focus-heading"
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <Crosshair className="size-4 text-highlight" strokeWidth={1.75} />
            Focus on
          </h2>
          {actionable.length > 0 ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-md bg-highlight px-2.5 py-1 text-sm font-semibold text-highlight-foreground"
                  >
                    {humanMuscle(m)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {actionable.length} {actionable.length === 1 ? 'imbalance' : 'imbalances'} found.
                The lifts below are below their healthy strength ratios — bringing them up should
                develop the muscles highlighted above.
              </p>
            </>
          ) : noFindings ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough paired lifts yet to judge balance. Log antagonist pairs — e.g. a bench
              press and an overhead press, or a squat and a deadlift — to unlock ratio analysis.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Everything that could be checked is in a healthy range. Nice work — keep it balanced.
            </p>
          )}
        </section>

        {/* Findings */}
        {findings.length > 0 ? (
          <section aria-labelledby="findings-heading">
            <h2
              id="findings-heading"
              className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              <Target className="size-4 text-highlight" strokeWidth={1.75} />
              Strength ratios
            </h2>
            <div className="space-y-3">
              {findings.map((f, i) => (
                <FindingCard key={f.ruleId} finding={f} index={i} reduce={Boolean(reduce)} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Muscle coverage */}
        <section aria-labelledby="coverage-heading">
          <h2
            id="coverage-heading"
            className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <AlertTriangle className="size-4 text-highlight" strokeWidth={1.75} />
            Muscle coverage
          </h2>
          {never.length === 0 && undertrained.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Every muscle group is getting a healthy number of working sets across your logged
              workouts. Solid coverage.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {never.length > 0 ? (
                <CoverageCard
                  tone="never"
                  title="Never trained"
                  description="No working sets logged for these in any catalogued exercise."
                  muscles={never.map((c) => humanMuscle(c.muscle))}
                />
              ) : null}
              {undertrained.length > 0 ? (
                <CoverageCard
                  tone="undertrained"
                  title="Undertrained"
                  description="Some volume, but fewer than 6 working sets across your history."
                  muscles={undertrained.map((c) => `${humanMuscle(c.muscle)} · ${c.sets}`)}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  index,
  reduce,
}: {
  finding: CoachFinding;
  index: number;
  reduce: boolean;
}) {
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;
  return (
    <motion.article
      className={cn(
        'flex gap-4 rounded-xl border bg-card p-5 shadow-sm',
        meta.border,
      )}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.28, ease: EASE_OUT, delay: Math.min(index, 8) * 0.04 }}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          meta.iconBg,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-xs font-semibold uppercase tracking-wide', meta.text)}>
            {meta.label}
          </span>
          {finding.ratio != null ? (
            <span className="tnum rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              ratio {finding.ratio.toFixed(2)}
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-foreground">{finding.message}</p>
        {finding.muscles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {finding.muscles.map((m) => (
              <span
                key={m}
                className="rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground"
              >
                {humanMuscle(m)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

function CoverageCard({
  tone,
  title,
  description,
  muscles,
}: {
  tone: 'never' | 'undertrained';
  title: string;
  description: string;
  muscles: string[];
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 shadow-sm',
        tone === 'never' ? 'border-destructive/30' : 'border-warn/30',
      )}
    >
      <h3
        className={cn(
          'text-sm font-semibold',
          tone === 'never' ? 'text-destructive' : 'text-warn',
        )}
      >
        {title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {muscles.map((m) => (
          <span
            key={m}
            className="tnum rounded-md bg-surface px-2 py-1 text-xs text-foreground"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
