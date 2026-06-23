import { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { brand } from '@/theme';

/** Visual tone for the ring arc — mirrors web RingGauge thresholds. */
export type GaugeTone = 'highlight' | 'warn' | 'destructive' | 'muted';

const TONE_STROKE: Record<GaugeTone, string> = {
  highlight: brand.highlight,
  warn: brand.warn,
  destructive: brand.destructive,
  muted: brand.mutedForeground,
};

export interface RingGaugeProps {
  /** Progress value in [0, max]. Drives the arc sweep + centre number. */
  value: number;
  /** Maximum value the ring represents. Default 100. */
  max?: number;
  /** Diameter in px. Default 140. */
  size?: number;
  /** Stroke width in px. Defaults to ~9% of `size` (clamped). */
  thickness?: number;
  /** Arc colour tone. Default derived from `value` when omitted. */
  tone?: GaugeTone;
  /** Small caption under the centre number (e.g. "Balance"). */
  label?: string;
  /** Secondary line under the label (e.g. qualitative status). */
  sublabel?: string;
  /** Render the centre value. Default true. */
  showValue?: boolean;
  /** Suffix appended to the auto-rendered centre number. */
  valueSuffix?: string;
  style?: StyleProp<ViewStyle>;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Balance Score → ring tone (acid-lime only for strong scores). */
export function scoreTone(score: number): GaugeTone {
  if (score >= 75) return 'highlight';
  if (score >= 50) return 'warn';
  return 'destructive';
}

function defaultTone(value: number, max: number): GaugeTone {
  if (max <= 0) return 'muted';
  return scoreTone((value / max) * 100);
}

/**
 * Circular score gauge for Dashboard + Coach — hand-rolled SVG ring with
 * strokeDasharray / strokeDashoffset progress arc.
 */
export function RingGauge({
  value,
  max = 100,
  size = 140,
  thickness,
  tone,
  label,
  sublabel,
  showValue = true,
  valueSuffix = '',
  style,
}: RingGaugeProps) {
  const target = clamp(value, 0, max);
  const fraction = max > 0 ? target / max : 0;
  const resolvedTone = tone ?? defaultTone(target, max);

  const stroke = thickness ?? clamp(Math.round(size * 0.09), 6, 22);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);

  const centreFontSize = useMemo(() => {
    if (size >= 180) return 40;
    if (size >= 120) return 32;
    return 24;
  }, [size]);

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="image"
      accessibilityLabel={`${Math.round(target)} out of ${max}`}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={brand.border}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[resolvedTone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>

      <View className="items-center justify-center px-2">
        {showValue ? (
          <Text
            className="font-semibold text-foreground"
            style={{ fontSize: centreFontSize, lineHeight: centreFontSize }}>
            {Math.round(target)}
            {valueSuffix}
          </Text>
        ) : null}
        {label ? (
          <Text className="mt-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </Text>
        ) : null}
        {sublabel ? (
          <Text className="mt-0.5 text-center text-xs text-muted-foreground">{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}