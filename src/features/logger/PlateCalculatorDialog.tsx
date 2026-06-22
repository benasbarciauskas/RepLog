import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWeight } from '@/lib/units';
import type { AppSettings } from '@/types/models';
import { platesForWeight, platesRemainder, type PlateStack } from './lib';

export interface PlateCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target total weight (kg) — bar + both sides. `null` if unset. */
  totalKg: number | null;
  settings: AppSettings;
}

// Plate visual sizing: taller bars for heavier plates, within a clamped range.
function plateHeight(plate: number, maxPlate: number): number {
  const min = 28;
  const max = 72;
  if (maxPlate <= 0) return min;
  return Math.round(min + (max - min) * (plate / maxPlate));
}

/**
 * Plate calculator: shows the plates to load PER SIDE for the target weight,
 * largest-first, as a visual stack. Surfaces a remainder when the weight isn't
 * reachable with the configured plates.
 */
export function PlateCalculatorDialog({
  open,
  onOpenChange,
  totalKg,
  settings,
}: PlateCalculatorDialogProps) {
  const stacks: PlateStack[] = useMemo(
    () =>
      totalKg == null ? [] : platesForWeight(totalKg, settings.barWeightKg, settings.availablePlatesKg),
    [totalKg, settings.barWeightKg, settings.availablePlatesKg],
  );
  const remainder = useMemo(
    () => (totalKg == null ? 0 : platesRemainder(totalKg, settings.barWeightKg, settings.availablePlatesKg)),
    [totalKg, settings.barWeightKg, settings.availablePlatesKg],
  );

  const maxPlate = Math.max(0, ...settings.availablePlatesKg);
  const belowBar = totalKg != null && totalKg <= settings.barWeightKg;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Plate calculator
            {totalKg != null ? (
              <span className="ml-2 tnum text-base font-normal text-muted-foreground">
                {formatWeight(totalKg, settings.unit)}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Per side · {formatWeight(settings.barWeightKg, settings.unit)} bar
          </DialogDescription>
        </DialogHeader>

        {totalKg == null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Enter a weight to see the plate breakdown.
          </p>
        ) : belowBar ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            That's at or below the empty bar — no plates needed.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Visual bar + plate stack (one side). */}
            <div
              className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface/40 px-4 py-8"
              aria-hidden
            >
              {/* sleeve */}
              <div className="h-2 w-8 rounded-l-sm bg-muted-foreground/40" />
              {stacks.length === 0 ? (
                <span className="px-3 text-xs text-muted-foreground">Bar only</span>
              ) : (
                stacks.flatMap((s) =>
                  Array.from({ length: s.count }, (_, i) => (
                    <div
                      key={`${s.plate}-${i}`}
                      className="flex w-7 items-center justify-center rounded-sm bg-highlight/80 text-[10px] font-semibold text-highlight-foreground"
                      style={{ height: `${plateHeight(s.plate, maxPlate)}px` }}
                    >
                      {trimPlate(s.plate)}
                    </div>
                  )),
                )
              )}
            </div>

            {/* Per-side breakdown list. */}
            <ul className="space-y-1.5">
              {stacks.length === 0 ? (
                <li className="text-center text-sm text-muted-foreground">
                  No plates — just the empty bar.
                </li>
              ) : (
                stacks.map((s) => (
                  <li
                    key={s.plate}
                    className="flex items-center justify-between rounded-lg bg-surface/40 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{formatWeight(s.plate, settings.unit)} plate</span>
                    <span className="tnum font-semibold text-foreground">× {s.count}</span>
                  </li>
                ))
              )}
            </ul>

            {remainder > 0 ? (
              <p className="rounded-lg bg-warn/10 px-3 py-2 text-center text-xs text-warn">
                {formatWeight(remainder, settings.unit)} per side can't be made with your plates.
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function trimPlate(n: number): string {
  return Number(n.toFixed(2)).toString();
}
