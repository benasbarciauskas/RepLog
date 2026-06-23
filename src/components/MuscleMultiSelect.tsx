import { MUSCLE_OPTIONS, muscleLabel } from '@/features/review/constants';
import { cn } from '@/lib/utils';
import type { MuscleGroup } from '@/types/models';

export interface MuscleMultiSelectProps {
  value: MuscleGroup[];
  onChange: (muscles: MuscleGroup[]) => void;
  /** Muscles hidden from the chip list (e.g. already chosen as primary). */
  exclude?: MuscleGroup[];
  label?: string;
  'aria-label'?: string;
}

/** Toggle chips for the 16 muscle groups — no deps, Pressable-style buttons. */
export function MuscleMultiSelect({
  value,
  onChange,
  exclude = [],
  label,
  'aria-label': ariaLabel,
}: MuscleMultiSelectProps) {
  const excluded = new Set(exclude);
  const options = MUSCLE_OPTIONS.filter((m) => !excluded.has(m));

  function toggle(m: MuscleGroup) {
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  }

  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={ariaLabel ?? label ?? 'Select muscles'}
      >
        {options.map((m) => {
          const active = value.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-highlight bg-highlight-muted text-highlight'
                  : 'border-border text-muted-foreground hover:border-highlight/40 hover:text-foreground',
              )}
            >
              {muscleLabel(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
}