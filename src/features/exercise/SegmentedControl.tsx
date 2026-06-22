import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible group label (visually hidden). */
  ariaLabel: string;
  /** `compact` = small pills (range selector); `full` = even-width tabs (metric toggle). */
  size?: 'compact' | 'full';
  className?: string;
}

/**
 * A small segmented control (Strong-style metric toggle / range selector). No
 * motion — selection is a colour swap, which is high-frequency and instant by
 * design (animating a control tapped repeatedly would feel sluggish; see the
 * design system's "don't animate high-frequency actions").
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'full',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1',
        size === 'full' && 'w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              size === 'compact' ? 'px-2.5 py-1 text-xs' : 'flex-1 px-3 py-1.5 text-sm',
              active
                ? 'bg-highlight text-highlight-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
