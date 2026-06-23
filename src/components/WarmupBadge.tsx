import { cn } from '@/lib/utils';

export interface WarmupBadgeProps {
  /** Badge edge size; mirrors the logo mark. Defaults to `size-5`. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The warm-up marker shown against warm-up sets in History. A small acid-lime
 * rounded square with a bold "W", echoing the RepLog logo mark (`bg-highlight`
 * + `text-highlight-foreground`, rounded). Decorative-but-meaningful, so it
 * carries an accessible label for screen readers.
 */
export function WarmupBadge({ size = 'md', className }: WarmupBadgeProps) {
  return (
    <span
      role="img"
      aria-label="Warm-up set"
      title="Warm-up set"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-md bg-highlight font-bold leading-none text-highlight-foreground',
        size === 'sm' ? 'size-4 text-[10px]' : 'size-5 text-xs',
        className,
      )}
    >
      W
    </span>
  );
}
