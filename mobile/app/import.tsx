import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { aiParseWorkouts } from '@core/ai/openrouter';
import { ingestCorpus } from '@core/features/import/pipeline';
import { createCatalog } from '@core/parser';

import { useCustomExercises, useSettings } from '@/hooks/useData';

export default function ImportScreen() {
  const settings = useSettings();
  const customExercises = useCustomExercises();
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleParse = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      Alert.alert('Nothing to parse', 'Paste your workout notes first.');
      return;
    }

    const { workouts, skipped, warnings } = ingestCorpus(trimmed, customExercises);

    if (workouts.length === 0) {
      Alert.alert(
        'No workouts found',
        skipped.length > 0
          ? `Found ${skipped.length} note${skipped.length === 1 ? '' : 's'}, but none looked like a workout.`
          : 'That text did not contain any recognisable workout data.',
      );
      return;
    }

    // TODO(import-review): Navigate to the review screen with { workouts, skipped, warnings }
    // and persist a RawNote for provenance before the user confirms save.
    Alert.alert(
      'Parsed',
      `Found ${workouts.length} workout${workouts.length === 1 ? '' : 's'}` +
        (skipped.length > 0 ? ` (${skipped.length} unrelated skipped)` : '') +
        (warnings.length > 0 ? `\n\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}.` : '') +
        '\n\nReview & save UI coming next.',
    );
  }, [pasteText, customExercises]);

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
    try {
      const catalog = createCatalog(customExercises);
      const parsed = await aiParseWorkouts(
        trimmed,
        {
          apiKey: settings.aiApiKey,
          model: settings.aiModel ?? 'meta-llama/llama-3.3-70b-instruct:free',
        },
        catalog,
      );

      if (parsed.length === 0) {
        Alert.alert('No workout found', 'AI did not find a workout in that text.');
        return;
      }

      // TODO(import-review): Navigate to review with AI-parsed workouts + provenance note.
      Alert.alert(
        'AI parsed',
        `Found ${parsed.length} workout${parsed.length === 1 ? '' : 's'}.\n\nDouble-check the numbers on the review screen (coming next).`,
      );
    } catch (err) {
      Alert.alert('AI parse failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [pasteText, settings.aiApiKey, settings.aiModel, customExercises]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Import',
          headerStyle: { backgroundColor: '#0c0d0f' },
          headerTintColor: '#f4f5f6',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled">
          <Text className="text-sm text-muted-foreground">
            Paste messy gym notes — we'll segment, filter unrelated text, and parse sets.
          </Text>

          <TextInput
            className="min-h-48 rounded-xl border border-border bg-surface p-4 text-base text-foreground"
            multiline
            textAlignVertical="top"
            placeholder="Paste workout notes here…"
            placeholderTextColor="#9d9ea2"
            value={pasteText}
            onChangeText={setPasteText}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-highlight py-3.5 active:opacity-80"
              onPress={handleParse}
              disabled={busy}>
              <Ionicons name="scan-outline" size={20} color="#141609" />
              <Text className="text-base font-semibold text-highlight-foreground">Parse</Text>
            </Pressable>

            {settings.aiApiKey ? (
              <Pressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 active:opacity-80"
                onPress={() => void handleAiParse()}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#a2eb3c" />
                ) : (
                  <Ionicons name="sparkles-outline" size={20} color="#a2eb3c" />
                )}
                <Text className="text-base font-semibold text-highlight">AI parse</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}