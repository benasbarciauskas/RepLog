import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  formatElapsed,
  makeEmptySession,
  sessionFromRoutine,
} from '@core/features/logger/lib';

import { repository } from '@/data/sqliteRepository';
import {
  refreshData,
  useCustomExercises,
  useRoutines,
  useSettings,
  useWorkouts,
} from '@/hooks/useData';
import { brand } from '@/theme';

import { ExerciseCard } from './_log/ExerciseCard';
import { ExerciseSearchModal } from './_log/ExerciseSearchModal';
import { RestTimerBar } from './_log/RestTimerBar';
import { useLogger } from './_log/useLogger';

export default function LogScreen() {
  const logger = useLogger();
  const session = logger.session;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {session ? <ActiveWorkout logger={logger} /> : <StartView logger={logger} />}
    </SafeAreaView>
  );
}

function StartView({ logger }: { logger: ReturnType<typeof useLogger> }) {
  const routines = useRoutines();

  async function startEmpty() {
    await logger.start(makeEmptySession());
  }

  async function startFromRoutine(routineId: string) {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    await logger.start(sessionFromRoutine(routine));
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 pt-2">
      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Live logger
      </Text>
      <Text className="mt-1 text-3xl font-bold text-foreground">Log</Text>
      <Text className="mt-2 text-sm text-muted-foreground">
        Start a workout, add exercises, and log every set as you train.
      </Text>

      <View className="mt-8 rounded-xl border border-border bg-surface-elevated p-5">
        <Text className="text-lg font-semibold text-foreground">Start a workout</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Begin with an empty session and add exercises as you go.
        </Text>
        <Pressable
          onPress={() => void startEmpty()}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-highlight px-4 py-3.5 active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="Start workout">
          <Ionicons name="add-circle-outline" size={20} color={brand.highlightForeground} />
          <Text className="text-base font-semibold text-highlight-foreground">Start workout</Text>
        </Pressable>
      </View>

      {routines.length > 0 ? (
        <View className="mt-8">
          <View className="mb-3 flex-row items-center gap-2">
            <Ionicons name="list-outline" size={16} color={brand.highlight} />
            <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Start from routine
            </Text>
          </View>
          <View className="gap-2">
            {routines.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => void startFromRoutine(r.id)}
                className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-4 active:border-highlight/40 active:bg-surface-elevated">
                <View className="min-w-0 flex-1 pr-3">
                  <Text className="font-medium text-foreground" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {r.exercises.length}{' '}
                    {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>
                <Text className="text-sm font-medium text-highlight">Start</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ActiveWorkout({ logger }: { logger: ReturnType<typeof useLogger> }) {
  const session = logger.session!;
  const settings = useSettings();
  const workouts = useWorkouts();
  const customExercises = useCustomExercises();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = new Date(session.startedAt).getTime();
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  function confirmDiscard() {
    Alert.alert(
      'Discard this workout?',
      'This deletes the in-progress session. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => void logger.discard(),
        },
      ],
    );
  }

  async function handleFinish() {
    await logger.persistNow(session);
    const started = new Date(session.startedAt);
    const tzOffsetMs = started.getTimezoneOffset() * 60_000;
    const date = new Date(started.getTime() - tzOffsetMs).toISOString().slice(0, 10);
    await repository.finishActiveSession({ date });
    refreshData();
    router.replace('/');
  }

  function confirmFinish() {
    Alert.alert('Finish workout?', 'Done sets will be saved to your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: () => void handleFinish() },
    ]);
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="timer-outline" size={18} color={brand.highlight} />
          <Text className="text-lg font-semibold text-foreground" accessibilityLabel="Elapsed time">
            {formatElapsed(elapsedSeconds)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={confirmDiscard}
            className="flex-row items-center gap-1 rounded-lg px-2 py-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Discard workout">
            <Ionicons name="trash-outline" size={18} color={brand.mutedForeground} />
            <Text className="text-sm text-muted-foreground">Discard</Text>
          </Pressable>
          <Pressable
            onPress={confirmFinish}
            className="flex-row items-center gap-1 rounded-lg bg-highlight px-3 py-2 active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel="Finish workout">
            <Ionicons name="checkmark-circle-outline" size={18} color={brand.highlightForeground} />
            <Text className="text-sm font-semibold text-highlight-foreground">Finish</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4 pb-28"
        keyboardShouldPersistTaps="handled">
        {session.exercises.length === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border px-6 py-12">
            <Ionicons name="barbell-outline" size={40} color={brand.mutedForeground} />
            <Text className="mt-4 text-base font-semibold text-foreground">Add your first exercise</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Search the catalog to start logging sets for this workout.
            </Text>
            <Pressable
              onPress={() => setSearchOpen(true)}
              className="mt-5 flex-row items-center gap-2 rounded-lg bg-highlight px-4 py-3 active:opacity-90">
              <Ionicons name="add" size={18} color={brand.highlightForeground} />
              <Text className="font-semibold text-highlight-foreground">Add exercise</Text>
            </Pressable>
          </View>
        ) : (
          session.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              unit={settings.unit}
              settings={settings}
              workouts={workouts}
              onPatchSet={(setId, patch) => logger.patchSet(ex.id, setId, patch)}
              onToggleDone={(setId, rest, prefill) =>
                logger.toggleDone(ex.id, setId, rest, prefill)
              }
              onAddSet={() => logger.addSet(ex.id)}
              onRemoveSet={(setId) => logger.removeSet(ex.id, setId)}
              onRemoveExercise={() => logger.removeExercise(ex.id)}
            />
          ))
        )}

        {session.exercises.length > 0 ? (
          <Pressable
            onPress={() => setSearchOpen(true)}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Add exercise">
            <Ionicons name="add" size={20} color={brand.highlight} />
            <Text className="font-medium text-foreground">Add exercise</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <RestTimerBar
        deadlineMs={session.restDeadlineMs}
        onSkip={logger.clearRest}
      />

      <ExerciseSearchModal
        visible={searchOpen}
        customExercises={customExercises}
        onClose={() => setSearchOpen(false)}
        onPick={(pick) => logger.addExercise(pick.exerciseId, pick.rawName)}
      />
    </View>
  );
}