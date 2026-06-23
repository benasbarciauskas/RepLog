import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { formatWeight } from '@core/lib/units';
import type { AppSettings, Unit } from '@core/types/models';

import { DEFAULT_SETTINGS, repository } from '@/data/sqliteRepository';
import { refreshData, useSettings } from '@/hooks/useData';
import { brand } from '@/theme';

const REST_PRESETS = [60, 90, 120, 180] as const;

export default function SettingsScreen() {
  const settings = useSettings();
  const [newPlate, setNewPlate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [exportFallbackJson, setExportFallbackJson] = useState<string | null>(null);

  const save = useCallback(
    async (patch: Partial<AppSettings>) => {
      await repository.saveSettings({ ...settings, ...patch });
      refreshData();
    },
    [settings],
  );

  const addPlate = useCallback(() => {
    const value = Number(newPlate);
    if (!Number.isFinite(value) || value <= 0) return;
    if (settings.availablePlatesKg.includes(value)) {
      setNewPlate('');
      return;
    }
    const next = [...settings.availablePlatesKg, value].sort((a, b) => b - a);
    void save({ availablePlatesKg: next });
    setNewPlate('');
  }, [newPlate, save, settings.availablePlatesKg]);

  const removePlate = useCallback(
    (plate: number) => {
      void save({
        availablePlatesKg: settings.availablePlatesKg.filter((p) => p !== plate),
      });
    },
    [save, settings.availablePlatesKg],
  );

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportFallbackJson(null);
    try {
      const blob = await repository.exportData();
      const json = await blob.text();
      const date = new Date().toISOString().slice(0, 10);
      await Share.share({
        message: json,
        title: `replog-backup-${date}.json`,
      });
    } catch (err) {
      try {
        const blob = await repository.exportData();
        const json = await blob.text();
        setExportFallbackJson(json);
      } catch {
        Alert.alert(
          'Export failed',
          err instanceof Error ? err.message : 'Could not export data',
        );
      }
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const handleImport = useCallback(async () => {
    const trimmed = importText.trim();
    if (!trimmed) {
      Alert.alert('Nothing to import', 'Paste your backup JSON first.');
      return;
    }
    if (importing) return;
    setImporting(true);
    try {
      await repository.importData(trimmed);
      refreshData();
      setImportText('');
      setShowImport(false);
      Alert.alert('Import complete', 'Your data has been restored.');
    } catch (err) {
      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Could not import backup',
      );
    } finally {
      setImporting(false);
    }
  }, [importText, importing]);

  const restPresetValue = REST_PRESETS.includes(
    settings.defaultRestSeconds as (typeof REST_PRESETS)[number],
  )
    ? String(settings.defaultRestSeconds)
    : '';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-10 px-4 pb-8 pt-4"
        keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-foreground">Settings</Text>

        <SettingsSection
          title="Units"
          description="How weights are displayed. Stored values stay in kilograms.">
          <SegmentedControl
            options={[
              { value: 'kg' as Unit, label: 'kg' },
              { value: 'lb' as Unit, label: 'lb' },
            ]}
            value={settings.unit}
            onChange={(unit) => void save({ unit })}
          />
        </SettingsSection>

        <SettingsSection
          title="Default rest"
          description="Starting rest-timer length between sets. Adjustable per exercise.">
          <View className="gap-3">
            <SegmentedControl
              options={REST_PRESETS.map((s) => ({
                value: String(s),
                label: formatRest(s),
              }))}
              value={restPresetValue}
              onChange={(v) => void save({ defaultRestSeconds: Number(v) })}
              compact
            />
            <View className="flex-row items-center gap-2">
              <TextInput
                className="w-24 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground"
                keyboardType="number-pad"
                accessibilityLabel="Default rest in seconds"
                value={String(settings.defaultRestSeconds)}
                onChangeText={(text) => {
                  const n = Number(text);
                  if (Number.isFinite(n) && n >= 0) void save({ defaultRestSeconds: n });
                }}
              />
              <Text className="text-sm text-muted-foreground">seconds</Text>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          title="Bar weight"
          description="Empty bar weight for the plate calculator. Stored in kilograms.">
          <View className="flex-row items-center gap-2">
            <TextInput
              className="w-24 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground"
              keyboardType="decimal-pad"
              accessibilityLabel="Bar weight in kilograms"
              value={String(settings.barWeightKg)}
              onChangeText={(text) => {
                const n = Number(text);
                if (Number.isFinite(n) && n >= 0) void save({ barWeightKg: n });
              }}
            />
            <Text className="text-sm text-muted-foreground">kg</Text>
          </View>
        </SettingsSection>

        <SettingsSection
          title="Available plates"
          description="Plates you have, per side. The calculator only loads these.">
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-2">
              {settings.availablePlatesKg.length === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  No plates yet — add one below.
                </Text>
              ) : (
                [...settings.availablePlatesKg]
                  .sort((a, b) => b - a)
                  .map((plate) => (
                    <View
                      key={plate}
                      className="flex-row items-center gap-1.5 rounded-md border border-border bg-surface py-1 pl-2.5 pr-1">
                      <Text className="text-sm font-medium text-foreground">
                        {formatWeight(plate, settings.unit)}
                      </Text>
                      <Pressable
                        accessibilityLabel={`Remove ${formatWeight(plate, settings.unit)} plate`}
                        className="rounded p-1 active:opacity-70"
                        onPress={() => removePlate(plate)}>
                        <Ionicons name="close" size={16} color={brand.mutedForeground} />
                      </Pressable>
                    </View>
                  ))
              )}
            </View>

            <View className="flex-row items-center gap-2">
              <TextInput
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground"
                keyboardType="decimal-pad"
                placeholder="Add plate (kg)"
                placeholderTextColor={brand.mutedForeground}
                accessibilityLabel="New plate weight in kilograms"
                value={newPlate}
                onChangeText={setNewPlate}
                onSubmitEditing={addPlate}
                returnKeyType="done"
              />
              <Pressable
                className="flex-row items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2.5 active:opacity-80"
                onPress={addPlate}>
                <Ionicons name="add" size={18} color={brand.highlight} />
                <Text className="text-sm font-medium text-foreground">Add</Text>
              </Pressable>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection
          title="AI parsing (optional)"
          description="Use your own OpenRouter key to turn messy notes into workouts.">
          <View className="gap-4">
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">OpenRouter API key</Text>
              <View className="flex-row flex-wrap items-center gap-2">
                <TextInput
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="sk-or-…"
                  placeholderTextColor={brand.mutedForeground}
                  accessibilityLabel="OpenRouter API key"
                  value={settings.aiApiKey ?? ''}
                  onChangeText={(text) =>
                    void save({ aiApiKey: text.trim() || undefined })
                  }
                />
                {settings.aiApiKey ? (
                  <Pressable
                    className="rounded-lg px-3 py-2.5 active:opacity-80"
                    onPress={() => void save({ aiApiKey: undefined })}>
                    <Text className="text-sm font-medium text-muted-foreground">Clear key</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Model</Text>
              <TextInput
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="meta-llama/llama-3.3-70b-instruct:free"
                placeholderTextColor={brand.mutedForeground}
                accessibilityLabel="OpenRouter model"
                value={settings.aiModel ?? ''}
                onChangeText={(text) =>
                  void save({
                    aiModel: text.trim() || DEFAULT_SETTINGS.aiModel,
                  })
                }
              />
            </View>

            <Text className="text-sm text-muted-foreground">
              <Text
                className="text-highlight"
                onPress={() => void WebBrowser.openBrowserAsync('https://openrouter.ai/keys')}>
                Get a free key at openrouter.ai/keys
              </Text>
              . Your key stays on this device and is only sent to OpenRouter when you use AI
              parse. It is never included in exported backups.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection
          title="Backup & restore"
          description="Data lives only on this device — export to back up or move to another device.">
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 active:opacity-80"
                onPress={() => void handleExport()}
                disabled={exporting}>
                {exporting ? (
                  <ActivityIndicator color={brand.highlight} size="small" />
                ) : (
                  <Ionicons name="download-outline" size={18} color={brand.highlight} />
                )}
                <Text className="text-sm font-medium text-foreground">
                  {exporting ? 'Exporting…' : 'Export data'}
                </Text>
              </Pressable>

              <Pressable
                className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 active:opacity-80"
                onPress={() => setShowImport((v) => !v)}>
                <Ionicons name="cloud-upload-outline" size={18} color={brand.highlight} />
                <Text className="text-sm font-medium text-foreground">Import data</Text>
              </Pressable>
            </View>

            {exportFallbackJson ? (
              <View className="gap-2">
                <Text className="text-xs text-muted-foreground">
                  Share unavailable — copy this backup JSON:
                </Text>
                <TextInput
                  className="min-h-32 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground"
                  multiline
                  textAlignVertical="top"
                  value={exportFallbackJson}
                  editable={false}
                  selectTextOnFocus
                />
              </View>
            ) : null}

            {showImport ? (
              <View className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  Paste a RepLog backup JSON file:
                </Text>
                <TextInput
                  className="min-h-32 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground"
                  multiline
                  textAlignVertical="top"
                  placeholder="Paste backup JSON…"
                  placeholderTextColor={brand.mutedForeground}
                  value={importText}
                  onChangeText={setImportText}
                  editable={!importing}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-highlight py-3 active:opacity-80"
                  onPress={() => void handleImport()}
                  disabled={importing}>
                  {importing ? (
                    <ActivityIndicator color={brand.highlightForeground} size="small" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color={brand.highlightForeground} />
                  )}
                  <Text className="text-base font-semibold text-highlight-foreground">
                    {importing ? 'Importing…' : 'Restore backup'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </SettingsSection>

        <Text className="text-center text-xs text-muted-foreground">
          RepLog — all workout data stays on this device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </Text>
        {description ? (
          <Text className="max-w-prose text-sm text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            className={`rounded-md ${compact ? 'px-3 py-1.5' : 'flex-1 px-3 py-2'} ${
              selected ? 'bg-highlight' : ''
            }`}
            onPress={() => onChange(opt.value)}>
            <Text
              className={`text-center text-sm font-medium ${
                selected ? 'text-highlight-foreground' : 'text-muted-foreground'
              }`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}