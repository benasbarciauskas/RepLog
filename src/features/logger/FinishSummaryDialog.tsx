import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatWeight, kgToLb, lbToKg } from '@/lib/units';
import type { AppSettings, SplitCanonical } from '@/types/models';
import type { LoggerSession } from './useLogger';
import { summarizeSession } from './lib';

const SPLITS: { value: SplitCanonical; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
  { value: 'full-body', label: 'Full body' },
  { value: 'arms', label: 'Arms' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'chest-back', label: 'Chest/Back' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'unknown', label: 'Unspecified' },
];

export interface FinishSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LoggerSession;
  settings: AppSettings;
  onConfirm: (meta: { bodyweightKg?: number | null; splitCanonical?: SplitCanonical }) => void;
}

/**
 * Finish summary: working sets, total volume, and the per-workout metadata
 * (bodyweight + split) the user can confirm before the session is saved via
 * `finishActiveSession(meta)`.
 */
export function FinishSummaryDialog({
  open,
  onOpenChange,
  session,
  settings,
  onConfirm,
}: FinishSummaryDialogProps) {
  const summary = useMemo(() => summarizeSession(session), [session]);

  const initialBw = session.bodyweightKg ?? null;
  const [bwInput, setBwInput] = useState<string>(
    initialBw == null ? '' : String(Number((settings.unit === 'lb' ? kgToLb(initialBw) : initialBw).toFixed(1))),
  );
  const [split, setSplit] = useState<SplitCanonical>(session.splitCanonical ?? 'unknown');

  const nothingToSave = summary.exercises === 0;

  function confirm() {
    const bwNum = bwInput.trim() === '' ? null : Number(bwInput);
    const bodyweightKg =
      bwNum == null || !Number.isFinite(bwNum)
        ? null
        : settings.unit === 'lb'
          ? lbToKg(bwNum)
          : bwNum;
    onConfirm({ bodyweightKg, splitCanonical: split });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finish workout</DialogTitle>
          <DialogDescription>
            {nothingToSave
              ? 'No sets are marked done yet — mark at least one set done to save.'
              : 'Review your session, then save it to your history.'}
          </DialogDescription>
        </DialogHeader>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryStat label="Exercises" value={summary.exercises} />
          <SummaryStat label="Working sets" value={summary.workingSets} />
          <SummaryStat
            label="Volume"
            display={formatWeight(summary.totalVolumeKg, settings.unit)}
          />
        </div>

        {/* Metadata */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="finish-bw">Bodyweight ({settings.unit})</Label>
            <Input
              id="finish-bw"
              inputMode="decimal"
              type="number"
              step="0.1"
              placeholder="optional"
              value={bwInput}
              onChange={(e) => setBwInput(e.target.value)}
              className="tnum"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finish-split">Split</Label>
            <select
              id="finish-split"
              value={split}
              onChange={(e) => setSplit(e.target.value as SplitCanonical)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {SPLITS.map((s) => (
                <option key={s.value} value={s.value} className="bg-background text-foreground">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep going
          </Button>
          <Button onClick={confirm} disabled={nothingToSave}>
            Save workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({
  label,
  value,
  display,
}: {
  label: string;
  value?: number;
  display?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-3 text-center">
      <p className="tnum text-xl font-semibold text-foreground">{display ?? value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
