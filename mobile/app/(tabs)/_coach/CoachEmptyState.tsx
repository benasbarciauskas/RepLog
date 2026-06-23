import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { brand } from '@/theme';

type Variant = 'no-workouts' | 'insufficient';

export function CoachEmptyState({
  variant,
  unlockable = [],
}: {
  variant: Variant;
  unlockable?: { ruleId: string; label: string }[];
}) {
  const isNoWorkouts = variant === 'no-workouts';

  return (
    <View className="mx-5 mt-12 items-center px-4">
      <View
        className="mb-5 h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: brand.highlightMuted }}>
        <Ionicons name="radio-button-on" size={28} color={brand.highlight} />
      </View>
      <Text className="text-center text-xl font-semibold text-foreground">
        {isNoWorkouts ? 'Nothing to score yet' : 'Almost there — log one more lift'}
      </Text>
      <Text className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
        {isNoWorkouts
          ? 'Log or import a few workouts and your Balance Score appears here. Two comparable lifts unlock it — for example a bench press and an overhead press to score your pressing balance.'
          : 'Scoring needs at least two comparable lifts. Log an antagonist pair — a bench press and an overhead press, or a squat and a deadlift — and your Balance Score will appear.'}
      </Text>

      {!isNoWorkouts && unlockable.length > 0 ? (
        <View className="mt-8 w-full rounded-xl border border-dashed border-border bg-surface p-5">
          <Text className="text-sm text-muted-foreground">
            Log both lifts in each pair below to score these ratios and raise your Balance
            Score&apos;s confidence.
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {unlockable.map((u) => (
              <View
                key={u.ruleId}
                className="flex-row items-center gap-1.5 rounded-md bg-background px-2.5 py-1">
                <Ionicons name="lock-closed" size={12} color={brand.mutedForeground} />
                <Text className="text-xs text-foreground">{u.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}