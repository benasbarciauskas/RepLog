import { Pressable, Text, View } from 'react-native';

import { brand } from '@/theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface OptionChipsProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionChipsProps<T>) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`rounded-lg border px-3.5 py-2.5 active:opacity-80 ${
                selected
                  ? 'border-highlight bg-highlight-muted'
                  : 'border-border bg-surface'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <Text
                className={`text-sm font-medium ${
                  selected ? 'text-highlight' : 'text-foreground'
                }`}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function OptionRows<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionChipsProps<T>) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="overflow-hidden rounded-xl border border-border">
        {options.map((opt, i) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`flex-row items-center justify-between px-4 py-3.5 active:bg-surface-elevated ${
                i > 0 ? 'border-t border-border' : ''
              } ${selected ? 'bg-highlight-muted' : 'bg-surface'}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <Text
                className={`text-sm ${selected ? 'font-semibold text-highlight' : 'text-foreground'}`}>
                {opt.label}
              </Text>
              {selected ? (
                <Text className="text-xs font-semibold text-highlight">Selected</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}