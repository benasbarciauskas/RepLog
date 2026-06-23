import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { CoachFinding, FindingSeverity, MuscleGroup } from '@core/types/models';
import { brand } from '@/theme';

const SEVERITY_META: Record<
  FindingSeverity,
  {
    label: string;
    color: string;
    borderColor: string;
    iconBg: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  priority: {
    label: 'Priority',
    color: brand.destructive,
    borderColor: 'rgba(232,92,74,0.4)',
    iconBg: 'rgba(232,92,74,0.12)',
    icon: 'alert-circle',
  },
  flag: {
    label: 'Watch',
    color: brand.mutedForeground,
    borderColor: brand.border,
    iconBg: brand.surfaceElevated,
    icon: 'information-circle',
  },
  ok: {
    label: 'In balance',
    color: brand.mutedForeground,
    borderColor: brand.border,
    iconBg: brand.highlightMuted,
    icon: 'checkmark-circle',
  },
};

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecommendationCard({ finding }: { finding: CoachFinding }) {
  const meta = SEVERITY_META[finding.severity];

  return (
    <View
      className="flex-row gap-4 rounded-xl border bg-surface p-4"
      style={{ borderColor: meta.borderColor }}>
      <View
        className="h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.iconBg }}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
            {meta.label}
          </Text>
          {finding.ratio != null ? (
            <View className="rounded bg-background px-1.5 py-0.5">
              <Text className="text-xs font-medium text-muted-foreground">
                ratio {finding.ratio.toFixed(2)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-sm leading-relaxed text-foreground">{finding.message}</Text>
        {finding.muscles.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {finding.muscles.map((m) => (
              <View key={m} className="rounded bg-background px-2 py-0.5">
                <Text className="text-xs text-muted-foreground">{humanMuscle(m)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}