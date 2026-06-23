import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { brand } from '@/theme';

type StatCardProps = {
  label: string;
  value?: number;
  suffix?: string;
  /** Pre-formatted hero value (overrides value + suffix). */
  display?: string;
  hint?: string;
  highlight?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

function formatValue(value: number, suffix = ''): string {
  const decimals = value % 1 === 0 ? 0 : 1;
  const formatted = decimals === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${formatted}${suffix}`;
}

export function StatCard({ label, value, suffix, display, hint, highlight, icon }: StatCardProps) {
  return (
    <View className="rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={highlight ? brand.highlight : brand.mutedForeground}
          />
        ) : null}
      </View>
      <Text
        className={`mt-2 text-3xl font-semibold ${highlight ? 'text-highlight' : 'text-foreground'}`}>
        {display ?? formatValue(value ?? 0, suffix)}
      </Text>
      {hint ? <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}