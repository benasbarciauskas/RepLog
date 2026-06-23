import { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { previousSetsFor, workingSetNumber } from '@core/features/logger/lib';
import type { ActiveExercise, ActiveSet, AppSettings, Unit, Workout } from '@core/types/models';

import { brand } from '@/theme';

import { displayNum, parseToKg, previousLabel } from './setHelpers';

export interface ExerciseCardProps {
  exercise: ActiveExercise;
  unit: Unit;
  settings: AppSettings;
  workouts: Workout[];
  onPatchSet: (setId: string, patch: Partial<ActiveSet>) => void;
  onToggleDone: (
    setId: string,
    restSeconds: number,
    prefill?: Partial<ActiveSet>,
  ) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
}

function SetRow({
  set,
  number,
  previous,
  unit,
  onPatch,
  onToggleDone,
  onRemove,
}: {
  set: ActiveSet;
  number: number | null;
  previous: ReturnType<typeof previousSetsFor>[number] | null;
  unit: Unit;
  onPatch: (patch: Partial<ActiveSet>) => void;
  onToggleDone: (prefill?: Partial<ActiveSet>) => void;
  onRemove: () => void;
}) {
  const prev = previousLabel(previous, unit);

  return (
    <View
      className={`flex-row items-center gap-1 rounded-lg px-1 py-1.5 ${set.done ? 'bg-highlight-muted' : ''}`}>
      <Text className="w-7 text-center text-sm font-semibold text-muted-foreground">
        {set.isWarmup ? 'W' : number}
      </Text>

      <Pressable
        disabled={!previous}
        onPress={() =>
          previous && onPatch({ weightKg: previous.weightKg, reps: previous.reps })
        }
        className="w-14">
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {prev}
        </Text>
      </Pressable>

      <TextInput
        keyboardType="decimal-pad"
        placeholder={previous ? displayNum(previous.weightKg, unit) || 'BW' : '0'}
        placeholderTextColor={brand.mutedForeground}
        value={displayNum(set.weightKg, unit)}
        onChangeText={(text) => onPatch({ weightKg: parseToKg(text, unit) })}
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-center text-sm text-foreground"
      />

      <TextInput
        keyboardType="number-pad"
        placeholder={previous ? String(previous.reps) : '0'}
        placeholderTextColor={brand.mutedForeground}
        value={set.reps == null ? '' : String(set.reps)}
        onChangeText={(text) =>
          onPatch({
            reps: text === '' ? null : Math.max(0, Math.floor(Number(text))),
          })
        }
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-center text-sm text-foreground"
      />

      <TextInput
        keyboardType="decimal-pad"
        placeholder="RPE"
        placeholderTextColor={brand.mutedForeground}
        value={set.rpe == null ? '' : String(set.rpe)}
        onChangeText={(text) =>
          onPatch({ rpe: text === '' ? null : Number(text) })
        }
        className="h-9 w-11 rounded-md border border-border bg-surface px-1 text-center text-xs text-foreground"
      />

      <Pressable
        onPress={() => {
          if (!set.done) {
            const patch: Partial<ActiveSet> = {};
            if (set.weightKg == null && previous?.weightKg != null) {
              patch.weightKg = previous.weightKg;
            }
            if (set.reps == null && previous?.reps != null) {
              patch.reps = previous.reps;
            }
            onToggleDone(Object.keys(patch).length > 0 ? patch : undefined);
            return;
          }
          onToggleDone();
        }}
        className={`h-9 w-9 items-center justify-center rounded-md border ${
          set.done
            ? 'border-highlight bg-highlight'
            : 'border-border bg-surface'
        }`}
        accessibilityRole="button"
        accessibilityLabel={set.done ? 'Mark set not done' : 'Mark set done'}>
        <Ionicons
          name="checkmark"
          size={18}
          color={set.done ? brand.highlightForeground : brand.mutedForeground}
        />
      </Pressable>

      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Remove set">
        <Ionicons name="close" size={16} color={brand.mutedForeground} />
      </Pressable>
    </View>
  );
}

export function ExerciseCard({
  exercise,
  unit,
  settings,
  workouts,
  onPatchSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: ExerciseCardProps) {
  const previous = useMemo(
    () => previousSetsFor(workouts, exercise.exerciseId),
    [workouts, exercise.exerciseId],
  );

  const workingIndexBySetId = useMemo(() => {
    const map = new Map<string, number>();
    let workingIdx = -1;
    for (const set of exercise.sets) {
      if (!set.isWarmup) {
        workingIdx += 1;
        map.set(set.id, workingIdx);
      }
    }
    return map;
  }, [exercise.sets]);

  const restSeconds = exercise.restSeconds ?? settings.defaultRestSeconds;
  const weightLabel = unit === 'lb' ? 'lb' : 'kg';

  return (
    <View className="rounded-xl border border-border bg-surface-elevated p-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
          {exercise.rawName}
        </Text>
        <Pressable
          onPress={onRemoveExercise}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove exercise">
          <Ionicons name="trash-outline" size={18} color={brand.destructive} />
        </Pressable>
      </View>

      <View className="mb-1 flex-row items-center gap-1 px-1">
        <Text className="w-7 text-center text-[10px] font-medium uppercase text-muted-foreground">
          Set
        </Text>
        <Text className="w-14 text-[10px] font-medium uppercase text-muted-foreground">Prev</Text>
        <Text className="min-w-0 flex-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          {weightLabel}
        </Text>
        <Text className="min-w-0 flex-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          Reps
        </Text>
        <Text className="w-11 text-center text-[10px] font-medium uppercase text-muted-foreground">
          RPE
        </Text>
        <View className="w-9" />
        <View className="w-4" />
      </View>

      {exercise.sets.map((set, i) => {
        const number = workingSetNumber(exercise.sets, i);
        const workingIdx = workingIndexBySetId.get(set.id);
        const prev =
          set.isWarmup || workingIdx === undefined
            ? null
            : (previous[workingIdx] ?? null);

        return (
          <SetRow
            key={set.id}
            set={set}
            number={number}
            previous={prev}
            unit={unit}
            onPatch={(patch) => onPatchSet(set.id, patch)}
            onToggleDone={(prefill) => onToggleDone(set.id, restSeconds, prefill)}
            onRemove={() => onRemoveSet(set.id)}
          />
        );
      })}

      <Pressable
        onPress={onAddSet}
        className="mt-2 flex-row items-center justify-center gap-1.5 rounded-lg py-2 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="Add set">
        <Ionicons name="add" size={18} color={brand.highlight} />
        <Text className="text-sm font-medium text-muted-foreground">Add set</Text>
      </Pressable>
    </View>
  );
}