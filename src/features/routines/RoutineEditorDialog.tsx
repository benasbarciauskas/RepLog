import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { newId } from '@/lib/id';
import type { Routine } from '@/types/models';
import { ExerciseSearchDialog, type ExercisePick } from '@/features/logger/ExerciseSearchDialog';

/** A routine exercise row carries a transient local id for editing. */
interface EditExercise {
  uid: string;
  exerciseId: string;
  rawName: string;
  targetSets: number;
  targetReps?: number;
  restSeconds?: number;
}

export interface RoutineEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The routine to edit, or null/undefined to create a new one. */
  routine?: Routine | null;
  onSave: (routine: Routine) => void;
}

function toEditRows(routine?: Routine | null): EditExercise[] {
  if (!routine) return [];
  return routine.exercises.map((e) => ({ uid: newId(), ...e }));
}

/**
 * Create / edit a routine: name + an ordered list of exercises, each with
 * target sets / reps / rest. Exercises are added via the catalog search dialog.
 */
export function RoutineEditorDialog({
  open,
  onOpenChange,
  routine,
  onSave,
}: RoutineEditorDialogProps) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<EditExercise[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Hydrate from the routine each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName(routine?.name ?? '');
      setRows(toEditRows(routine));
    }
  }, [open, routine]);

  function addExercise(pick: ExercisePick) {
    setRows((prev) => [
      ...prev,
      { uid: newId(), exerciseId: pick.exerciseId, rawName: pick.rawName, targetSets: 3 },
    ]);
  }

  function patchRow(uid: string, patch: Partial<EditExercise>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function removeRow(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }

  function moveRow(uid: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.uid === uid);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    const saved: Routine = {
      id: routine?.id ?? newId(),
      name: trimmed,
      createdAt: routine?.createdAt ?? nowIso,
      updatedAt: nowIso,
      exercises: rows.map((r) => ({
        exerciseId: r.exerciseId,
        rawName: r.rawName,
        targetSets: Math.max(1, r.targetSets || 1),
        targetReps: r.targetReps,
        restSeconds: r.restSeconds,
      })),
    };
    onSave(saved);
    onOpenChange(false);
  }

  const canSave = name.trim().length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] gap-4 overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{routine ? 'Edit routine' : 'New routine'}</DialogTitle>
            <DialogDescription>
              Name it, then add exercises with target sets, reps, and rest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="routine-name">Name</Label>
            <Input
              id="routine-name"
              autoFocus
              value={name}
              placeholder="e.g. Push Day A"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="-mx-1 max-h-[44vh] space-y-2 overflow-y-auto px-1">
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No exercises yet — add one below.
              </p>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.uid}
                  className="space-y-2 rounded-lg border border-border bg-surface/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {r.rawName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveRow(r.uid, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      <ChevronUp className="size-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveRow(r.uid, 1)}
                      disabled={i === rows.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDown className="size-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeRow(r.uid)}
                      aria-label="Remove exercise"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumField
                      label="Sets"
                      value={r.targetSets}
                      min={1}
                      onChange={(v) => patchRow(r.uid, { targetSets: v ?? 1 })}
                    />
                    <NumField
                      label="Reps"
                      value={r.targetReps}
                      onChange={(v) => patchRow(r.uid, { targetReps: v })}
                    />
                    <NumField
                      label="Rest (s)"
                      value={r.restSeconds}
                      onChange={(v) => patchRow(r.uid, { restSeconds: v })}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <Button variant="outline" onClick={() => setSearchOpen(true)} className="w-full">
            <Plus className="size-4" strokeWidth={2} />
            Add exercise
          </Button>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {routine ? 'Save changes' : 'Create routine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onPick={addExercise} />
    </>
  );
}

function NumField({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value?: number;
  min?: number;
  onChange: (v: number | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className="text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        type="number"
        min={min}
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = Math.max(min, Math.floor(Number(raw)));
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="h-8 px-2 text-center tnum"
      />
    </div>
  );
}
