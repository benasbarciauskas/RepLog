import { NavLink } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
        <Dumbbell className="size-5" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Rep<span className="text-highlight">Log</span>
      </span>
    </div>
  );
}

/** Desktop left sidebar. Hidden below `md`. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-sm md:flex">
      <NavLink to="/" className="mb-8 px-2" aria-label="RepLog home">
        <Wordmark />
      </NavLink>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-highlight-muted text-highlight'
                  : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 h-5 w-0.5 rounded-full bg-highlight transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className="size-4.5" strokeWidth={2} aria-hidden />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <p className="px-3 text-xs text-muted-foreground">
        On-device. Your data never leaves this browser.
      </p>
    </aside>
  );
}

/** Mobile bottom tab bar. Hidden at `md` and up. */
export function BottomNav() {
  const items = NAV_ITEMS.filter((i) => i.primary);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/80 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-highlight'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-highlight-muted',
                  )}
                >
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Mobile top bar carrying the wordmark (sidebar covers desktop). */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-surface/80 px-4 backdrop-blur-md md:hidden">
      <Wordmark />
    </header>
  );
}
