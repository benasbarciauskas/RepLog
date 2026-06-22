import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Lucide icon component rendered in the badge. */
  icon?: ComponentType<LucideProps>;
  /** Headline — what's empty / what to do. */
  title: string;
  /** Supporting copy explaining how to populate this view. */
  description?: string;
  /** Primary call-to-action (e.g. a Button or Link). */
  action?: ReactNode;
  className?: string;
}

/**
 * Composed empty state: framed icon, title, description, and an optional CTA.
 * Used for first-run views and "not enough data yet" cases across the app.
 * No card chrome — it breathes in plain layout, centered.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-highlight-muted text-highlight">
          <Icon className="size-6" strokeWidth={1.75} aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
