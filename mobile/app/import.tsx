import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { aiParseWorkouts } from '@core/ai/openrouter';
import { ingestCorpus } from '@core/features/import/pipeline';
import { SPLIT_LABELS } from '@core/features/history/history';
import { newId } from '@core/lib/id';
import { createCatalog } from '@core/parser';
import type { ParsedWorkout, SplitCanonical, Workout } from '@core/types/models';

import { repository } from '@/data/sqliteRepository';
import { refreshData, useCustomExercises, useSettings } from '@/hooks/useData';
import { formatUserWeight, longDate } from '@/lib/format';
import { brand } from '@/theme';

interface ReviewPayload {
  workouts: ParsedWorkout[];
  warnings: string[];
  skipped: string[];
}

function parsedToWorkouts(parsed: ParsedWorkout[]): Workout[] {
  const now = new Date().toISOString();
  return parsed.map((w) => ({
    id: newId(),
    date: w.date,
    dateConfidence: w.dateConfidence,
    bodyweightKg: w.bodyweightKg,
    splitCanonical: w.splitCanonical,
    splitRaw: w.splitRaw,
    blockId: null,
    sourceNoteId: '',
    createdAt: now,
    exercises: w.exercises,
  }));
}

export default function ImportScreen() {
  const settings = useSettings();
  const customExercises = useCustomExercises();
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseHint, setParseHint] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const catalog = useMemo(() => createCatalog(customExercises), [customExercises]);
  const exerciseNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of catalog.all()) {
      map.set(def.id, def.canonicalName);
    }
    return map;
  }, [catalog]);

  const clearReview = useCallback(() => {
    setReview(null);
    setShowSkipped(false);
  }, []);

  const enterReview = useCallback((payload: ReviewPayload) => {
    setParseHint(null);
    setReview(payload);
    setShowSkipped(false);
  }, []);

  const handleParse = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      Alert.alert('Nothing to parse', 'Paste your workout notes first.');
      return;
    }

    clearReview();
    const { workouts, skipped, warnings } = ingestCorpus(trimmed, customExercises);

    if (workouts.length === 0) {
      setParseHint(
        settings.aiApiKey
          ? "Couldn't auto-detect a workout. Here's the text we read — try AI parse, or edit and Parse."
          : "Couldn't auto-detect a workout. Here's the text we read — edit it or paste your note, then Parse.",
      );
      return;
    }

    enterReview({ workouts, warnings, skipped });
  }, [pasteText, customExercises, settings.aiApiKey, clearReview, enterReview]);

  const handleAiParse = useCallback(async () => {
    if (!settings.aiApiKey) {
      Alert.alert('API key required', 'Add your OpenRouter key in Settings to use AI parse.');
      return;
    }

    const trimmed = pasteText.trim();
    if (!trimmed) {
      Alert.alert('Nothing to parse', 'Paste your workout notes first.');
      return;
    }

    setBusy(true);
    clearReview();
    try {
      const parsed = await aiParseWorkouts(
        trimmed,
        {
          apiKey: settings.aiApiKey,
          model: settings.aiModel ?? 'meta-llama/llama-3.3-70b-instruct:free',
        },
        catalog,
      );

      if (parsed.length === 0) {
        setParseHint(
          "AI didn't find a workout in that text. Edit the notes and try again, or use Parse.",
        );
        return;
      }

      enterReview({ workouts: parsed, warnings: [], skipped: [] });
    } catch (err) {
      Alert.alert('AI parse failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [
    pasteText,
    settings.aiApiKey,
    settings.aiModel,
    catalog,
    clearReview,
    enterReview,
  ]);

  const handleSave = useCallback(async () => {
    if (!review || review.workouts.length === 0 || saving) return;

    const missingDate = review.workouts.find((w) => !w.date);
    if (missingDate) {
      Alert.alert('Missing date', 'Every workout needs a date before saving.');
      return;
    }

    setSaving(true);
    try {
      const toSave = parsedToWorkouts(review.workouts);
      await repository.saveWorkouts(toSave);
      refreshData();
      setReview(null);
      setPasteText('');
      setParseHint(null);
      Alert.alert(
        'Saved',
        `Saved ${toSave.length} workout${toSave.length === 1 ? '' : 's'}. Your numbers are updated.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/history') }],
      );
      router.replace('/(tabs)/history');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }, [review, saving]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: review ? 'Review' : 'Import',
          headerStyle: { backgroundColor: brand.background },
          headerTintColor: brand.foreground,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled">
          {!review ? (
            <>
              <Text className="text-sm text-muted-foreground">
                Paste messy gym notes — we'll segment, filter unrelated text, and parse sets.
              </Text>

              <TextInput
                className="min-h-48 rounded-xl border border-border bg-surface p-4 text-base text-foreground"
                multiline
                textAlignVertical="top"
                placeholder="Paste workout notes here…"
                placeholderTextColor={brand.mutedForeground}
                value={pasteText}
                onChangeText={(text) => {
                  setPasteText(text);
                  if (parseHint) setParseHint(null);
                }}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {parseHint ? (
                <View className="rounded-xl border border-warn/30 bg-warn/10 p-4">
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="information-circle-outline" size={18} color={brand.warn} />
                    <Text className="flex-1 text-sm text-muted-foreground">{parseHint}</Text>
                  </View>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-highlight py-3.5 active:opacity-80"
                  onPress={handleParse}
                  disabled={busy}>
                  <Ionicons name="scan-outline" size={20} color={brand.highlightForeground} />
                  <Text className="text-base font-semibold text-highlight-foreground">Parse</Text>
                </Pressable>

                {settings.aiApiKey ? (
                  <Pressable
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 active:opacity-80"
                    onPress={() => void handleAiParse()}
                    disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color={brand.highlight} />
                    ) : (
                      <Ionicons name="sparkles-outline" size={20} color={brand.highlight} />
                    )}
                    <Text className="text-base font-semibold text-highlight">AI parse</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <Text className="text-sm text-muted-foreground">
                Check the parsed workouts below. Nothing is saved until you tap Save.
              </Text>

              {review.workouts.map((workout, wi) => {
                const splitLabel =
                  SPLIT_LABELS[workout.splitCanonical as SplitCanonical] ?? workout.splitCanonical;
                return (
                  <View
                    key={`${workout.date}-${wi}`}
                    className="rounded-xl border border-border bg-surface p-4">
                    <View className="mb-3 flex-row flex-wrap items-center gap-2">
                      <Text className="text-base font-semibold text-foreground">
                        {longDate(workout.date) ?? (workout.date || 'No date')}
                      </Text>
                      <View className="rounded bg-surface-elevated px-2 py-0.5">
                        <Text className="text-xs font-medium text-muted-foreground">
                          {splitLabel}
                        </Text>
                      </View>
                      {workout.dateConfidence === 'low' ? (
                        <View className="rounded bg-warn/15 px-2 py-0.5">
                          <Text className="text-xs font-medium text-warn">Low date confidence</Text>
                        </View>
                      ) : null}
                    </View>

                    {workout.bodyweightKg != null ? (
                      <Text className="mb-3 text-xs text-muted-foreground">
                        Bodyweight: {formatUserWeight(workout.bodyweightKg, settings.unit)}
                      </Text>
                    ) : null}

                    {workout.exercises.map((ex, ei) => (
                      <View
                        key={`${ex.exerciseId}-${ei}`}
                        className="mb-3 rounded-lg border border-border/70 bg-background/40 p-3">
                        <Text className="mb-2 text-sm font-semibold text-foreground">
                          {ex.rawName || exerciseNamesById.get(ex.exerciseId) || ex.exerciseId}
                        </Text>
                        {ex.sets.map((set, si) => (
                          <View key={si} className="flex-row items-center gap-2 py-1">
                            {set.isWarmup ? (
                              <Text className="text-xs font-medium text-highlight">WU</Text>
                            ) : (
                              <Text className="w-5 text-center text-xs text-muted-foreground">
                                {si + 1}
                              </Text>
                            )}
                            <Text className="text-sm text-foreground">
                              {formatUserWeight(set.weightKg, ex.unit)} × {set.reps}
                              {set.rpe != null ? ` @ RPE ${set.rpe}` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })}

              {review.skipped.length > 0 ? (
                <View className="overflow-hidden rounded-xl border border-border bg-surface/60">
                  <Pressable
                    className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
                    onPress={() => setShowSkipped((v) => !v)}>
                    <Text className="text-sm text-muted-foreground">
                      <Text className="font-medium text-foreground">{review.skipped.length}</Text>{' '}
                      unrelated note{review.skipped.length === 1 ? '' : 's'} skipped
                    </Text>
                    <Ionicons
                      name={showSkipped ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={brand.mutedForeground}
                    />
                  </Pressable>
                  {showSkipped
                    ? review.skipped.map((seg, idx) => (
                        <View key={idx} className="border-t border-border px-4 py-2">
                          <Text className="text-xs text-muted-foreground" numberOfLines={6}>
                            {seg}
                          </Text>
                        </View>
                      ))
                    : null}
                </View>
              ) : null}

              {review.warnings.length > 0 ? (
                <View className="rounded-xl border border-warn/30 bg-warn/10 p-4">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="warning-outline" size={16} color={brand.warn} />
                    <Text className="text-sm font-medium text-warn">Parser warnings</Text>
                  </View>
                  {review.warnings.map((w, idx) => (
                    <Text key={idx} className="text-sm text-muted-foreground">
                      · {w}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Pressable
                  className="flex-1 items-center justify-center rounded-xl border border-border bg-surface py-3.5 active:opacity-80"
                  onPress={clearReview}
                  disabled={saving}>
                  <Text className="text-base font-semibold text-foreground">Back to edit</Text>
                </Pressable>
                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-highlight py-3.5 active:opacity-80"
                  onPress={() => void handleSave()}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color={brand.highlightForeground} />
                  ) : (
                    <Ionicons name="save-outline" size={20} color={brand.highlightForeground} />
                  )}
                  <Text className="text-base font-semibold text-highlight-foreground">
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}