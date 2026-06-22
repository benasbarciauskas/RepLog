import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Dumbbell,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { newId } from '@/lib/id';
import { repository } from '@/data/repository';
import { createCatalog } from '@/parser';
import type {
  ExerciseDef,
  MuscleGroup,
  ParsedWorkout,
  SetEntry,
  SplitCanonical,
  Workout,
  WorkoutExercise,
} from '@/types/models';
import { REVIEW_STATE_TAG, type ReviewRouteState } from '../import/types';
import { MUSCLE_OPTIONS, SPLIT_OPTIONS, muscleLabel } from './constants';

const ENTER = { duration: 0.24, ease: [0.23, 1, 0.32, 1] as const };

// --- Draft model (local, editable copy of the parsed workouts) --------------

interface DraftSet extends SetEntry {
  key: string;
}
interface DraftExercise {
  key: string;
  exerciseId: string;
  rawName: string;
  unit: WorkoutExercise['unit'];
  sets: DraftSet[];
}
interface DraftWorkout {
  key: string;
  date: string;
  dateConfidence: 'high' | 'low';
  bodyweightKg: number | null;
  splitCanonical: SplitCanonical;
  splitRaw: string | null;
  exercises: DraftExercise[];
}

function toDraft(workouts: ParsedWorkout[]): DraftWorkout[] {
  return workouts.map((w) => ({
    key: newId(),
    date: w.date,
    dateConfidence: w.dateConfidence,
    bodyweightKg: w.bodyweightKg,
    splitCanonical: w.splitCanonical,
    splitRaw: w.splitRaw,
    exercises: w.exercises.map((e) => ({
      key: newId(),
      exerciseId: e.exerciseId,
      rawName: e.rawName,
      unit: e.unit,
      sets: e.sets.map((s) => ({ ...s, key: newId() })),
    })),
  }));
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const incoming = readReviewState(location.state);

  const [workouts, setWorkouts] = useState<DraftWorkout[]>(() =>
    toDraft(incoming?.workouts ?? []),
  );
  const [showSkipped, setShowSkipped] = useState(false);
  const [saving, setSaving] = useState(false);

  // Catalog name suggestions (built-ins + custom) for the autocomplete datalist.
  const exerciseNames = useMemo(
    () => createCatalog().all().map((d) => d.canonicalName),
    [],
  );
  const catalogIndex = useMemo(() => {
    const map = new Map<string, ExerciseDef>();
    for (const def of createCatalog().all()) map.set(def.id, def);
    return map;
  }, []);

  // Visited directly (no parsed payload) → graceful empty state.
  if (!incoming || incoming.workouts.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Step two"
          title="Review"
          description="Check the parsed workouts, fix anything off, then confirm to save."
        />
        <EmptyState
          icon={Dumbbell}
          title="Nothing to review yet"
          description="Import some notes first — screenshots, paste, or a screen recording — and they'll show up here for a quick check before saving."
          action={
            <Button onClick={() => navigate('/import')}>
              <Upload aria-hidden /> Go to Import
            </Button>
          }
        />
      </div>
    );
  }

  const updateWorkout = (key: string, patch: Partial<DraftWorkout>) =>
    setWorkouts((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)));

  const removeWorkout = (key: string) =>
    setWorkouts((prev) => prev.filter((w) => w.key !== key));

  const handleSave = async () => {
    if (saving) return;
    const missingDate = workouts.find((w) => !w.date);
    if (missingDate) {
      toast.error('Add a date', {
        description: 'Every workout needs a date before saving.',
      });
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const toSave: Workout[] = workouts.map((w) => ({
        id: newId(),
        date: w.date,
        dateConfidence: w.dateConfidence,
        bodyweightKg: w.bodyweightKg,
        splitCanonical: w.splitCanonical,
        splitRaw: w.splitRaw,
        blockId: null,
        sourceNoteId: '',
        createdAt: now,
        exercises: w.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          rawName: e.rawName,
          unit: e.unit,
          sets: e.sets.map(
            (s): SetEntry => ({
              weightKg: s.weightKg,
              reps: s.reps,
              isWarmup: s.isWarmup,
              isFailure: s.isFailure,
              raw: s.raw,
            }),
          ),
        })),
      }));

      await repository.saveWorkouts(toSave);
      toast.success(
        `Saved ${toSave.length} workout${toSave.length === 1 ? '' : 's'}`,
        { description: 'Your numbers are updated.' },
      );
      navigate('/');
    } catch (err) {
      toast.error('Could not save', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step two"
        title="Review"
        description="Fix anything the parser got wrong, then confirm. Nothing is saved until you do."
        actions={
          <motion.div whileTap={reduce || saving ? undefined : { scale: 0.97 }}>
            <Button size="lg" onClick={handleSave} disabled={saving}>
              <Save aria-hidden />
              {saving ? 'Saving…' : 'Confirm & save'}
            </Button>
          </motion.div>
        }
      />

      {/* Shared autocomplete source for every exercise-name input. */}
      <datalist id="replog-exercise-names">
        {exerciseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="space-y-6">
        {workouts.map((workout, i) => (
          <motion.div
            key={workout.key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ENTER, delay: reduce ? 0 : Math.min(i * 0.05, 0.2) }}
          >
            <WorkoutCard
              workout={workout}
              catalogIndex={catalogIndex}
              onChange={(patch) => updateWorkout(workout.key, patch)}
              onRemove={() => removeWorkout(workout.key)}
              onAddedToCatalog={(def) =>
                // Re-point any exercise that matches this newly catalogued name.
                updateWorkout(workout.key, {
                  exercises: workout.exercises.map((e) =>
                    normalize(e.rawName) === normalize(def.canonicalName)
                      ? { ...e, exerciseId: def.id }
                      : e,
                  ),
                })
              }
            />
          </motion.div>
        ))}
      </div>

      {incoming.skippedCount > 0 ? (
        <SkippedPeek
          count={incoming.skippedCount}
          segments={incoming.skipped}
          open={showSkipped}
          onToggle={() => setShowSkipped((v) => !v)}
        />
      ) : null}

      {incoming.warnings.length > 0 ? (
        <div className="mt-6 space-y-1 rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-warn">
            <CircleAlert className="size-4" aria-hidden /> A few lines need a look
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {incoming.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Mobile-friendly bottom save (the header action is hidden behind the
          fold once you scroll a long list). */}
      <div className="mt-8 flex justify-end">
        <motion.div whileTap={reduce || saving ? undefined : { scale: 0.97 }}>
          <Button size="lg" onClick={handleSave} disabled={saving}>
            <Save aria-hidden />
            {saving ? 'Saving…' : 'Confirm & save'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// --- Workout card -----------------------------------------------------------

function WorkoutCard({
  workout,
  catalogIndex,
  onChange,
  onRemove,
  onAddedToCatalog,
}: {
  workout: DraftWorkout;
  catalogIndex: Map<string, ExerciseDef>;
  onChange: (patch: Partial<DraftWorkout>) => void;
  onRemove: () => void;
  onAddedToCatalog: (def: ExerciseDef) => void;
}) {
  const lowDate = workout.dateConfidence === 'low' || !workout.date;

  const updateExercise = (key: string, patch: Partial<DraftExercise>) =>
    onChange({
      exercises: workout.exercises.map((e) =>
        e.key === key ? { ...e, ...patch } : e,
      ),
    });

  const addExercise = () =>
    onChange({
      exercises: [
        ...workout.exercises,
        {
          key: newId(),
          exerciseId: `unknown:new-exercise`,
          rawName: '',
          unit: 'kg',
          sets: [{ key: newId(), weightKg: null, reps: 0, raw: '' }],
        },
      ],
    });

  const removeExercise = (key: string) =>
    onChange({ exercises: workout.exercises.filter((e) => e.key !== key) });

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Date" flagged={lowDate} flagText="Low confidence — confirm this">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="date"
                value={workout.date}
                aria-invalid={lowDate}
                onChange={(e) => onChange({ date: e.target.value, dateConfidence: 'high' })}
                className="pl-8"
              />
            </div>
          </Field>

          <Field label="Bodyweight (kg)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="—"
              value={workout.bodyweightKg ?? ''}
              onChange={(e) =>
                onChange({
                  bodyweightKg: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </Field>

          <Field label="Split">
            <SplitSelect
              value={workout.splitCanonical}
              onChange={(v) => onChange({ splitCanonical: v, splitRaw: workout.splitRaw })}
            />
          </Field>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove this workout"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </header>

      <div className="mt-5 space-y-4">
        {workout.exercises.map((ex) => (
          <ExerciseRow
            key={ex.key}
            exercise={ex}
            catalogIndex={catalogIndex}
            onChange={(patch) => updateExercise(ex.key, patch)}
            onRemove={() => removeExercise(ex.key)}
            onAddedToCatalog={onAddedToCatalog}
          />
        ))}

        <Button variant="outline" size="sm" onClick={addExercise}>
          <Plus aria-hidden /> Add exercise
        </Button>
      </div>
    </section>
  );
}

// --- Exercise row -----------------------------------------------------------

function ExerciseRow({
  exercise,
  catalogIndex,
  onChange,
  onRemove,
  onAddedToCatalog,
}: {
  exercise: DraftExercise;
  catalogIndex: Map<string, ExerciseDef>;
  onChange: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onAddedToCatalog: (def: ExerciseDef) => void;
}) {
  const isUnknown = exercise.exerciseId.startsWith('unknown:');
  const def = catalogIndex.get(exercise.exerciseId);

  const updateSet = (key: string, patch: Partial<DraftSet>) =>
    onChange({
      sets: exercise.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    });

  const addSet = () => {
    const last = exercise.sets[exercise.sets.length - 1];
    onChange({
      sets: [
        ...exercise.sets,
        { key: newId(), weightKg: last?.weightKg ?? null, reps: last?.reps ?? 0, raw: '' },
      ],
    });
  };

  const removeSet = (key: string) =>
    onChange({ sets: exercise.sets.filter((s) => s.key !== key) });

  return (
    <div className="rounded-lg border border-border/70 bg-surface/40 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            list="replog-exercise-names"
            value={exercise.rawName}
            placeholder="Exercise name"
            onChange={(e) => {
              const name = e.target.value;
              // If the typed name resolves to a catalog entry, snap to its id.
              const match = createCatalog().match(name);
              onChange({
                rawName: name,
                exerciseId: match ? match.id : `unknown:${slugify(name)}`,
              });
            }}
            className="h-9"
          />
        </div>
        {isUnknown ? (
          <AddToCatalogDialog name={exercise.rawName} onAdded={onAddedToCatalog} />
        ) : def ? (
          <Badge variant="ghost" className="hidden text-highlight sm:inline-flex">
            {def.canonicalName}
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove ${exercise.rawName || 'exercise'}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <X aria-hidden />
        </Button>
      </div>

      {isUnknown && exercise.rawName.trim() ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
          <CircleAlert className="size-3.5" aria-hidden />
          Not in the catalog — add it so it counts toward your bests &amp; coach.
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {exercise.sets.map((set, idx) => (
          <div key={set.key} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground tnum">
              {idx + 1}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                aria-label={`Set ${idx + 1} weight (kg)`}
                placeholder="BW"
                value={set.weightKg ?? ''}
                onChange={(e) =>
                  updateSet(set.key, {
                    weightKg: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="h-9 w-24"
              />
              <span className="text-xs text-muted-foreground">kg ×</span>
              <Input
                type="number"
                inputMode="numeric"
                aria-label={`Set ${idx + 1} reps`}
                placeholder="reps"
                value={Number.isFinite(set.reps) && set.reps > 0 ? set.reps : ''}
                onChange={(e) => updateSet(set.key, { reps: Number(e.target.value) || 0 })}
                className="h-9 w-20"
              />
              <span className="text-xs text-muted-foreground">reps</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => removeSet(set.key)}
              aria-label={`Remove set ${idx + 1}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="xs" onClick={addSet}>
          <Plus aria-hidden /> Add set
        </Button>
      </div>
    </div>
  );
}

// --- Split select (styled native select) ------------------------------------

function SplitSelect({
  value,
  onChange,
}: {
  value: SplitCanonical;
  onChange: (v: SplitCanonical) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SplitCanonical)}
        aria-label="Split"
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-xs outline-none',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
        )}
      >
        {SPLIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

// --- Add-to-catalog dialog --------------------------------------------------

function AddToCatalogDialog({
  name,
  onAdded,
}: {
  name: string;
  onAdded: (def: ExerciseDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const trimmed = name.trim();

  const toggle = (m: MuscleGroup) =>
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const save = async () => {
    if (!trimmed) return;
    const def: ExerciseDef = {
      id: `custom-${slugify(trimmed)}-${newId(4)}`,
      canonicalName: trimmed,
      aliases: [trimmed.toLowerCase()],
      category: 'push',
      pattern: 'isolation',
      primaryMuscles: muscles,
      secondaryMuscles: [],
    };
    try {
      await repository.addCustomExercise(def);
      onAdded(def);
      toast.success(`Added "${trimmed}" to your catalog`);
      setOpen(false);
      setMuscles([]);
    } catch (err) {
      toast.error('Could not add to catalog', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!trimmed}
        className="shrink-0"
      >
        <Plus aria-hidden /> Catalog
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add &ldquo;{trimmed || 'exercise'}&rdquo; to catalog</DialogTitle>
          <DialogDescription>
            Tag the muscles it trains so this lift counts toward your bests and the
            coach&apos;s imbalance analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {MUSCLE_OPTIONS.map((m) => {
            const active = muscles.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-highlight bg-highlight-muted text-highlight'
                    : 'border-border text-muted-foreground hover:border-highlight/40 hover:text-foreground',
                )}
              >
                {muscleLabel(m)}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!trimmed || muscles.length === 0}>
            <Plus aria-hidden /> Add to catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Skipped peek -----------------------------------------------------------

function SkippedPeek({
  count,
  segments,
  open,
  onToggle,
}: {
  count: number;
  segments: string[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-elevated"
      >
        <span>
          <span className="font-medium text-foreground tnum">{count}</span>{' '}
          unrelated note{count === 1 ? '' : 's'} skipped
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-border px-4 py-3">
          {segments.map((seg, idx) => (
            <li
              key={idx}
              className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/60 p-2 text-xs text-muted-foreground"
            >
              {seg.length > 280 ? `${seg.slice(0, 280)}…` : seg}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// --- Small helpers ----------------------------------------------------------

function Field({
  label,
  children,
  flagged,
  flagText,
}: {
  label: string;
  children: React.ReactNode;
  flagged?: boolean;
  flagText?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {flagged ? (
          <span className="inline-flex items-center gap-1 text-warn" title={flagText}>
            <CircleAlert className="size-3" aria-hidden />
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

function readReviewState(state: unknown): ReviewRouteState | null {
  if (
    state &&
    typeof state === 'object' &&
    'tag' in state &&
    (state as { tag?: unknown }).tag === REVIEW_STATE_TAG &&
    'workouts' in state
  ) {
    const s = state as ReviewRouteState & { tag: string };
    return {
      workouts: s.workouts ?? [],
      skippedCount: s.skippedCount ?? 0,
      skipped: s.skipped ?? [],
      warnings: s.warnings ?? [],
      sourceLabels: s.sourceLabels,
    };
  }
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
