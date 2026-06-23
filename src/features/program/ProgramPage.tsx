import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Play, RefreshCw, Repeat2, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useActiveProgram, useActiveSession, useCustomExercises, useSettings, useWorkouts } from '@/data/hooks';
import { repository } from '@/data/repository';
import { refineProgram } from '@/ai/refineProgram';
import { createCatalog } from '@/parser/catalog';
import {
  formatNextSetSuggestion,
  sessionFromProgramDayWithProgression,
} from '@/features/logger/lib';
import { incrementForExercise, suggestNextSet } from '@/program/progression';
import { similarExercises } from '@/program/substitute';
import { ConfirmDialog } from '@/features/logger/ConfirmDialog';
import { cn } from '@/lib/utils';
import type { ExerciseDef, Program, ProgramDay, ProgramDayExercise } from '@/types/models';
import { ProgramWizard } from './ProgramWizard';

function configSummary(program: Program): string {
  const { config } = program;
  const split =
    config.split === 'auto'
      ? 'Auto split'
      : config.split.replace(/-/g, ' ');
  return `${config.experience} · ${config.daysPerWeek} days · ${split} · ${config.minutesPerSession} min`;
}

function exerciseLine(ex: ProgramDay['exercises'][number]): string {
  return `${ex.targetSets}×${ex.repRange[0]}–${ex.repRange[1]} @ RIR ${ex.rir}`;
}

function nextSetLabel(
  ex: ProgramDayExercise,
  workouts: ReturnType<typeof useWorkouts>,
  settings: ReturnType<typeof useSettings>,
  catalog: ReturnType<typeof createCatalog>,
): string {
  const def = catalog.all().find((d) => d.id === ex.exerciseId);
  const suggestion = suggestNextSet(workouts, ex.exerciseId, {
    repRange: ex.repRange,
    rir: ex.rir,
    incrementKg: incrementForExercise(def, settings),
  });
  return formatNextSetSuggestion(suggestion, ex.repRange, settings.unit);
}

function humanCategory(c: ExerciseDef['category']): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

type SwapContext = {
  dayIndex: number;
  exIndex: number;
  ex: ProgramDayExercise;
};

export default function ProgramPage() {
  const program = useActiveProgram();
  const activeSession = useActiveSession();
  const settings = useSettings();
  const workouts = useWorkouts();
  const navigate = useNavigate();
  const customExercises = useCustomExercises();
  const catalog = useMemo(() => createCatalog(customExercises), [customExercises]);

  const [showWizard, setShowWizard] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [startDay, setStartDay] = useState<ProgramDay | null>(null);
  const [swapContext, setSwapContext] = useState<SwapContext | null>(null);
  const [refining, setRefining] = useState(false);

  const swapOptions = useMemo(() => {
    if (!swapContext) return [];
    return similarExercises(swapContext.ex.exerciseId, catalog.all());
  }, [swapContext, catalog]);

  const hasAiKey = Boolean(settings.aiApiKey?.trim());

  async function doStartDay(day: ProgramDay) {
    await repository.saveActiveSession(
      sessionFromProgramDayWithProgression(day, workouts, settings, catalog.all()),
    );
    navigate('/log');
  }

  function handleStartDay(day: ProgramDay) {
    if (activeSession) {
      setStartDay(day);
      return;
    }
    void doStartDay(day);
  }

  async function handleDelete() {
    if (!program) return;
    await repository.deleteProgram(program.id);
    setShowWizard(false);
    toast('Program deleted');
  }

  async function handleSwapPick(chosen: ExerciseDef) {
    if (!program || !swapContext) return;

    const { dayIndex, exIndex } = swapContext;
    const updatedDays = program.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return {
        ...day,
        exercises: day.exercises.map((ex, ei) => {
          if (ei !== exIndex) return ex;
          return {
            ...ex,
            exerciseId: chosen.id,
            rawName: chosen.canonicalName,
          };
        }),
      };
    });

    await repository.saveProgram({
      ...program,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    });
    setSwapContext(null);
    toast.success('Exercise swapped', { description: chosen.canonicalName });
  }

  async function handleRefine() {
    if (!program || !settings.aiApiKey) return;
    setRefining(true);
    try {
      const refined = await refineProgram(
        program,
        program.config,
        catalog.all().map((e) => e.id),
        {
          apiKey: settings.aiApiKey,
          model: settings.aiModel ?? 'meta-llama/llama-3.3-70b-instruct:free',
        },
      );
      await repository.saveProgram(refined);
      toast.success('Program refined', { description: 'Exercise selection updated by AI.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI refine failed.';
      toast.error('Could not refine program', { description: msg });
    } finally {
      setRefining(false);
    }
  }

  if (!program || showWizard) {
    return (
      <div>
        <PageHeader
          eyebrow="Training plan"
          title="Program"
          description="A research-based, on-device program tailored to your goal, experience, and schedule — no cloud required."
        />
        {program && showWizard ? (
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
        {!program && !showWizard ? (
          <EmptyState
            icon={CalendarRange}
            title="Generate your program"
            description="Answer a few questions and get a balanced weekly plan with sets, rep ranges, and rest — built from the exercise catalog on this device."
            action={
              <Button onClick={() => setShowWizard(true)}>
                <Sparkles className="size-4" strokeWidth={2} />
                Get started
              </Button>
            }
          />
        ) : (
          <ProgramWizard
            onGenerated={() => {
              setShowWizard(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Training plan"
        title={program.name}
        description={configSummary(program)}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasAiKey ? (
              <Button variant="outline" size="sm" onClick={() => void handleRefine()} disabled={refining}>
                <Sparkles className="size-4" strokeWidth={1.75} />
                {refining ? 'Refining…' : 'Refine with AI'}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setShowWizard(true)}>
              <RefreshCw className="size-4" strokeWidth={1.75} />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </Button>
          </div>
        }
      />

      <ul className="space-y-4">
        {program.days.map((day, dayIndex) => (
          <li key={day.name}>
            <Card className="gap-4 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {day.name}
                </h2>
                <p className="text-xs capitalize text-muted-foreground">
                  {day.splitCanonical.replace(/-/g, ' ')} · {day.exercises.length}{' '}
                  {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                </p>
              </div>

              {day.exercises.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {day.exercises.map((ex, exIndex) => (
                    <li
                      key={`${ex.exerciseId}-${exIndex}`}
                      className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{ex.rawName}</span>
                        <p className="tnum text-xs text-muted-foreground">
                          next: {nextSetLabel(ex, workouts, settings, catalog)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          aria-label={`Swap ${ex.rawName}`}
                          onClick={() => setSwapContext({ dayIndex, exIndex, ex })}
                        >
                          <Repeat2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                          Swap
                        </Button>
                        <span className="tnum text-xs text-muted-foreground">
                          {exerciseLine(ex)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No exercises assigned.</p>
              )}

              <Button
                onClick={() => handleStartDay(day)}
                className="w-full sm:w-auto"
                disabled={day.exercises.length === 0}
              >
                <Play className="size-4" strokeWidth={2} />
                Start this day
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete program?"
        description="Your generated program will be removed. You can create a new one anytime."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={startDay != null}
        onOpenChange={(o) => !o && setStartDay(null)}
        title="Replace your active workout?"
        description="You have a workout in progress. Starting this day will discard it."
        confirmLabel="Start anyway"
        destructive
        onConfirm={() => {
          if (startDay) void doStartDay(startDay);
        }}
      />

      <Dialog open={swapContext != null} onOpenChange={(o) => !o && setSwapContext(null)}>
        <DialogContent className="max-h-[80vh] gap-3 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Swap exercise</DialogTitle>
            <DialogDescription>
              {swapContext
                ? `Replace ${swapContext.ex.rawName} with a similar movement from the catalog.`
                : 'Pick a similar exercise.'}
            </DialogDescription>
          </DialogHeader>

          <ul
            className="max-h-[52vh] overflow-y-auto px-3 pb-3"
            role="listbox"
            aria-label="Similar exercises"
          >
            {swapOptions.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No close matches for this exercise.
              </li>
            ) : (
              swapOptions.map(({ def, reason }) => (
                <li key={def.id}>
                  <button
                    type="button"
                    onClick={() => void handleSwapPick(def)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors',
                      'hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {def.canonicalName}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {humanCategory(def.category)}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">{reason}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}