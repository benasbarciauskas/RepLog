import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  formatNextSetSuggestion,
  sessionFromProgramDayWithProgression,
} from '@core/features/logger/lib';
import { incrementForExercise, suggestNextSet } from '@core/program/progression';
import { similarExercises } from '@core/program/substitute';
import { createCatalog } from '@core/parser';
import type {
  ExerciseDef,
  Program,
  ProgramDay,
  ProgramDayExercise,
} from '@core/types/models';

import { repository } from '@/data/sqliteRepository';
import {
  refreshData,
  useActiveProgram,
  useActiveSession,
  useCustomExercises,
  useSettings,
  useWorkouts,
} from '@/hooks/useData';
import { brand } from '@/theme';

import { ProgramWizard } from './_program/ProgramWizard';
import { SwapModal } from './_program/SwapModal';

function configSummary(program: Program): string {
  const { config } = program;
  const split =
    config.split === 'auto' ? 'Auto split' : config.split.replace(/-/g, ' ');
  return `${config.experience} · ${config.daysPerWeek} days · ${split} · ${config.minutesPerSession} min`;
}

function exerciseLine(ex: ProgramDayExercise): string {
  return `${ex.targetSets}×${ex.repRange[0]}-${ex.repRange[1]} @ RIR${ex.rir}`;
}

function intensityLabel(intensity: ProgramDay['intensity']): string | null {
  if (!intensity) return null;
  return intensity.charAt(0).toUpperCase() + intensity.slice(1);
}

type SwapContext = {
  dayIndex: number;
  exIndex: number;
  ex: ProgramDayExercise;
};

export default function ProgramScreen() {
  const program = useActiveProgram();
  const activeSession = useActiveSession();
  const settings = useSettings();
  const workouts = useWorkouts();
  const customExercises = useCustomExercises();
  const router = useRouter();
  const catalog = useMemo(() => createCatalog(customExercises), [customExercises]);

  const [showWizard, setShowWizard] = useState(false);
  const [swapContext, setSwapContext] = useState<SwapContext | null>(null);

  const swapOptions = useMemo(() => {
    if (!swapContext) return [];
    return similarExercises(swapContext.ex.exerciseId, catalog.all());
  }, [swapContext, catalog]);

  async function doStartDay(day: ProgramDay) {
    await repository.saveActiveSession(
      sessionFromProgramDayWithProgression(day, workouts, settings, catalog.all()),
    );
    refreshData();
    router.replace('/(tabs)/log');
  }

  function handleStartDay(day: ProgramDay) {
    if (activeSession) {
      Alert.alert(
        'Replace your active workout?',
        'You have a workout in progress. Starting this day will discard it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start anyway',
            style: 'destructive',
            onPress: () => void doStartDay(day),
          },
        ],
      );
      return;
    }
    void doStartDay(day);
  }

  async function handleDelete() {
    if (!program) return;
    await repository.deleteProgram(program.id);
    refreshData();
    setShowWizard(false);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete program?',
      'Your generated program will be removed. You can create a new one anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
      ],
    );
  }

  async function handleSwapPick(chosen: ExerciseDef) {
    if (!program || !swapContext) return;

    const { dayIndex, exIndex } = swapContext;
    const updatedDays = program.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return {
        ...day,
        exercises: day.exercises.map((ex, ei) => {
          if (ei !== exIndex) return ex;
          return {
            ...ex,
            exerciseId: chosen.id,
            rawName: chosen.canonicalName,
          };
        }),
      };
    });

    await repository.saveProgram({
      ...program,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    });
    refreshData();
    setSwapContext(null);
  }

  function nextSetLabel(ex: ProgramDayExercise): string {
    const def = catalog.all().find((d) => d.id === ex.exerciseId);
    const suggestion = suggestNextSet(workouts, ex.exerciseId, {
      repRange: ex.repRange,
      rir: ex.rir,
      incrementKg: incrementForExercise(def, settings),
    });
    return formatNextSetSuggestion(suggestion, ex.repRange, settings.unit);
  }

  if (!program || showWizard) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Training plan
          </Text>
          <Text className="mt-1 text-3xl font-bold text-foreground">Program</Text>
          <Text className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A research-based, on-device program tailored to your goal, experience, and schedule.
          </Text>

          {program && showWizard ? (
            <Pressable
              onPress={() => setShowWizard(false)}
              className="mt-4 self-start rounded-lg px-2 py-2 active:opacity-80">
              <Text className="text-sm font-medium text-muted-foreground">Cancel</Text>
            </Pressable>
          ) : null}

          {!program && !showWizard ? (
            <View className="mt-8 items-center rounded-xl border border-dashed border-border px-6 py-12">
              <Ionicons name="clipboard-outline" size={40} color={brand.highlight} />
              <Text className="mt-4 text-lg font-semibold text-foreground">Generate your program</Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Answer a few questions and get a balanced weekly plan with sets, rep ranges, and
                rest — built from the exercise catalog on this device.
              </Text>
              <Pressable
                onPress={() => setShowWizard(true)}
                className="mt-6 flex-row items-center gap-2 rounded-lg bg-highlight px-5 py-3 active:opacity-90">
                <Ionicons name="sparkles" size={18} color={brand.highlightForeground} />
                <Text className="font-semibold text-highlight-foreground">Get started</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-6">
              <ProgramWizard
                customExercises={customExercises}
                onGenerated={() => setShowWizard(false)}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Training plan
        </Text>
        <Text className="mt-1 text-3xl font-bold text-foreground">{program.name}</Text>
        <Text className="mt-2 text-sm text-muted-foreground">{configSummary(program)}</Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => setShowWizard(true)}
            className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 active:opacity-80">
            <Ionicons name="refresh" size={16} color={brand.foreground} />
            <Text className="text-sm font-medium text-foreground">Regenerate</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 active:opacity-80">
            <Ionicons name="trash-outline" size={16} color={brand.destructive} />
            <Text className="text-sm font-medium text-destructive">Delete</Text>
          </Pressable>
        </View>

        <View className="mt-8 gap-4">
          {program.days.map((day, dayIndex) => {
            const intensity = intensityLabel(day.intensity);
            return (
              <View
                key={day.name}
                className="rounded-xl border border-border bg-surface-elevated p-5">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-base font-semibold text-foreground">{day.name}</Text>
                  {intensity ? (
                    <View className="rounded-full border border-border bg-surface px-2 py-0.5">
                      <Text className="text-xs font-medium capitalize text-muted-foreground">
                        {intensity}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-1 text-xs capitalize text-muted-foreground">
                  {day.splitCanonical.replace(/-/g, ' ')} · {day.exercises.length}{' '}
                  {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>

                {day.exercises.length > 0 ? (
                  <View className="mt-4 gap-3">
                    {day.exercises.map((ex, exIndex) => (
                      <View
                        key={`${ex.exerciseId}-${exIndex}`}
                        className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text className="font-medium text-foreground">{ex.rawName}</Text>
                            <Text className="mt-0.5 text-xs text-muted-foreground">
                              next: {nextSetLabel(ex)}
                            </Text>
                          </View>
                          <Text className="shrink-0 text-xs text-muted-foreground">
                            {exerciseLine(ex)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setSwapContext({ dayIndex, exIndex, ex })}
                          className="mt-2 self-start flex-row items-center gap-1 rounded-md px-1 py-1 active:opacity-80">
                          <Ionicons name="swap-horizontal" size={14} color={brand.mutedForeground} />
                          <Text className="text-xs font-medium text-muted-foreground">Swap</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-3 text-sm text-muted-foreground">No exercises assigned.</Text>
                )}

                <Pressable
                  onPress={() => handleStartDay(day)}
                  disabled={day.exercises.length === 0}
                  className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-highlight px-4 py-3 active:opacity-90 disabled:opacity-50"
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${day.name}`}>
                  <Ionicons name="play" size={18} color={brand.highlightForeground} />
                  <Text className="font-semibold text-highlight-foreground">Start this day</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <SwapModal
        visible={swapContext != null}
        exerciseName={swapContext?.ex.rawName ?? ''}
        options={swapOptions}
        onClose={() => setSwapContext(null)}
        onPick={(def) => void handleSwapPick(def)}
      />
    </SafeAreaView>
  );
}