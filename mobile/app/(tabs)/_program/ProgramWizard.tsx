import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { generateProgram } from '@core/program/generate';
import { createCatalog } from '@core/parser';
import type {
  Experience,
  Program,
  ProgramConfig,
  ProgramGoal,
  SleepQuality,
  SplitChoice,
  StressLevel,
} from '@core/types/models';
import type { ExerciseDef } from '@core/types/models';

import { repository } from '@/data/sqliteRepository';
import { refreshData } from '@/hooks/useData';
import { brand } from '@/theme';

import { OptionChips, OptionRows } from './OptionChips';

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
  label: `${n} days`,
}));

const MINUTES_OPTIONS = [45, 60, 75, 90].map((n) => ({
  value: String(n),
  label: `${n} min`,
}));

const SPLIT_OPTIONS: { value: SplitChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full-body', label: 'Full body' },
  { value: 'push-pull-legs', label: 'Push / Pull / Legs' },
  { value: 'upper-lower', label: 'Upper / Lower' },
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
  customExercises: ExerciseDef[];
  onGenerated: () => void;
}

export function ProgramWizard({ customExercises, onGenerated }: ProgramWizardProps) {
  const [config, setConfig] = useState<ProgramConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useMemo(() => createCatalog(customExercises), [customExercises]);

  function patch<K extends keyof ProgramConfig>(key: K, value: ProgramConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const program = generateProgram(config, catalog.all());
      await repository.saveProgram(program);
      refreshData();
      onGenerated();
    } catch {
      setError('Could not generate program. Try different settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-6 rounded-xl border border-border bg-surface-elevated p-5">
      <OptionChips
        label="Goal"
        options={GOAL_OPTIONS}
        value={config.goal}
        onChange={(v) => patch('goal', v)}
      />

      <OptionChips
        label="Experience"
        options={EXPERIENCE_OPTIONS}
        value={config.experience}
        onChange={(v) => patch('experience', v)}
      />

      <OptionChips
        label="Days per week"
        options={DAYS_OPTIONS}
        value={String(config.daysPerWeek)}
        onChange={(v) => patch('daysPerWeek', Number(v) as ProgramConfig['daysPerWeek'])}
      />

      <OptionRows
        label="Split"
        options={SPLIT_OPTIONS}
        value={config.split}
        onChange={(v) => patch('split', v)}
      />

      <OptionChips
        label="Session length"
        options={MINUTES_OPTIONS}
        value={String(config.minutesPerSession)}
        onChange={(v) => patch('minutesPerSession', Number(v))}
      />

      <OptionChips
        label="Sleep"
        options={SLEEP_OPTIONS}
        value={config.sleep ?? 'average'}
        onChange={(v) => patch('sleep', v)}
      />

      <View className="gap-2">
        <OptionChips
          label="Stress"
          options={STRESS_OPTIONS}
          value={config.stress ?? 'moderate'}
          onChange={(v) => patch('stress', v)}
        />
        <Text className="text-xs text-muted-foreground">
          Lower recovery slightly reduces prescribed volume.
        </Text>
      </View>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <Pressable
        onPress={() => void handleSubmit()}
        disabled={busy}
        className="flex-row items-center justify-center gap-2 rounded-lg bg-highlight px-4 py-3.5 active:opacity-90 disabled:opacity-60"
        accessibilityRole="button"
        accessibilityLabel="Generate program">
        {busy ? (
          <ActivityIndicator color={brand.highlightForeground} />
        ) : (
          <Ionicons name="sparkles" size={18} color={brand.highlightForeground} />
        )}
        <Text className="text-base font-semibold text-highlight-foreground">
          {busy ? 'Generating…' : 'Generate program'}
        </Text>
      </Pressable>
    </View>
  );
}