import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  ListChecks,
  Plus,
  Save,
  Timer,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRoutines, useSettings, useWorkouts } from '@/data/hooks';
import { repository } from '@/data/repository';
import type { SplitCanonical } from '@/types/models';
import { useLogger } from './useLogger';
import { useNowTick } from './useRestTimer';
import {
  adjustRestDeadline,
  formatElapsed,
  groupExercisesForRender,
  makeEmptySession,
  routineFromSession,
  sessionFromRoutine,
} from './lib';
import { defaultRestAlertDeps, triggerRestTimerAlert } from './restAlerts';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseSearchDialog, type ExercisePick } from './ExerciseSearchDialog';
import { PlateCalculatorDialog } from './PlateCalculatorDialog';
import { RestTimer } from './RestTimer';
import { FinishSummaryDialog } from './FinishSummaryDialog';
import { NameDialog } from './NameDialog';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * The live workout logger (`/log`).
 *
 * - No active session → an empty state to start a blank workout or pick a routine.
 * - Active session → the live logging view: elapsed timer, per-exercise
 *   cards with set rows (previous / weight / reps / RPE / warm-up / done),
 *   auto-starting rest timer, plate calculator, finish / discard / save-as-routine.
 *
 * The session is persisted on every edit (debounced) by `useLogger`, including
 * the rest-timer deadline, so a refresh resumes exactly where you left off.
 */
export default function LoggerPage() {
  const logger = useLogger();
  const { session } = logger;

  return (
    <div>
      <PageHeader
        eyebrow="Live logger"
        title="Log"
        description="Start a workout, add exercises, and log every set as you train."
      />
      {session ? <ActiveWorkout logger={logger} /> : <StartView logger={logger} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Start view (no active session)
// ---------------------------------------------------------------------------

function StartView({ logger }: { logger: ReturnType<typeof useLogger> }) {
  const routines = useRoutines();

  async function startEmpty() {
    await logger.start(makeEmptySession());
  }

  async function startFromRoutine(routineId: string) {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    await logger.start(sessionFromRoutine(routine));
  }

  return (
    <div className="space-y-8">
      <Card className="items-start gap-4 px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Start a workout
          </h2>
          <p className="text-sm text-muted-foreground">
            Begin with an empty session and add exercises as you go.
          </p>
        </div>
        <Button size="lg" onClick={startEmpty} className="w-full shrink-0 sm:w-auto">
          <Plus className="size-4" strokeWidth={2} />
          Start empty workout
        </Button>
      </Card>

      <section aria-labelledby="routines-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="routines-heading"
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <ListChecks className="size-4 text-highlight" strokeWidth={1.75} />
            Start from routine
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/routines">Manage</Link>
          </Button>
        </div>

        {routines.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No routines yet"
            description="Build a reusable template once, then start future workouts from it in a tap."
            action={
              <Button asChild variant="outline">
                <Link to="/routines">Create a routine</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {routines.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => startFromRoutine(r.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:border-highlight/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-highlight">Start</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active workout view
// ---------------------------------------------------------------------------

function ActiveWorkout({ logger }: { logger: ReturnType<typeof useLogger> }) {
  const session = logger.session!;
  const settings = useSettings();
  const workouts = useWorkouts();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [searchOpen, setSearchOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveRoutineOpen, setSaveRoutineOpen] = useState(false);
  const [platesFor, setPlatesFor] = useState<number | null>(null);
  const [platesOpen, setPlatesOpen] = useState(false);

  // Elapsed timer ticks every second from startedAt.
  const now = useNowTick(true);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
  );

  function handleAddExercise(pick: ExercisePick) {
    logger.addExercise(pick.exerciseId, pick.rawName);
  }

  function openPlates(weightKg: number | null) {
    setPlatesFor(weightKg);
    setPlatesOpen(true);
  }

  async function handleFinish(meta: {
    bodyweightKg?: number | null;
    splitCanonical?: SplitCanonical;
  }) {
    // Persist the latest in-memory session before the repo reads it from disk.
    await logger.persistNow(session);
    const workout = await repository.finishActiveSession(meta);
    setFinishOpen(false);
    if (workout) {
      toast.success('Workout saved', {
        description: `${workout.exercises.length} ${
          workout.exercises.length === 1 ? 'exercise' : 'exercises'
        } logged.`,
      });
    }
    navigate('/');
  }

  async function handleDiscard() {
    await logger.discard();
    toast('Workout discarded');
  }

  function handleSaveRoutine(name: string) {
    void repository.saveRoutine(routineFromSession(session, name));
    toast.success('Routine saved', { description: name });
  }

  const restAdjust = (delta: number) => {
    if (session.restDeadlineMs == null) return;
    logger.setRestDeadline(adjustRestDeadline(session.restDeadlineMs, delta, Date.now()));
  };

  const restComplete = () => {
    void triggerRestTimerAlert(settings.restAlerts, defaultRestAlertDeps());
    if (!reduce) {
      toast('Rest complete', { icon: '⏱', duration: 2500 });
    }
    logger.clearRest();
  };

  const exerciseGroups = groupExercisesForRender(session.exercises);

  return (
    <div className="space-y-5">
      {/* Sticky workout toolbar: elapsed timer + finish/discard */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-highlight" strokeWidth={1.75} aria-hidden />
          <span className="tnum text-lg font-semibold text-foreground" aria-label="Elapsed time">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Discard</span>
          </Button>
          <Button size="sm" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
            Finish
          </Button>
        </div>
      </div>

      {/* Exercise cards */}
      {session.exercises.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Add your first exercise"
          description="Search the catalog to start logging sets for this workout."
          action={
            <Button onClick={() => setSearchOpen(true)}>
              <Plus className="size-4" strokeWidth={2} />
              Add exercise
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {exerciseGroups.map((group) => (
            <div
              key={group.supersetGroup ?? group.exercises[0].id}
              className={cn(
                group.supersetGroup &&
                  'space-y-2 rounded-xl border border-highlight/30 bg-highlight-muted/20 pl-3 pr-1 pt-2',
              )}
            >
              {group.supersetGroup ? (
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-highlight">
                  Superset
                </p>
              ) : null}
              {group.exercises.map((ex) => {
                const i = session.exercises.findIndex((e) => e.id === ex.id);
                return (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    index={i}
                    count={session.exercises.length}
                    unit={settings.unit}
                    settings={settings}
                    workouts={workouts}
                    inSuperset={Boolean(group.supersetGroup)}
                    onPatchSet={(setId, patch) => logger.patchSet(ex.id, setId, patch)}
                    onPatchExercise={(patch) => logger.patchExercise(ex.id, patch)}
                    onToggleDone={(setId, rest) => logger.toggleDone(ex.id, setId, rest)}
                    onAddSet={() => logger.addSet(ex.id)}
                    onRemoveSet={(setId) => logger.removeSet(ex.id, setId)}
                    onRemoveExercise={() => logger.removeExercise(ex.id)}
                    onMove={(dir) => logger.moveExercise(ex.id, dir)}
                    onOpenPlates={openPlates}
                    onSupersetWithNext={
                      i < session.exercises.length - 1 && !ex.supersetGroup
                        ? () => logger.supersetWithNext(ex.id)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => setSearchOpen(true)} className="flex-1">
          <Plus className="size-4" strokeWidth={2} />
          Add exercise
        </Button>
        {session.exercises.length > 0 ? (
          <Button
            variant="ghost"
            onClick={() => setSaveRoutineOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Save className="size-4" strokeWidth={1.75} />
            Save as routine
          </Button>
        ) : null}
      </div>

      {/* Rest timer (floats above bottom nav while running) */}
      <RestTimer
        deadlineMs={session.restDeadlineMs ?? null}
        onAdjust={restAdjust}
        onSkip={logger.clearRest}
        onComplete={restComplete}
      />

      {/* Dialogs */}
      <ExerciseSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPick={handleAddExercise}
      />
      <PlateCalculatorDialog
        open={platesOpen}
        onOpenChange={setPlatesOpen}
        totalKg={platesFor}
        settings={settings}
      />
      <FinishSummaryDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        session={session}
        settings={settings}
        onConfirm={handleFinish}
      />
      <NameDialog
        open={saveRoutineOpen}
        onOpenChange={setSaveRoutineOpen}
        title="Save as routine"
        description="Turn this workout into a reusable template."
        label="Routine name"
        placeholder="e.g. Push Day A"
        confirmLabel="Save routine"
        onConfirm={handleSaveRoutine}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this workout?"
        description="This deletes the in-progress session. It can't be undone."
        confirmLabel="Discard"
        destructive
        onConfirm={handleDiscard}
      />
    </div>
  );
}
