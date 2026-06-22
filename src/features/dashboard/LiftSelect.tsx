import { Select } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiftSelectOption {
  value: string;
  label: string;
}

export interface LiftSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: LiftSelectOption[];
  className?: string;
}

/**
 * Compact lift picker for the PR-timeline header. Built on Radix Select so it's
 * fully keyboard- and screen-reader-accessible; styled from the design tokens to
 * match the rest of the shell (there's no shared ui/select primitive yet).
 */
export function LiftSelect({ value, onValueChange, options, className }: LiftSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger
        aria-label="Choose a lift"
        className={cn(
          'inline-flex h-8 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-xs outline-none transition-colors',
          'hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:border-highlight/40',
          'w-44',
          className,
        )}
      >
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg',
            'origin-[var(--radix-select-content-transform-origin)]',
          )}
        >
          <Select.Viewport>
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-3 text-sm outline-none',
                  'data-[highlighted]:bg-highlight-muted data-[highlighted]:text-foreground',
                  'data-[state=checked]:text-highlight',
                )}
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="size-4" strokeWidth={2} />
                </Select.ItemIndicator>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
