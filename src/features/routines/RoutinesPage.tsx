import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useActiveSession, useRoutines } from '@/data/hooks';
import { repository } from '@/data/repository';
import type { Routine } from '@/types/models';
import { sessionFromRoutine } from '@/features/logger/lib';
import { ConfirmDialog } from '@/features/logger/ConfirmDialog';
import { RoutineEditorDialog } from './RoutineEditorDialog';

/**
 * Routines (`/routines`): list / create / edit / delete reusable templates, and
 * start a workout from one. Starting seeds an `ActiveSession` and routes to
 * `/log`; if a session is already in progress, we confirm before replacing it.
 */
export default function RoutinesPage() {
  const routines = useRoutines();
  const activeSession = useActiveSession();
  const navigate = useNavigate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [startTarget, setStartTarget] = useState<Routine | null>(null);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(r: Routine) {
    setEditing(r);
    setEditorOpen(true);
  }

  function handleSave(r: Routine) {
    void repository.saveRoutine(r);
    toast.success(editing ? 'Routine updated' : 'Routine created', { description: r.name });
  }

  function handleDelete(r: Routine) {
    void repository.deleteRoutine(r.id);
    toast('Routine deleted', { description: r.name });
  }

  async function doStart(r: Routine) {
    await repository.saveActiveSession(sessionFromRoutine(r));
    navigate('/log');
  }

  function handleStart(r: Routine) {
    // If a workout is already in progress, confirm before overwriting it.
    if (activeSession) {
      setStartTarget(r);
      return;
    }
    void doStart(r);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Templates"
        title="Routines"
        description="Reusable workout templates — start a session from one, or save a session as a new routine."
        actions={
          routines.length > 0 ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" strokeWidth={2} />
              New routine
            </Button>
          ) : undefined
        }
      />

      {routines.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No routines yet"
          description="Build a routine once and start future workouts from it in a tap. Add exercises with target sets, reps, and rest."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" strokeWidth={2} />
              Create your first routine
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {routines.map((r) => (
            <li key={r.id}>
              <Card className="gap-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                      {r.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(r)}
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil className="size-4" strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(r)}
                      aria-label={`Delete ${r.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                {r.exercises.length > 0 ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {r.exercises
                      .map((e) =>
                        e.targetReps
                          ? `${e.rawName} ${e.targetSets}×${e.targetReps}`
                          : `${e.rawName} ${e.targetSets} sets`,
                      )
                      .join(' · ')}
                  </p>
                ) : null}

                <Button onClick={() => handleStart(r)} className="w-full sm:w-auto">
                  <Play className="size-4" strokeWidth={2} />
                  Start
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RoutineEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        routine={editing}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete routine?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed. This can't be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />

      <ConfirmDialog
        open={startTarget != null}
        onOpenChange={(o) => !o && setStartTarget(null)}
        title="Replace your active workout?"
        description="You have a workout in progress. Starting this routine will discard it."
        confirmLabel="Start anyway"
        destructive
        onConfirm={() => {
          if (startTarget) void doStart(startTarget);
        }}
      />
    </div>
  );
}
