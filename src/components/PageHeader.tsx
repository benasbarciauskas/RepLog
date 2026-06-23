import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Optional small uppercase label above the title (use sparingly). */
  eyebrow?: string;
  /** The page title — the dominant element. */
  title: string;
  /** Optional one-line supporting description. */
  description?: string;
  /** Optional trailing slot for actions (buttons, filters). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Consistent page heading: eyebrow + title + description on the left, an
 * optional actions slot on the right. Stacks on mobile, row on desktop.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-highlight">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
