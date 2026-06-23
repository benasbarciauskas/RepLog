import { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { workoutVolumeKg } from '@core/features/dashboard/stats';
import { SPLIT_LABELS } from '@core/features/history/history';
import { createCatalog } from '@core/parser';
import type { SplitCanonical, Workout } from '@core/types/models';

import { useCustomExercises, useSettings, useWorkouts } from '@/hooks/useData';
import { formatUserWeight, longDate } from '@/lib/format';
import { brand } from '@/theme';

function workingSetCount(workout: Workout): number {
  let n = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (!s.isWarmup) n += 1;
    }
  }
  return n;
}

function hasWarmupSets(workout: Workout): boolean {
  return workout.exercises.some((ex) => ex.sets.some((s) => s.isWarmup));
}

function resolveExerciseName(
  exerciseId: string,
  rawName: string,
  byId: Map<string, string>,
): string {
  const known = byId.get(exerciseId);
  if (known) return known;
  if (rawName.trim()) return rawName;
  const slug = exerciseId.replace(/^(unknown|custom):/, '').replace(/[-_]/g, ' ');
  return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || exerciseId;
}

export default function HistoryScreen() {
  const workouts = useWorkouts();
  const settings = useSettings();
  const customExercises = useCustomExercises();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const exerciseNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of createCatalog(customExercises).all()) {
      map.set(def.id, def.canonicalName);
    }
    return map;
  }, [customExercises]);

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.date.localeCompare(a.date)),
    [workouts],
  );

  const expanded = useMemo(
    () => (expandedId ? sorted.find((w) => w.id === expandedId) ?? null : null),
    [sorted, expandedId],
  );

  if (workouts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="px-4 pb-2 pt-2">
          <Text className="text-3xl font-bold text-foreground">History</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="time-outline" size={48} color={brand.mutedForeground} />
          <Text className="mt-4 text-xl font-semibold text-foreground">No workouts yet</Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Start logging your training, or import past notes — every session lands here with its
            full set detail.
          </Text>
          <View className="mt-6 flex-row gap-3">
            <Link href="/(tabs)/log" asChild>
              <Pressable className="rounded-xl bg-highlight px-5 py-3 active:opacity-80">
                <Text className="font-semibold text-highlight-foreground">Start a workout</Text>
              </Pressable>
            </Link>
            <Link href="/import" asChild>
              <Pressable className="rounded-xl border border-border bg-surface px-5 py-3 active:opacity-80">
                <Text className="font-semibold text-highlight">Import notes</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pb-2 pt-2">
        <Text className="text-3xl font-bold text-foreground">History</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Tap a session to see exercises and sets.
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pb-6"
        showsVerticalScrollIndicator={false}>
        {sorted.map((workout) => {
          const isExpanded = expandedId === workout.id;
          const splitLabel = SPLIT_LABELS[workout.splitCanonical as SplitCanonical] ?? workout.splitCanonical;
          const exerciseCount = workout.exercises.length;
          const setCount = workingSetCount(workout);
          const volumeKg = Math.round(workoutVolumeKg(workout) * 10) / 10;
          const showWarmup = hasWarmupSets(workout);

          return (
            <View
              key={workout.id}
              className="overflow-hidden rounded-xl border border-border bg-surface">
              <Pressable
                className="flex-row items-center justify-between gap-3 p-4 active:opacity-80"
                onPress={() => setExpandedId(isExpanded ? null : workout.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}>
                <View className="min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-semibold text-foreground">
                      {longDate(workout.date) ?? workout.date}
                    </Text>
                    <View className="rounded bg-surface-elevated px-1.5 py-0.5">
                      <Text className="text-xs font-medium text-muted-foreground">{splitLabel}</Text>
                    </View>
                    {showWarmup ? (
                      <View className="rounded bg-highlight-muted px-1.5 py-0.5">
                        <Text className="text-xs font-medium text-highlight">Warm-up</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} · {setCount}{' '}
                    {setCount === 1 ? 'set' : 'sets'}
                    {volumeKg > 0
                      ? ` · ${formatUserWeight(volumeKg, settings.unit)} volume`
                      : ''}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={brand.mutedForeground}
                />
              </Pressable>

              {isExpanded && expanded?.id === workout.id ? (
                <View className="border-t border-border px-4 pb-4 pt-2">
                  {workout.bodyweightKg != null ? (
                    <Text className="mb-3 text-xs text-muted-foreground">
                      Bodyweight: {formatUserWeight(workout.bodyweightKg, settings.unit)}
                    </Text>
                  ) : null}
                  {workout.exercises.map((ex, exIdx) => {
                    let workingNo = 0;
                    return (
                      <View
                        key={`${ex.exerciseId}-${exIdx}`}
                        className="mb-3 rounded-lg border border-border/70 bg-background/40 p-3">
                        <Text className="mb-2 text-sm font-semibold text-foreground">
                          {resolveExerciseName(ex.exerciseId, ex.rawName, exerciseNamesById)}
                        </Text>
                        {ex.sets.map((set, setIdx) => {
                          const setNo = set.isWarmup ? null : ++workingNo;
                          return (
                            <View
                              key={setIdx}
                              className="flex-row items-center justify-between py-1.5">
                              <View className="flex-row items-center gap-2">
                                {set.isWarmup ? (
                                  <Text className="text-xs font-medium text-highlight">WU</Text>
                                ) : (
                                  <Text className="w-5 text-center text-xs text-muted-foreground">
                                    {setNo}
                                  </Text>
                                )}
                                <Text className="text-sm font-medium text-foreground">
                                  {formatUserWeight(set.weightKg, ex.unit)} × {set.reps}
                                </Text>
                              </View>
                              {set.rpe != null ? (
                                <Text className="text-xs text-muted-foreground">RPE {set.rpe}</Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}