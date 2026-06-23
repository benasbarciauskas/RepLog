import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { overallLabel, type ScoreStatus } from '@core/coach/score';

import { RingGauge, type GaugeTone } from '@/components/RingGauge';
import { useCoach, useCoachFindings, useWorkouts } from '@/hooks/useData';
import { brand } from '@/theme';

import { CoachEmptyState } from './_coach/CoachEmptyState';
import { RecommendationCard } from './_coach/RecommendationCard';
import { VolumeSection } from './_coach/VolumeSection';

const SUBTITLE =
  'A single Balance Score from how close your lifts sit to healthy strength ratios — plus what to train next.';

const STATUS_TONE: Record<ScoreStatus, GaugeTone> = {
  strong: 'highlight',
  watch: 'warn',
  attention: 'destructive',
};

const STATUS_COLOR: Record<ScoreStatus, string> = {
  strong: brand.highlight,
  watch: brand.warn,
  attention: brand.destructive,
};

const GROUP_KEYS = new Set(['push', 'pull', 'lower']);

export default function CoachScreen() {
  const { score } = useCoach();
  const findings = useCoachFindings();
  const workouts = useWorkouts();

  const recommendations = useMemo(
    () => findings.filter((f) => f.severity !== 'ok'),
    [findings],
  );

  const groupAreas = useMemo(
    () => score.areas.filter((a) => GROUP_KEYS.has(a.key) && a.score != null),
    [score.areas],
  );

  if (workouts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
        <CoachHeader />
        <CoachEmptyState variant="no-workouts" />
      </SafeAreaView>
    );
  }

  if (score.overall == null) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          <CoachHeader />
          <CoachEmptyState variant="insufficient" unlockable={score.unlockable} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const overall = score.overall;
  const overallStatus: ScoreStatus =
    overall >= 75 ? 'strong' : overall >= 50 ? 'watch' : 'attention';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10">
        <CoachHeader />

        <View className="mt-8 items-center">
          <RingGauge
            value={overall}
            size={200}
            tone={STATUS_TONE[overallStatus]}
            label="Balance"
          />
          <Text
            className="mt-5 text-lg font-semibold"
            style={{ color: STATUS_COLOR[overallStatus] }}>
            {overallLabel(overall)}
          </Text>
          <Text className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
            Scored from {score.scoredRules}{' '}
            {score.scoredRules === 1 ? 'strength ratio' : 'strength ratios'}. Higher means your
            lifts sit closer to their healthy bands.
          </Text>
        </View>

        {groupAreas.length > 0 ? (
          <View className="mt-10">
            <SectionTitle>By area</SectionTitle>
            <View className="mt-4 flex-row flex-wrap justify-center gap-4">
              {groupAreas.map((area) => (
                <View
                  key={area.key}
                  className="w-[44%] items-center gap-3 rounded-xl border border-border bg-surface p-4">
                  <RingGauge
                    value={area.score ?? 0}
                    size={96}
                    thickness={9}
                    tone={STATUS_TONE[area.status]}
                  />
                  <Text className="text-center text-sm font-medium text-foreground">
                    {area.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-10">
          <SectionTitle>Do this to improve</SectionTitle>
          {recommendations.length > 0 ? (
            <View className="mt-4 gap-3">
              {recommendations.map((f) => (
                <RecommendationCard key={f.ruleId} finding={f} />
              ))}
            </View>
          ) : (
            <View
              className="mt-4 rounded-xl border p-5"
              style={{
                borderColor: 'rgba(162,235,60,0.3)',
                backgroundColor: brand.highlightMuted,
              }}>
              <Text className="text-sm font-semibold text-highlight">Nicely balanced</Text>
              <Text className="mt-2 text-sm text-muted-foreground">
                Every ratio we could check is sitting in a healthy range. Keep the programming
                balanced and your score steady.
              </Text>
            </View>
          )}
        </View>

        <VolumeSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function CoachHeader() {
  return (
    <View className="px-5 pt-2">
      <Text className="text-3xl font-bold text-foreground">Coach</Text>
      <Text className="mt-2 text-sm leading-relaxed text-muted-foreground">{SUBTITLE}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </Text>
  );
}