import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRestClock, restRemainingSeconds } from '@core/features/logger/lib';

import { brand } from '@/theme';

export interface RestTimerBarProps {
  deadlineMs: number | null | undefined;
  onSkip: () => void;
}

export function RestTimerBar({ deadlineMs, onSkip }: RestTimerBarProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (deadlineMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (deadlineMs == null) return null;

  const remaining = restRemainingSeconds(deadlineMs, now);
  if (remaining <= 0) return null;

  return (
    <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between rounded-xl border border-highlight/30 bg-surface-elevated px-4 py-3 shadow-lg">
      <View className="flex-row items-center gap-2">
        <Ionicons name="timer-outline" size={20} color={brand.highlight} />
        <Text className="text-base font-semibold text-foreground">{formatRestClock(remaining)}</Text>
        <Text className="text-sm text-muted-foreground">rest</Text>
      </View>
      <Pressable
        onPress={onSkip}
        className="rounded-lg border border-border px-3 py-1.5 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="Skip rest">
        <Text className="text-sm font-medium text-muted-foreground">Skip</Text>
      </Pressable>
    </View>
  );
}