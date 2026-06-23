import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MuscleMultiSelect } from '@/components/MuscleMultiSelect';
import { createCatalog } from '@/parser/catalog';
import { db } from '@/data/db';
import { repository } from '@/data/repository';
import { cn } from '@/lib/utils';
import type { ExerciseCategory, ExerciseDef, MovementPattern, MuscleGroup } from '@/types/models';
import {
  CUSTOM_CATEGORY_OPTIONS,
  CUSTOM_PATTERN_OPTIONS,
  buildCustomExerciseDef,
  humanToken,
  inferCategoryFromMuscles,
} from './customExercise';

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

/**
 * Catalog of built-ins plus the user's persisted custom exercises (live). New
 * custom exercises are reusable: once added they show up in every future search.
 */
function useCatalog() {
  const custom = useLiveQuery(() => db.customExercises.toArray(), [], []);
  return useMemo(() => createCatalog(custom), [custom]);
}

function humanCategory(c: ExerciseDef['category']): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

interface CustomExerciseCreateFormProps {
  name: string;
  onBack: () => void;
  onCreated: (pick: ExercisePick) => void;
}

/**
 * Second step after "Add …" — tag muscles (required), optional category/pattern/
 * secondary. Category defaults from primary muscles; pattern defaults to isolation.
 */
function CustomExerciseCreateForm({ name, onBack, onCreated }: CustomExerciseCreateFormProps) {
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleGroup[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [category, setCategory] = useState<ExerciseCategory>('push');
  const [pattern, setPattern] = useState<MovementPattern>('isolation');
  const [categoryTouched, setCategoryTouched] = useState(false);

  useEffect(() => {
    if (!categoryTouched && primaryMuscles.length > 0) {
      setCategory(inferCategoryFromMuscles(primaryMuscles));
    }
  }, [primaryMuscles, categoryTouched]);

  useEffect(() => {
    setSecondaryMuscles((prev) => prev.filter((m) => !primaryMuscles.includes(m)));
  }, [primaryMuscles]);

  async function submit() {
    if (primaryMuscles.length === 0) return;
    const def = buildCustomExerciseDef({
      canonicalName: name,
      category,
      pattern,
      primaryMuscles,
      secondaryMuscles,
    });
    await repository.addCustomExercise(def);
    onCreated({ exerciseId: def.id, rawName: def.canonicalName });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 overflow-y-auto px-6 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
          Back to search
        </button>

        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">Tag muscles so volume insights count this lift.</p>
        </div>

        <MuscleMultiSelect
          label="Primary muscles"
          aria-label="Primary muscles"
          value={primaryMuscles}
          onChange={setPrimaryMuscles}
        />

        <details className="group rounded-lg border border-border bg-surface/30 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">More options (category, pattern, secondary)</span>
            <span className="hidden group-open:inline">More options</span>
          </summary>
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-category" className="text-xs">
                  Category
                </Label>
                <select
                  id="custom-category"
                  value={category}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    setCategory(e.target.value as ExerciseCategory);
                  }}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  {CUSTOM_CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {humanToken(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-pattern" className="text-xs">
                  Movement pattern
                </Label>
                <select
                  id="custom-pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value as MovementPattern)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  {CUSTOM_PATTERN_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {humanToken(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <MuscleMultiSelect
              label="Secondary muscles"
              aria-label="Secondary muscles"
              value={secondaryMuscles}
              onChange={setSecondaryMuscles}
              exclude={primaryMuscles}
            />
          </div>
        </details>
      </div>

      <DialogFooter className="border-t border-border px-6 py-4">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={primaryMuscles.length === 0}>
          <Plus aria-hidden />
          Add exercise
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Catalog-search dialog for adding an exercise. Exact + fuzzy match via
 * `createCatalog()`. Uncatalogued names are allowed (`unknown:<slug>`), matching
 * the v1 convention, so the user can log anything.
 */
export function ExerciseSearchDialog({ open, onOpenChange, onPick }: ExerciseSearchDialogProps) {
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [createName, setCreateName] = useState<string | null>(null);

  const results = useMemo(() => {
    const all = catalog.all();
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...all].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
    }
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
  const canCreateCustom =
    trimmed.length > 0 &&
    !results.some((d) => d.canonicalName.toLowerCase() === trimmed.toLowerCase());

  function reset() {
    setQuery('');
    setCreateName(null);
  }

  function pick(p: ExercisePick) {
    onPick(p);
    reset();
    onOpenChange(false);
  }

  function closeDialog(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {createName ? (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Custom exercise</DialogTitle>
              <DialogDescription>Tag the muscles this lift trains.</DialogDescription>
            </DialogHeader>
            <CustomExerciseCreateForm
              name={createName}
              onBack={() => setCreateName(null)}
              onCreated={pick}
            />
          </>
        ) : (
          <>
            <DialogHeader className="gap-3 px-6 pt-6">
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
                    onClick={() => setCreateName(trimmed)}
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
                      <span className="block text-xs text-muted-foreground">Custom exercise — tag muscles</span>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}