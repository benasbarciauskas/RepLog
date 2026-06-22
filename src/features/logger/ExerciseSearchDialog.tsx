import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createCatalog } from '@/parser/catalog';
import { newId } from '@/lib/id';
import { cn } from '@/lib/utils';
import type { ExerciseDef } from '@/types/models';

export interface ExercisePick {
  exerciseId: string;
  rawName: string;
}

export interface ExerciseSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user picks (or creates) an exercise. */
  onPick: (pick: ExercisePick) => void;
}

/** Build the catalog once per mount — it's pure and built-in only. */
function useCatalog() {
  return useMemo(() => createCatalog(), []);
}

function humanCategory(c: ExerciseDef['category']): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Catalog-search dialog for adding an exercise. Exact + fuzzy match via
 * `createCatalog()`. Uncatalogued names are allowed (`unknown:<slug>`), matching
 * the v1 convention, so the user can log anything.
 */
export function ExerciseSearchDialog({ open, onOpenChange, onPick }: ExerciseSearchDialogProps) {
  const catalog = useCatalog();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const all = catalog.all();
    const q = query.trim().toLowerCase();
    if (!q) {
      // No query → a sensible alphabetical browse of the whole catalog.
      return [...all].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    }
    // Rank: name/alias substring hits first, then everything else.
    const scored = all
      .map((d) => {
        const name = d.canonicalName.toLowerCase();
        const aliasHit = d.aliases.some((al) => al.includes(q));
        let score = 3;
        if (name.startsWith(q)) score = 0;
        else if (name.includes(q)) score = 1;
        else if (aliasHit) score = 2;
        return { d, score };
      })
      .filter((x) => x.score < 3);
    scored.sort((a, b) => a.score - b.score || a.d.canonicalName.localeCompare(b.d.canonicalName));
    return scored.map((x) => x.d);
  }, [catalog, query]);

  const trimmed = query.trim();
  // Offer "add as custom" when the typed name doesn't already exist exactly.
  const canCreateCustom =
    trimmed.length > 0 &&
    !results.some((d) => d.canonicalName.toLowerCase() === trimmed.toLowerCase());

  function pick(p: ExercisePick) {
    onPick(p);
    setQuery('');
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery('');
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[80vh] gap-3 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add exercise</DialogTitle>
          <DialogDescription>Search the catalog, or type a name to add your own.</DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bench press, squat, curl…"
              className="pl-9"
              aria-label="Search exercises"
            />
          </div>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto px-3 pb-3" role="listbox" aria-label="Exercise results">
          {canCreateCustom ? (
            <li>
              <button
                type="button"
                onClick={() =>
                  pick({ exerciseId: `unknown:${slugify(trimmed)}`, rawName: trimmed })
                }
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  'hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight-muted text-highlight">
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    Add “{trimmed}”
                  </span>
                  <span className="block text-xs text-muted-foreground">Custom exercise</span>
                </span>
              </button>
            </li>
          ) : null}

          {results.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => pick({ exerciseId: d.id, rawName: d.canonicalName })}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  'hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none',
                )}
              >
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {d.canonicalName}
                </span>
                <Badge variant="outline" className="shrink-0">
                  {humanCategory(d.category)}
                </Badge>
              </button>
            </li>
          ))}

          {results.length === 0 && !canCreateCustom ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches. Keep typing to add a custom exercise.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || newId(6);
}
