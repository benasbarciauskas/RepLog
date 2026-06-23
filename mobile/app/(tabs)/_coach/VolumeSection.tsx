import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { createCatalog } from '@core/parser';
import {
  volumeRecommendations,
  volumeReport,
  workoutsInVolumeWindow,
  type MuscleVolume,
} from '@core/program/volume';
import type { MuscleGroup } from '@core/types/models';

import { useActiveProgram, useCustomExercises, useWorkouts } from '@/hooks/useData';
import { brand } from '@/theme';

function humanMuscle(m: MuscleGroup): string {
  return m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_META: Record<
  MuscleVolume['status'],
  { label: string; pillBg: string; pillText: string; bar: string }
> = {
  under: {
    label: 'Under',
    pillBg: 'rgba(232,184,74,0.12)',
    pillText: brand.warn,
    bar: brand.warn,
  },
  optimal: {
    label: 'Optimal',
    pillBg: brand.highlightMuted,
    pillText: brand.highlight,
    bar: brand.highlight,
  },
  high: {
    label: 'High',
    pillBg: 'rgba(232,92,74,0.12)',
    pillText: brand.destructive,
    bar: brand.destructive,
  },
};

function VolumeBar({ row }: { row: MuscleVolume }) {
  const max = Math.max(row.mav * 1.25, row.sets, row.mev);
  const fillPct = max > 0 ? Math.min(100, (row.sets / max) * 100) : 0;
  const mevPct = (row.mev / max) * 100;
  const mavPct = (row.mav / max) * 100;
  const meta = STATUS_META[row.status];

  return (
    <View className="relative h-2 w-full overflow-hidden rounded-full bg-surface">
      <View
        className="absolute inset-y-0 rounded-full"
        style={{
          left: `${mevPct}%`,
          width: `${mavPct - mevPct}%`,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
      <View
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${fillPct}%`, backgroundColor: meta.bar }}
      />
    </View>
  );
}

function VolumeRow({ row }: { row: MuscleVolume }) {
  const meta = STATUS_META[row.status];
  const setsLabel = Number.isInteger(row.sets) ? String(row.sets) : row.sets.toFixed(1);

  return (
    <View className="rounded-xl border border-border bg-surface p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-sm font-medium text-foreground">{humanMuscle(row.muscle)}</Text>
        <View
          className="rounded-full border px-2 py-0.5"
          style={{ borderColor: `${meta.pillText}4D`, backgroundColor: meta.pillBg }}>
          <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.pillText }}>
            {meta.label}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-baseline justify-between gap-2">
        <Text className="text-xs font-medium text-foreground">{setsLabel} sets</Text>
        <Text className="text-xs text-muted-foreground">
          {setsLabel} / {row.mev}–{row.mav}
        </Text>
      </View>
      <View className="mt-2">
        <VolumeBar row={row} />
      </View>
    </View>
  );
}

export function VolumeSection() {
  const workouts = useWorkouts();
  const customExercises = useCustomExercises();
  const activeProgram = useActiveProgram();

  const catalog = useMemo(() => createCatalog(customExercises).all(), [customExercises]);

  const report = useMemo(
    () =>
      volumeReport(workouts, catalog, {
        experience: activeProgram?.config.experience,
      }),
    [workouts, catalog, activeProgram?.config.experience],
  );

  const recommendations = useMemo(() => volumeRecommendations(report), [report]);
  const windowCount = useMemo(() => workoutsInVolumeWindow(workouts), [workouts]);

  return (
    <View className="mt-10">
      <View className="flex-row items-center gap-2">
        <Ionicons name="bar-chart-outline" size={16} color={brand.highlight} />
        <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Weekly volume
        </Text>
      </View>
      <Text className="mt-2 text-sm text-muted-foreground">
        Working sets per muscle over the last 7 days vs healthy ranges.
      </Text>

      {windowCount < 1 ? (
        <Text className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Log a workout this week to see volume.
        </Text>
      ) : (
        <View className="mt-4 gap-6">
          {recommendations.length > 0 ? (
            <View>
              <View className="mb-3 flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={14} color={brand.warn} />
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Volume priorities
                </Text>
              </View>
              <View className="gap-2">
                {recommendations.map((text) => (
                  <View
                    key={text}
                    className="flex-row gap-3 rounded-xl border border-border bg-surface p-4">
                    <View
                      className="size-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'rgba(232,184,74,0.12)' }}>
                      <Ionicons name="arrow-up" size={16} color={brand.warn} />
                    </View>
                    <Text className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
                      {text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View
              className="rounded-xl border p-4"
              style={{
                borderColor: 'rgba(162,235,60,0.3)',
                backgroundColor: brand.highlightMuted,
              }}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle-outline" size={18} color={brand.highlight} />
                <Text className="text-sm font-semibold text-highlight">Volume on track</Text>
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">
                Every tracked muscle sits in a healthy weekly range.
              </Text>
            </View>
          )}

          <View className="gap-3">
            {report.map((row) => (
              <VolumeRow key={row.muscle} row={row} />
            ))}
          </View>

          <View className="flex-row items-start gap-2">
            <Ionicons name="information-circle-outline" size={14} color={brand.mutedForeground} />
            <Text className="min-w-0 flex-1 text-xs text-muted-foreground">
              Primary muscles count 1 set per working set; secondary muscles count 0.5. Warm-ups are
              excluded.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}