import { Loader2 } from 'lucide-react';

/**
 * On-brand fallback while a lazily-loaded route chunk downloads. Centered lime
 * spinner with a hint line. Movement is opacity/spin only, so it degrades
 * gracefully under reduced motion (the CSS backstop in index.css slows the
 * spin to a near-stop). Kept deliberately quiet — route chunks are small and
 * usually resolve in a frame or two.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-highlight" strokeWidth={1.75} aria-hidden />
      <span className="text-sm">Loading…</span>
    </div>
  );
}
