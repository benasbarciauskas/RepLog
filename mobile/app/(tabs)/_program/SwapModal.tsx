import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import type { ExerciseDef } from '@core/types/models';
import type { SimilarExercise } from '@core/program/substitute';

import { brand } from '@/theme';

function humanCategory(c: ExerciseDef['category']): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export interface SwapModalProps {
  visible: boolean;
  exerciseName: string;
  options: SimilarExercise[];
  onClose: () => void;
  onPick: (def: ExerciseDef) => void;
}

export function SwapModal({
  visible,
  exerciseName,
  options,
  onClose,
  onPick,
}: SwapModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-lg font-semibold text-foreground">Swap exercise</Text>
            <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
              Replace {exerciseName}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="rounded-lg p-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={brand.foreground} />
          </Pressable>
        </View>

        {options.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-sm text-muted-foreground">
              No close matches for this exercise.
            </Text>
          </View>
        ) : (
          <FlatList
            data={options}
            keyExtractor={(item) => item.def.id}
            contentContainerClassName="px-4 py-3"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item.def)}
                className="mb-2 rounded-xl border border-border bg-surface px-4 py-3.5 active:border-highlight/40 active:bg-surface-elevated">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                    {item.def.canonicalName}
                  </Text>
                  <View className="rounded-full border border-border px-2 py-0.5">
                    <Text className="text-xs text-muted-foreground">{humanCategory(item.def.category)}</Text>
                  </View>
                </View>
                <Text className="mt-1 text-xs text-muted-foreground">{item.reason}</Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}