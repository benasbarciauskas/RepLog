import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ExerciseBest } from '@core/types/models';
import type { Unit } from '@core/types/models';

import { formatUserWeight, longDate } from '@/lib/format';
import { brand } from '@/theme';

type BestCardProps = {
  name: string;
  best: ExerciseBest;
  unit: Unit;
  onPress?: () => void;
};

export function BestCard({ name, best, unit, onPress }: BestCardProps) {
  const e1rm = best.bestE1rmKg ?? best.maxWeightKg ?? 0;
  const date = longDate(best.maxWeightDate ?? best.bestE1rmDate);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`rounded-xl border border-border bg-surface p-4 ${onPress ? 'active:opacity-80' : ''}`}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${name}, best ${formatUserWeight(best.maxWeightKg, unit)}`}>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-medium text-muted-foreground" numberOfLines={2}>
          {name}
        </Text>
        <Ionicons name="trophy-outline" size={18} color={brand.highlight} />
      </View>
      <Text className="mt-2 text-3xl font-semibold text-highlight">
        {formatUserWeight(best.maxWeightKg, unit)}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">
        Est. 1RM {formatUserWeight(e1rm, unit)}
        {date ? ` · ${date}` : ''}
      </Text>
    </Pressable>
  );
}