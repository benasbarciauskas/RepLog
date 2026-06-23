import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Lock,
  Target,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { RingGauge, type GaugeTone } from '@/components/charts/RingGauge';
import { cn } from '@/lib/utils';
import { useBests, useCoachFindings, useWeeklyVolume, useWorkouts } from '@/data/hooks';
import {
  balanceScore,
  overallLabel,
  type AreaScore,
  type ScoreStatus,
} from '@/coach/score';
import type { CoachFinding, FindingSeverity, MuscleGroup } from '@/types/models';
import type { MuscleVolume } from '@/coach/volume';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format setsPerWeek to 1dp, dropping a trailing '.0'. */
function fmtSets(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Score band → ring tone. Acid-lime only for strong; warn/destructive escalate. */
const STATUS_TONE: Record<ScoreStatus, GaugeTone> = {
  strong: 'highlight',
  watch: 'warn',
  attention: 'destructive',
};

const STATUS_TEXT: Record<ScoreStatus, string> = {
  strong: 'text-highlight',
  watch: 'text-warn',
  attention: 'text-destructive',
};

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
  const bests = useBests();
  const workouts = useWorkouts();
  const volume = useWeeklyVolume();
  const reduce = useReducedMotion();

  const score = useMemo(() => balanceScore(bests), [bests]);

  // Recommendation cards = actionable findings, impact-ordered (priority first;
  // analyzeImbalances already sorts priority → flag → ok).
  const recommendations = findings.filter((f) => f.severity !== 'ok');

  // Weekly volume groupings.
  const volUndertrained = volume.muscles.filter(
    (m) => m.status === 'under' || m.status === 'never',
  );
  const volOptimal = volume.muscles.filter((m) => m.status === 'optimal');
  const volHigh = volume.muscles.filter((m) => m.status === 'high');
  const allZero =
    volume.muscles.length > 0 && volume.muscles.every((m) => m.setsPerWeek === 0);

  // No data → encouraging first-run prompt.
  if (workouts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Your balance"
          title="Coach"
          description="A single Balance Score from how close your lifts sit to healthy strength ratios — plus what to train next."
        />
        <EmptyState
          icon={Target}
          title="Nothing to score yet"
          description="Log or import a few workouts and your Balance Score appears here. Two comparable lifts unlock it — for example a bench press and an overhead press to score your pressing balance."
          action={
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/log">Start a workout</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import">Import your notes</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // Data exists but no ratio rule could fire — need ≥2 comparable lifts.
  if (score.overall == null) {
    return (
      <div>
        <PageHeader
          eyebrow="Your balance"
          title="Coach"
          description="A single Balance Score from how close your lifts sit to healthy strength ratios — plus what to train next."
        />
        <EmptyState
          icon={Target}
          title="Almost there — log one more lift"
          description="Scoring needs at least two comparable lifts. Log an antagonist pair — a bench press and an overhead press, or a squat and a deadlift — and your Balance Score will appear."
          action={
            <Button asChild>
              <Link to="/log">Log a lift</Link>
            </Button>
          }
        />
        {score.unlockable.length > 0 ? (
          <div className="mt-8">
            <UnlockList items={score.unlockable} />
          </div>
        ) : null}
      </div>
    );
  }

  const overall = score.overall;
  const overallStatus: ScoreStatus =
    overall >= 75 ? 'strong' : overall >= 50 ? 'watch' : 'attention';

  // Grouped areas (push/pull/lower) lead the sub-gauges; per-ratio detail follows.
  const groupAreas = score.areas.filter((a) =>
    ['push', 'pull', 'lower'].includes(a.key),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Your balance"
        title="Coach"
        description="A single Balance Score from how close your lifts sit to healthy strength ratios — plus what to train next."
      />

      <div className="space-y-12">
        {/* Headline Balance Score ring */}
        <section
          aria-labelledby="score-heading"
          className="flex flex-col items-center text-center"
        >
          <h2 id="score-heading" className="sr-only">
            Balance Score
          </h2>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <RingGauge
              value={overall}
              size={224}
              tone={STATUS_TONE[overallStatus]}
              label="Balance"
              ariaLabel={`Balance Score ${overall} out of 100`}
            />
          </motion.div>
          <p
            className={cn(
              'mt-5 text-lg font-semibold tracking-tight',
              STATUS_TEXT[overallStatus],
            )}
          >
            {overallLabel(overall)}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Scored from {score.scoredRules}{' '}
            {score.scoredRules === 1 ? 'strength ratio' : 'strength ratios'}.
            Higher means your lifts sit closer to their healthy bands.
          </p>
        </section>

        {/* Sub-score area gauges */}
        {groupAreas.length > 0 ? (
          <section aria-labelledby="areas-heading">
            <SectionTitle id="areas-heading" icon={Target}>
              By area
            </SectionTitle>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {groupAreas.map((area, i) => (
                <AreaGaugeCard key={area.key} area={area} index={i} reduce={Boolean(reduce)} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Recommendation cards */}
        {recommendations.length > 0 ? (
          <section aria-labelledby="rec-heading">
            <SectionTitle id="rec-heading" icon={ArrowUpRight}>
              Do this to improve
            </SectionTitle>
            <div className="space-y-3">
              {recommendations.map((f, i) => (
                <RecommendationCard
                  key={f.ruleId}
                  finding={f}
                  index={i}
                  reduce={Boolean(reduce)}
                />
              ))}
            </div>
          </section>
        ) : (
          <section
            aria-label="No imbalances"
            className="rounded-xl border border-highlight/30 bg-highlight-muted/40 p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-highlight">
              <CheckCircle2 className="size-4" strokeWidth={1.75} />
              Nicely balanced
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every ratio we could check is sitting in a healthy range. Keep the
              programming balanced and your score steady.
            </p>
          </section>
        )}

        {/* Unlock-more prompts */}
        {score.unlockable.length > 0 ? (
          <section aria-labelledby="unlock-heading">
            <SectionTitle id="unlock-heading" icon={Lock}>
              Unlock more
            </SectionTitle>
            <UnlockList items={score.unlockable} />
          </section>
        ) : null}

        {/* Weekly volume (replaces old all-time Muscle coverage) */}
        <section aria-labelledby="volume-heading">
          <SectionTitle id="volume-heading" icon={TrendingUp}>
            Weekly volume
          </SectionTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            Average working sets per muscle over the last 4 weeks. Compound lifts credit
            primary muscles fully and secondary muscles at half.
          </p>

          {allZero ? (
            <p className="text-sm text-muted-foreground">
              No working sets in the last 4 weeks — log a session to see your volume balance.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Undertrained: under + never */}
              {volUndertrained.length > 0 ? (
                <VolumeCard
                  tone="warn"
                  title="Undertrained"
                  description="Below the minimum effective volume of 8 sets/wk."
                  muscles={volUndertrained}
                />
              ) : null}

              {/* Optimal */}
              {volOptimal.length > 0 ? (
                <VolumeCard
                  tone="optimal"
                  title="In the sweet spot (8–20 sets/wk)"
                  description=""
                  muscles={volOptimal}
                />
              ) : null}

              {/* High volume — only when any exist */}
              {volHigh.length > 0 ? (
                <div className="rounded-xl border border-warn/30 bg-card p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-warn">
                    <Info className="size-4" strokeWidth={1.75} aria-hidden />
                    Above ~20 sets/wk — watch recovery.
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {volHigh.map((m) => (
                      <span
                        key={m.muscle}
                        className="tnum rounded-md bg-surface px-2 py-1 text-xs text-foreground"
                      >
                        {humanMuscle(m.muscle)} · {fmtSets(m.setsPerWeek)}/wk
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
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

function AreaGaugeCard({
  area,
  index,
  reduce,
}: {
  area: AreaScore;
  index: number;
  reduce: boolean;
}) {
  const status = area.status;
  return (
    <motion.div
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.28, ease: EASE_OUT, delay: Math.min(index, 6) * 0.05 }}
    >
      <RingGauge
        value={area.score ?? 0}
        size={104}
        thickness={9}
        tone={STATUS_TONE[status]}
        ariaLabel={`${area.label} ${area.score ?? 0} out of 100`}
      />
      <span className="text-center text-sm font-medium text-foreground">{area.label}</span>
    </motion.div>
  );
}

function RecommendationCard({
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
      className={cn('flex gap-4 rounded-xl border bg-card p-5 shadow-sm', meta.border)}
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

function UnlockList({ items }: { items: { ruleId: string; label: string }[] }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-5">
      <p className="text-sm text-muted-foreground">
        Log both lifts in each pair below to score these ratios and raise your
        Balance Score's confidence.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((u) => (
          <li
            key={u.ruleId}
            className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-xs text-foreground"
          >
            <Lock className="size-3 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            {u.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VolumeCard({
  tone,
  title,
  description,
  muscles,
}: {
  tone: 'warn' | 'optimal';
  title: string;
  description: string;
  muscles: MuscleVolume[];
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 shadow-sm',
        tone === 'warn' ? 'border-destructive/30' : 'border-highlight/30',
      )}
    >
      <h3
        className={cn(
          'text-sm font-semibold',
          tone === 'warn' ? 'text-destructive' : 'text-highlight',
        )}
      >
        {title}
      </h3>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {muscles.map((m) => (
          <span
            key={m.muscle}
            className="tnum rounded-md bg-surface px-2 py-1 text-xs text-foreground"
          >
            {humanMuscle(m.muscle)} · {fmtSets(m.setsPerWeek)}/wk
          </span>
        ))}
      </div>
    </div>
  );
}
