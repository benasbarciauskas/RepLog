import { useMemo, useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, GripVertical, Link2, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ActiveExercise, ActiveSet, AppSettings, Unit, Workout } from '@/types/models';
import { previousSetsFor, workingSetNumber } from './lib';
import { SetRow } from './SetRow';

export interface ExerciseCardProps {
  exercise: ActiveExercise;
  index: number;
  count: number;
  unit: Unit;
  settings: AppSettings;
  workouts: Workout[];
  inSuperset?: boolean;
  onPatchSet: (setId: string, patch: Partial<ActiveSet>) => void;
  onPatchExercise: (patch: Partial<ActiveExercise>) => void;
  onToggleDone: (setId: string, restSeconds: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
  onMove: (dir: -1 | 1) => void;
  onOpenPlates: (weightKg: number | null) => void;
  onSupersetWithNext?: () => void;
}

/**
 * One exercise within the live workout: header (name, reorder, remove) + a set
 * table + "Add set". The greyed "previous" column per row is derived from the
 * last saved session containing this exercise.
 */
export function ExerciseCard({
  exercise,
  index,
  count,
  unit,
  settings,
  workouts,
  inSuperset = false,
  onPatchSet,
  onPatchExercise,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onMove,
  onOpenPlates,
  onSupersetWithNext,
}: ExerciseCardProps) {
  const [noteOpen, setNoteOpen] = useState(Boolean(exercise.note));
  const previous = useMemo(
    () => previousSetsFor(workouts, exercise.exerciseId),
    [workouts, exercise.exerciseId],
  );

  // Map a working-set index → its previous-set entry (warm-ups have no previous).
  let workingIdx = -1;
  const restSeconds = exercise.restSeconds ?? settings.defaultRestSeconds;
  // Weight to seed the plate calculator: the first set with a logged weight.
  const plateWeight = exercise.sets.find((s) => s.weightKg != null)?.weightKg ?? null;
  const hasNote = Boolean(exercise.note?.trim());

  return (
    <Card className={cn('gap-3 py-4', inSuperset && 'border-0 shadow-none')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4">
        <span className="hidden text-muted-foreground/50 sm:block" aria-hidden>
          <GripVertical className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
            {exercise.rawName}
          </h3>
          {hasNote && !noteOpen ? (
            <p className="truncate text-xs text-muted-foreground" title={exercise.note}>
              {exercise.note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setNoteOpen((o) => !o)}
            aria-label={noteOpen ? 'Hide note' : 'Add note'}
            aria-pressed={noteOpen || hasNote}
            className={cn((noteOpen || hasNote) && 'text-highlight')}
          >
            <StickyNote className="size-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenPlates(plateWeight)}
            aria-label="Plate calculator"
          >
            <Calculator className="size-4" strokeWidth={1.75} />
          </Button>
          {onSupersetWithNext ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onSupersetWithNext}
              aria-label="Superset with next exercise"
            >
              <Link2 className="size-4" strokeWidth={1.75} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move exercise up"
          >
            <ChevronUp className="size-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label="Move exercise down"
          >
            <ChevronDown className="size-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemoveExercise}
            aria-label="Remove exercise"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {noteOpen ? (
        <div className="px-4">
          <label className="sr-only" htmlFor={`note-${exercise.id}`}>
            Note for {exercise.rawName}
          </label>
          <textarea
            id={`note-${exercise.id}`}
            value={exercise.note ?? ''}
            onChange={(e) => onPatchExercise({ note: e.target.value || undefined })}
            placeholder="Tempo, cues, machine settings…"
            rows={2}
            className={cn(
              'w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          />
        </div>
      ) : null}

      {/* Column labels */}
      <div className="grid grid-cols-[1.75rem_3.25rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem_3.75rem] gap-1.5 px-5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:gap-2">
        <span className="text-center">Set</span>
        <span>Prev</span>
        <span className="text-center">{unit === 'lb' ? 'lb' : 'kg'}</span>
        <span className="text-center">Reps</span>
        <span className="text-center">RPE</span>
        <span aria-hidden />
      </div>

      {/* Set rows */}
      <div className="space-y-0.5 px-3.5">
        {exercise.sets.map((set, i) => {
          const number = workingSetNumber(exercise.sets, i);
          if (!set.isWarmup) workingIdx += 1;
          const prev = set.isWarmup ? null : previous[workingIdx] ?? null;
          return (
            <div key={set.id} className="group/row">
              <SetRow
                set={set}
                number={number}
                previous={prev}
                unit={unit}
                onPatch={(patch) => onPatchSet(set.id, patch)}
                onToggleDone={() => onToggleDone(set.id, restSeconds)}
                onRemove={() => onRemoveSet(set.id)}
              />
            </div>
          );
        })}
      </div>

      {/* Add set */}
      <div className="px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSet}
          className={cn('w-full justify-center text-muted-foreground hover:text-foreground')}
        >
          <Plus className="size-4" strokeWidth={2} />
          Add set
        </Button>
      </div>
    </Card>
  );
}