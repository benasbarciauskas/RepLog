import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileDown, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/features/exercise/SegmentedControl';
import { useSettings } from '@/data/hooks';
import { DEFAULT_SETTINGS, repository } from '@/data/repository';
import { workoutsToCsv } from '@/data/csv';
import { formatWeight } from '@/lib/units';
import type { AppSettings, Unit } from '@/types/models';
import { BETA_AVAILABLE, CHANNEL_URLS, type Channel, detectChannel } from './channel';

// --- Plate presets -----------------------------------------------------------

const PLATE_PRESETS: { label: string; unit: Unit; plates: number[] }[] = [
  { label: 'Metric (kg)', unit: 'kg', plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  // Imperial pounds expressed in kg (stored canonically as kg).
  { label: 'Imperial (lb)', unit: 'lb', plates: [45, 35, 25, 10, 5, 2.5].map((lb) => lb / 2.2046226218487757) },
];

const REST_PRESETS = [60, 90, 120, 180];

export default function SettingsPage() {
  const settings = useSettings();
  const channel = useMemo(() => detectChannel(import.meta.env.BASE_URL), []);

  // Local draft for the "add a plate" input.
  const [newPlate, setNewPlate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  function save(patch: Partial<AppSettings>) {
    void repository.saveSettings({ ...settings, ...patch });
  }

  function addPlate() {
    const value = Number(newPlate);
    if (!Number.isFinite(value) || value <= 0) return;
    if (settings.availablePlatesKg.includes(value)) {
      setNewPlate('');
      return;
    }
    const next = [...settings.availablePlatesKg, value].sort((a, b) => b - a);
    save({ availablePlatesKg: next });
    setNewPlate('');
  }

  function removePlate(plate: number) {
    save({ availablePlatesKg: settings.availablePlatesKg.filter((p) => p !== plate) });
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await repository.exportData();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `replog-backup-${date}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export data');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const workouts = await repository.getWorkouts();
      const csv = workoutsToCsv(workouts, settings.unit);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `replog-export-${date}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      const setCount = workouts.reduce(
        (acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0),
        0,
      );
      toast.success(`Exported ${setCount} sets to CSV`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export CSV');
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await repository.importData(text);
      toast.success('Data imported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import backup');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Tune the logger to your gym — units, rest, and the bar and plates you load."
      />

      <div className="space-y-10">
        {/* Units */}
        <SettingsSection
          title="Units"
          description="How weights are displayed across the app. Stored values stay in kilograms."
        >
          <SegmentedControl
            ariaLabel="Display unit"
            options={[
              { value: 'kg', label: 'Kilograms (kg)' },
              { value: 'lb', label: 'Pounds (lb)' },
            ]}
            value={settings.unit}
            onChange={(unit: Unit) => save({ unit })}
          />
        </SettingsSection>

        {/* Default rest */}
        <SettingsSection
          title="Default rest"
          description="The rest timer's starting length between sets. You can still adjust it per exercise."
        >
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              size="compact"
              scroll
              ariaLabel="Default rest preset"
              options={REST_PRESETS.map((s) => ({ value: String(s), label: formatRest(s) }))}
              value={REST_PRESETS.includes(settings.defaultRestSeconds)
                ? String(settings.defaultRestSeconds)
                : ''}
              onChange={(v: string) => save({ defaultRestSeconds: Number(v) })}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                aria-label="Default rest in seconds"
                className="tnum w-24"
                value={settings.defaultRestSeconds}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0) save({ defaultRestSeconds: n });
                }}
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </div>
        </SettingsSection>

        {/* Bar weight */}
        <SettingsSection
          title="Bar weight"
          description="The empty bar, used by the plate calculator. Stored in kilograms."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              aria-label="Bar weight in kilograms"
              className="tnum w-24"
              value={settings.barWeightKg}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) save({ barWeightKg: n });
              }}
            />
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
        </SettingsSection>

        {/* Available plates */}
        <SettingsSection
          title="Available plates"
          description="The plates you have, per side. The calculator only loads these."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" aria-label="Available plates">
              {settings.availablePlatesKg.length === 0 ? (
                <p className="text-sm text-muted-foreground">No plates yet — add one below.</p>
              ) : (
                [...settings.availablePlatesKg]
                  .sort((a, b) => b - a)
                  .map((plate) => (
                    <span
                      key={plate}
                      className="tnum group inline-flex items-center gap-1.5 rounded-md border border-border bg-surface py-1 pl-2.5 pr-1.5 text-sm font-medium text-foreground"
                    >
                      {formatWeight(plate, settings.unit)}
                      <button
                        type="button"
                        onClick={() => removePlate(plate)}
                        aria-label={`Remove ${formatWeight(plate, settings.unit)} plate`}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
                      >
                        <X className="size-3.5" strokeWidth={2} aria-hidden />
                      </button>
                    </span>
                  ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                placeholder="Add a plate (kg)"
                aria-label="New plate weight in kilograms"
                className="tnum w-44"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlate();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addPlate}>
                <Plus className="size-4" strokeWidth={2} />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {PLATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    save({ availablePlatesKg: [...preset.plates].sort((a, b) => b - a) })
                  }
                >
                  Use {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* AI parsing */}
        <SettingsSection
          title="AI parsing (optional)"
          description="Use your own free OpenRouter key to turn messy notes into workouts. Everything stays on-device until you use AI parse — then the note text is sent to OpenRouter."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ai-api-key" className="text-sm font-medium text-foreground">
                OpenRouter API key
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="ai-api-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-or-…"
                  aria-label="OpenRouter API key"
                  className="max-w-md"
                  value={settings.aiApiKey ?? ''}
                  onChange={(e) => save({ aiApiKey: e.target.value.trim() || undefined })}
                />
                {settings.aiApiKey ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => save({ aiApiKey: undefined })}
                  >
                    Clear key
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ai-model" className="text-sm font-medium text-foreground">
                Model
              </label>
              <Input
                id="ai-model"
                type="text"
                placeholder="meta-llama/llama-3.3-70b-instruct:free"
                aria-label="OpenRouter model"
                className="max-w-md"
                value={settings.aiModel ?? ''}
                onChange={(e) =>
                  save({
                    aiModel: e.target.value.trim() || DEFAULT_SETTINGS.aiModel,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ai-vision-model" className="text-sm font-medium text-foreground">
                AI vision model
              </label>
              <Input
                id="ai-vision-model"
                type="text"
                placeholder="meta-llama/llama-3.2-11b-vision-instruct:free"
                aria-label="OpenRouter vision model"
                className="max-w-md"
                value={settings.aiVisionModel ?? ''}
                onChange={(e) =>
                  save({
                    aiVisionModel: e.target.value.trim() || DEFAULT_SETTINGS.aiVisionModel,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Used for &apos;Read with AI&apos; on screenshots — must support images.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-highlight underline-offset-2 hover:underline"
              >
                Get a free key
              </a>
              {' — '}
              free models are listed at{' '}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="text-highlight underline-offset-2 hover:underline"
              >
                openrouter.ai/models
              </a>{' '}
              (filter Free).
            </p>

            <p className="text-xs text-muted-foreground">
              Your key stays on this device and is only sent as the Authorization header on AI-parse
              requests. It is never included in exported backups.
            </p>
          </div>
        </SettingsSection>

        {/* Release channel */}
        <SettingsSection
          title="Release channel"
          description={
            BETA_AVAILABLE
              ? 'Stable is the live release. Beta is the preview build — the latest, from the beta branch.'
              : 'Stable is the live release. A beta preview channel is coming soon.'
          }
        >
          <ChannelControl channel={channel} />
        </SettingsSection>

        {/* Backup & restore */}
        <SettingsSection
          title="Backup & restore"
          description="Data is stored only in this browser — export to back up or move it to another device."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="size-4" strokeWidth={2} aria-hidden />
              {exporting ? 'Exporting…' : 'Export data'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv}
            >
              <FileDown className="size-4" strokeWidth={2} aria-hidden />
              {exportingCsv ? 'Exporting…' : 'Export CSV'}
            </Button>
            <div className="relative">
              <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                <Upload className="size-4" strokeWidth={2} aria-hidden />
                Import data
              </Button>
              <input
                type="file"
                accept="application/json"
                aria-label="Import backup file"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={handleImport}
              />
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function BetaComingSoonNote() {
  return <p className="text-sm text-muted-foreground">Beta channel coming soon.</p>;
}

function ChannelControl({ channel }: { channel: Channel }) {
  // Local build: show hosted links without forcing a selection.
  if (channel === 'local') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You're on a local build. Open a hosted channel:
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={CHANNEL_URLS.stable}>
              Stable
              <ExternalLink className="size-3.5" strokeWidth={2} />
            </a>
          </Button>
          {BETA_AVAILABLE ? (
            <Button asChild variant="outline" size="sm">
              <a href={CHANNEL_URLS.beta}>
                Beta
                <ExternalLink className="size-3.5" strokeWidth={2} />
              </a>
            </Button>
          ) : null}
        </div>
        {!BETA_AVAILABLE ? <BetaComingSoonNote /> : null}
      </div>
    );
  }

  // Beta build while the hosted beta URL is unpublished: keep channel detection,
  // but only allow switching back to Stable.
  if (!BETA_AVAILABLE && channel === 'beta') {
    return (
      <SegmentedControl
        ariaLabel="Release channel"
        options={[
          { value: 'stable', label: 'Stable' },
          { value: 'beta', label: 'Beta' },
        ]}
        value={channel}
        onChange={(next: Channel) => {
          if (next === 'stable') window.location.assign(CHANNEL_URLS.stable);
        }}
      />
    );
  }

  // Hosted stable while beta is unpublished: read-only Stable, no navigation to beta.
  if (!BETA_AVAILABLE) {
    return (
      <div className="space-y-2">
        <div
          role="group"
          aria-label="Release channel"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
        >
          <span className="rounded-md bg-highlight px-3 py-1.5 text-sm font-medium text-highlight-foreground">
            Stable
          </span>
        </div>
        <BetaComingSoonNote />
      </div>
    );
  }

  // Hosted: a Stable/Beta toggle. Selecting the other channel navigates there.
  return (
    <SegmentedControl
      ariaLabel="Release channel"
      options={[
        { value: 'stable', label: 'Stable' },
        { value: 'beta', label: 'Beta' },
      ]}
      value={channel}
      onChange={(next: Channel) => {
        if (next === channel) return;
        const url = next === 'beta' ? CHANNEL_URLS.beta : CHANNEL_URLS.stable;
        window.location.assign(url);
      }}
    />
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
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Compact rest-duration label, e.g. 90 → "1:30", 120 → "2:00". */
function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
