import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { createCatalog } from '@core/parser';
import type { ExerciseDef } from '@core/types/models';

import { repository } from '@/data/sqliteRepository';
import { refreshData } from '@/hooks/useData';
import { brand } from '@/theme';

export interface ExercisePick {
  exerciseId: string;
  rawName: string;
}

export interface ExerciseSearchModalProps {
  visible: boolean;
  customExercises: ExerciseDef[];
  onClose: () => void;
  onPick: (pick: ExercisePick) => void;
}

function humanCategory(c: ExerciseDef['category']): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `x${hashName(name.trim().toLowerCase())}`;
}

function hashName(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function ExerciseSearchModal({
  visible,
  customExercises,
  onClose,
  onPick,
}: ExerciseSearchModalProps) {
  const [query, setQuery] = useState('');
  const catalog = useMemo(() => createCatalog(customExercises), [customExercises]);

  const results = useMemo(() => {
    const all = catalog.all();
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...all].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    }
    const scored = all
      .map((d) => {
        const name = d.canonicalName.toLowerCase();
        const aliasHit = d.aliases.some((al) => al.includes(q));
        let score = 3;
        if (name.startsWith(q)) score = 0;
        else if (name.includes(q)) score = 1;
        else if (aliasHit) score = 2;
        return { d, score };
      })
      .filter((x) => x.score < 3);
    scored.sort((a, b) => a.score - b.score || a.d.canonicalName.localeCompare(b.d.canonicalName));
    return scored.map((x) => x.d);
  }, [catalog, query]);

  const trimmed = query.trim();
  const canCreateCustom =
    trimmed.length > 0 &&
    !results.some((d) => d.canonicalName.toLowerCase() === trimmed.toLowerCase());

  function pick(p: ExercisePick) {
    onPick(p);
    setQuery('');
    onClose();
  }

  async function createAndPickCustom(name: string) {
    const slug = slugify(name);
    const id = `custom:${slug}`;
    await repository.addCustomExercise({
      id,
      canonicalName: name,
      aliases: [name.toLowerCase()],
      category: 'push',
      pattern: 'isolation',
      primaryMuscles: [],
      secondaryMuscles: [],
    });
    refreshData();
    pick({ exerciseId: id, rawName: name });
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Add exercise</Text>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={brand.foreground} />
          </Pressable>
        </View>

        <View className="px-4 py-3">
          <View className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-3">
            <Ionicons name="search" size={18} color={brand.mutedForeground} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Bench press, squat, curl…"
              placeholderTextColor={brand.mutedForeground}
              className="h-11 flex-1 text-base text-foreground"
            />
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-2 pb-6"
          ListHeaderComponent={
            canCreateCustom ? (
              <Pressable
                onPress={() => void createAndPickCustom(trimmed)}
                className="mx-2 mb-1 flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-surface-elevated">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight-muted">
                  <Ionicons name="add" size={18} color={brand.highlight} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-foreground">Add “{trimmed}”</Text>
                  <Text className="text-xs text-muted-foreground">Custom exercise</Text>
                </View>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            !canCreateCustom ? (
              <Text className="px-4 py-8 text-center text-sm text-muted-foreground">
                No matches. Keep typing to add a custom exercise.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick({ exerciseId: item.id, rawName: item.canonicalName })}
              className="mx-2 flex-row items-center justify-between gap-3 rounded-lg px-3 py-3 active:bg-surface-elevated">
              <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                {item.canonicalName}
              </Text>
              <View className="rounded-md border border-border px-2 py-0.5">
                <Text className="text-xs text-muted-foreground">{humanCategory(item.category)}</Text>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}