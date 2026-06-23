import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, PRIMARY_ACTION_TO } from './nav-items';

function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="RepLog logo" className="size-8 rounded-lg" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Rep<span className="text-highlight">Log</span>
      </span>
    </div>
  );
}

/** Desktop left sidebar. Hidden below `md`. Shows the full nav (all routes). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-sm md:flex">
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

/**
 * Mobile bottom tab bar. Hidden at `md` and up.
 *
 * Layout: the primary tabs surround a prominent centred "Log" action (the core
 * v1.1 flow), and a "More" button opens an overflow sheet for the remaining
 * (non-primary) routes — so adding routes never crowds the bar.
 */
export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Close the overflow whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const primaryAction = NAV_ITEMS.find((i) => i.to === PRIMARY_ACTION_TO);
  // Other primary tabs (everything except the centred action), in two flanks.
  const tabs = NAV_ITEMS.filter((i) => i.primary && i.to !== PRIMARY_ACTION_TO);
  const left = tabs.slice(0, Math.ceil(tabs.length / 2));
  const right = tabs.slice(Math.ceil(tabs.length / 2));
  const overflow = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <>
      {moreOpen ? (
        <MoreSheet items={overflow} onClose={() => setMoreOpen(false)} />
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/80 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {left.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          {primaryAction ? <CenterAction item={primaryAction} /> : null}

          {right.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          {overflow.length > 0 ? (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                moreOpen ? 'text-highlight' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full transition-colors',
                  moreOpen && 'bg-highlight-muted',
                )}
              >
                <MoreHorizontal className="size-5" strokeWidth={2} aria-hidden />
              </span>
              More
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}

function TabLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
          isActive ? 'text-highlight' : 'text-muted-foreground hover:text-foreground',
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
  );
}

/** The prominent, raised centre action (the core "Log" flow). */
function CenterAction({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-foreground"
      aria-label={label}
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex size-12 -translate-y-3 items-center justify-center rounded-full shadow-lg ring-4 ring-background transition-transform',
              isActive
                ? 'bg-highlight text-highlight-foreground'
                : 'bg-highlight text-highlight-foreground',
            )}
          >
            <Icon className="size-6" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="-mt-2">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Bottom overflow sheet listing the non-primary routes. */
function MoreSheet({
  items,
  onClose,
}: {
  items: (typeof NAV_ITEMS)[number][];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="More navigation">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface/95 px-4 pb-8 pt-3 shadow-2xl backdrop-blur-md"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            More
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-highlight/40 bg-highlight-muted text-highlight'
                    : 'border-border bg-surface text-foreground hover:bg-surface-elevated',
                )
              }
            >
              <Icon className="size-4.5" strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mobile top bar carrying the wordmark (sidebar covers desktop). */
export function MobileTopBar() {
  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-surface/80 px-4 backdrop-blur-md md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Wordmark />
    </header>
  );
}
