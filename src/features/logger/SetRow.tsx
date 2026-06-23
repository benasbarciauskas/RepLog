import { Check, Flame, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { kgToLb, lbToKg } from '@/lib/units';
import type { ActiveSet, Unit } from '@/types/models';
import type { PreviousSet } from './lib';

export interface SetRowProps {
  set: ActiveSet;
  /** Working-set number, or null for a warm-up row. */
  number: number | null;
  /** Last session's matching working set, if any. */
  previous: PreviousSet | null;
  unit: Unit;
  onPatch: (patch: Partial<ActiveSet>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}

/** Round a display value to at most 2dp without trailing zeros. */
function displayNum(n: number | null, unit: Unit): string {
  if (n == null) return '';
  const v = unit === 'lb' ? kgToLb(n) : n;
  return Number(v.toFixed(2)).toString();
}

/** Parse a typed display value back into kg for storage. */
function parseToKg(raw: string, unit: Unit): number | null {
  if (raw.trim() === '') return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  return unit === 'lb' ? lbToKg(v) : v;
}

/**
 * One editable set row: warm-up toggle · set # · previous · weight · reps ·
 * RPE · done. Weights are stored in kg and shown in the user's unit. Tapping
 * the weight cell opens the plate calculator. Done rows get a subtle lime wash.
 */
export function SetRow({
  set,
  number,
  previous,
  unit,
  onPatch,
  onToggleDone,
  onRemove,
}: SetRowProps) {
  const prevLabel = previous
    ? `${displayNum(previous.weightKg, unit) || 'BW'}×${previous.reps}`
    : '—';

  return (
    <div
      className={cn(
        'grid grid-cols-[1.75rem_3.25rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem_3.75rem] items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors sm:gap-2',
        set.done && 'bg-highlight-muted',
      )}
    >
      {/* Set # / warm-up marker */}
      <button
        type="button"
        onClick={() => onPatch({ isWarmup: !set.isWarmup })}
        aria-label={set.isWarmup ? 'Mark as working set' : 'Mark as warm-up'}
        title={set.isWarmup ? 'Warm-up (tap to make working)' : 'Tap to mark warm-up'}
        className={cn(
          'tnum flex size-7 items-center justify-center rounded-md text-sm font-semibold transition-colors',
          set.isWarmup
            ? 'bg-warn/15 text-warn'
            : 'text-muted-foreground hover:bg-surface-elevated',
        )}
      >
        {set.isWarmup ? <Flame className="size-3.5" strokeWidth={2} /> : number}
      </button>

      {/* Previous */}
      <button
        type="button"
        disabled={!previous}
        onClick={() =>
          previous && onPatch({ weightKg: previous.weightKg, reps: previous.reps })
        }
        title={previous ? 'Tap to prefill last time' : undefined}
        className={cn(
          'tnum truncate text-left text-xs text-muted-foreground',
          previous && 'hover:text-foreground',
        )}
      >
        {prevLabel}
      </button>

      {/* Weight */}
      <Input
        inputMode="decimal"
        type="number"
        step="any"
        aria-label="Weight"
        placeholder={previous ? displayNum(previous.weightKg, unit) : '0'}
        value={displayNum(set.weightKg, unit)}
        onChange={(e) => onPatch({ weightKg: parseToKg(e.target.value, unit) })}
        className="h-9 px-2 text-center tnum [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {/* Reps */}
      <Input
        inputMode="numeric"
        type="number"
        step="1"
        aria-label="Reps"
        placeholder={previous ? String(previous.reps) : '0'}
        value={set.reps ?? ''}
        onChange={(e) =>
          onPatch({ reps: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))) })
        }
        className="h-9 px-2 text-center tnum [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {/* RPE (optional) */}
      <Input
        inputMode="decimal"
        type="number"
        step="0.5"
        min="6"
        max="10"
        aria-label="RPE"
        placeholder="RPE"
        value={set.rpe ?? ''}
        onChange={(e) => onPatch({ rpe: e.target.value === '' ? null : Number(e.target.value) })}
        className="h-9 px-1 text-center tnum text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {/* Done + remove (remove appears on row hover/focus-within) */}
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant={set.done ? 'default' : 'outline'}
          size="icon-sm"
          onClick={() => {
            // Confirming a set with blank fields auto-fills last time's numbers
            // (the placeholder values), so a same-as-last-time set is one tap.
            if (!set.done) {
              const patch: Partial<ActiveSet> = {};
              if (set.weightKg == null && previous?.weightKg != null) patch.weightKg = previous.weightKg;
              if (set.reps == null && previous?.reps != null) patch.reps = previous.reps;
              if (Object.keys(patch).length > 0) onPatch(patch);
            }
            onToggleDone();
          }}
          aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
          aria-pressed={set.done}
          className={cn(
            'transition-transform active:scale-95',
            set.done && 'bg-highlight text-highlight-foreground hover:bg-highlight/90',
          )}
        >
          <Check className="size-4" strokeWidth={2.5} />
        </Button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove set"
          className="hidden text-muted-foreground hover:text-destructive group-hover/row:block"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
