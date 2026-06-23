import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/features/exercise/SegmentedControl';
import { createCatalog } from '@/parser/catalog';
import { generateProgram } from '@/program/generate';
import { repository } from '@/data/repository';
import type {
  Experience,
  Program,
  ProgramConfig,
  ProgramGoal,
  SleepQuality,
  SplitChoice,
  StressLevel,
} from '@/types/models';
import { toast } from 'sonner';

const GOAL_OPTIONS: { value: ProgramGoal; label: string }[] = [
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'strength', label: 'Strength' },
];

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const DAYS_OPTIONS = [3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
  title: `${n} days per week`,
}));

const MINUTES_OPTIONS = [45, 60, 75, 90].map((n) => ({
  value: String(n),
  label: `${n}m`,
  title: `${n} minutes per session`,
}));

const SPLIT_OPTIONS: { value: SplitChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full-body', label: 'Full body' },
  { value: 'push-pull-legs', label: 'PPL' },
  { value: 'upper-lower', label: 'Upper/Lower' },
];

const SLEEP_OPTIONS: { value: SleepQuality; label: string }[] = [
  { value: 'poor', label: 'Poor' },
  { value: 'average', label: 'Average' },
  { value: 'good', label: 'Good' },
];

const STRESS_OPTIONS: { value: StressLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

const DEFAULT_CONFIG: ProgramConfig = {
  goal: 'hypertrophy',
  experience: 'beginner',
  daysPerWeek: 3,
  split: 'auto',
  minutesPerSession: 60,
  sleep: 'average',
  stress: 'moderate',
};

export interface ProgramWizardProps {
  onGenerated: (program: Program) => void;
}

export function ProgramWizard({ onGenerated }: ProgramWizardProps) {
  const [config, setConfig] = useState<ProgramConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const catalog = useMemo(() => createCatalog(), []);

  function patch<K extends keyof ProgramConfig>(key: K, value: ProgramConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const program = generateProgram(config, catalog.all());
      await repository.saveProgram(program);
      toast.success('Program generated', { description: program.name });
      onGenerated(program);
    } catch {
      toast.error('Could not generate program', {
        description: 'Try different settings or check your exercise catalog.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Goal</label>
        <SegmentedControl
          ariaLabel="Training goal"
          options={GOAL_OPTIONS}
          value={config.goal}
          onChange={(v) => patch('goal', v)}
          size="full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Experience</label>
        <SegmentedControl
          ariaLabel="Training experience"
          options={EXPERIENCE_OPTIONS}
          value={config.experience}
          onChange={(v) => patch('experience', v)}
          size="full"
          scroll
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Days per week</label>
        <SegmentedControl
          ariaLabel="Days per week"
          options={DAYS_OPTIONS}
          value={String(config.daysPerWeek)}
          onChange={(v) => patch('daysPerWeek', Number(v) as ProgramConfig['daysPerWeek'])}
          size="full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="program-split" className="text-sm font-medium text-foreground">
          Split
        </label>
        <select
          id="program-split"
          value={config.split}
          onChange={(e) => patch('split', e.target.value as SplitChoice)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {SPLIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Session length</label>
        <SegmentedControl
          ariaLabel="Minutes per session"
          options={MINUTES_OPTIONS}
          value={String(config.minutesPerSession)}
          onChange={(v) => patch('minutesPerSession', Number(v))}
          size="full"
          scroll
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Sleep</label>
        <SegmentedControl
          ariaLabel="Sleep quality"
          options={SLEEP_OPTIONS}
          value={config.sleep ?? 'average'}
          onChange={(v) => patch('sleep', v)}
          size="full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Stress</label>
        <SegmentedControl
          ariaLabel="Stress level"
          options={STRESS_OPTIONS}
          value={config.stress ?? 'moderate'}
          onChange={(v) => patch('stress', v)}
          size="full"
        />
        <p className="text-xs text-muted-foreground">
          Lower recovery slightly reduces prescribed volume.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={busy}>
        <Sparkles className="size-4" strokeWidth={2} />
        {busy ? 'Generating…' : 'Generate program'}
      </Button>
    </form>
  );
}