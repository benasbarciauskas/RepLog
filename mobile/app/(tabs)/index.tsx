import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { overallLabel } from '@core/coach/score';
import { dashboardStats } from '@core/features/dashboard/stats';
import { createCatalog } from '@core/parser';
import type { ExerciseBest } from '@core/types/models';

import { RingGauge, scoreTone } from '@/components/RingGauge';
import { useBests, useCoach, useCustomExercises, useSettings, useWorkouts } from '@/hooks/useData';
import { formatWeight } from '@/lib/format';

import { BestCard } from './_dash/BestCard';
import { StatCard } from './_dash/StatCard';

/** Bests with a loaded max, ranked by est-1RM (mirrors web dashboard). */
function rankedBests(bests: ExerciseBest[]): ExerciseBest[] {
  return [...bests]
    .filter((b) => b.maxWeightKg != null)
    .sort((a, b) => (b.bestE1rmKg ?? 0) - (a.bestE1rmKg ?? 0));
}

export default function DashboardScreen() {
  const workouts = useWorkouts();
  const bests = useBests();
  const { score } = useCoach();
  const settings = useSettings();
  const customExercises = useCustomExercises();

  const stats = useMemo(() => dashboardStats(workouts, bests), [workouts, bests]);
  const loaded = useMemo(() => rankedBests(bests), [bests]);

  const resolveName = useMemo(() => {
    const catalog = createCatalog(customExercises);
    const byId = new Map(catalog.all().map((d) => [d.id, d.canonicalName]));
    return (exerciseId: string): string => {
      const known = byId.get(exerciseId);
      if (known) return known;
      const slug = exerciseId.replace(/^unknown:/, '').replace(/[-_]/g, ' ');
      return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || exerciseId;
    };
  }, [customExercises]);

  const volumeHint =
    stats.weeklyVolumeDeltaPct != null
      ? `${stats.weeklyVolumeDeltaPct >= 0 ? '+' : ''}${stats.weeklyVolumeDeltaPct}% vs last week`
      : 'Volume lifted';

  if (workouts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 px-6">
          <Text className="pt-4 text-3xl font-bold text-foreground">Dashboard</Text>
          <Text className="mt-2 text-muted-foreground">
            All-time bests, PR timeline, and your training history at a glance.
          </Text>

          <View className="flex-1 items-center justify-center">
            <View className="items-center rounded-2xl border border-border bg-surface px-6 py-10">
              <Ionicons name="barbell-outline" size={40} color="#a2eb3c" />
              <Text className="mt-4 text-xl font-semibold text-foreground">No workouts yet</Text>
              <Text className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
                Import your training notes and your all-time bests, est. 1RMs, and progression
                charts will appear here.
              </Text>
              <Link href="/import" asChild>
                <Pressable
                  className="mt-6 flex-row items-center gap-2 rounded-xl bg-highlight px-5 py-3 active:opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel="Import your notes">
                  <Ionicons name="cloud-upload-outline" size={18} color="#141609" />
                  <Text className="text-sm font-semibold text-highlight-foreground">
                    Import your notes
                  </Text>
                </Pressable>
              </Link>
              <Text className="mt-3 text-xs text-muted-foreground">Add your first workout</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const overall = score.overall;
  const balanceSublabel = overallLabel(overall);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-foreground">Dashboard</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          All-time bests and your training overview at a glance.
        </Text>

        {/* Balance ring + stat cards */}
        <View className="mt-6 gap-4">
          <Link href="/coach" asChild>
            <Pressable
              className="items-center rounded-xl border border-border bg-surface px-6 py-6 active:opacity-90"
              accessibilityRole="button"
              accessibilityLabel="Open coach">
              {overall != null ? (
                <RingGauge
                  value={overall}
                  size={140}
                  tone={scoreTone(overall)}
                  label="BALANCE"
                  sublabel={balanceSublabel}
                />
              ) : (
                <RingGauge
                  value={0}
                  size={140}
                  tone="muted"
                  showValue={false}
                  label="BALANCE"
                  sublabel={balanceSublabel}
                />
              )}
              <View className="mt-3 flex-row items-center gap-1">
                <Text className="text-sm font-medium text-highlight">Open coach</Text>
                <Ionicons name="arrow-forward" size={14} color="#a2eb3c" />
              </View>
            </Pressable>
          </Link>

          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[46%] flex-1">
              <StatCard
                label="This week"
                display={formatWeight(stats.thisWeekVolumeKg, settings.unit)}
                hint={volumeHint}
                icon="analytics-outline"
              />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatCard
                label="Streak"
                value={stats.streakWeeks}
                suffix={stats.streakWeeks === 1 ? ' wk' : ' wks'}
                hint="Consecutive weeks trained"
                highlight
                icon="flame-outline"
              />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatCard
                label="This month"
                value={stats.workoutsThisMonth}
                hint={
                  stats.workoutsThisMonth === 1 ? 'Workout logged' : 'Workouts logged'
                }
                icon="calendar-outline"
              />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatCard
                label="PRs this month"
                value={stats.prsThisPeriod}
                hint="In the last 30 days"
                highlight
                icon="trophy-outline"
              />
            </View>
          </View>
        </View>

        {/* All-time bests */}
        <View className="mt-8">
          <View className="mb-4 flex-row items-center gap-2">
            <Ionicons name="trophy-outline" size={16} color="#a2eb3c" />
            <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              All-time bests
            </Text>
          </View>

          {loaded.length === 0 ? (
            <View className="items-center rounded-xl border border-border bg-surface px-6 py-8">
              <Text className="text-base font-medium text-foreground">No weighted PRs yet</Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Log a weighted lift to start tracking maxes and estimated 1RMs.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {loaded.map((best) => (
                <BestCard
                  key={best.exerciseId}
                  name={resolveName(best.exerciseId)}
                  best={best}
                  unit={settings.unit}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}