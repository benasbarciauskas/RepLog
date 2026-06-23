import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Play, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useActiveProgram, useActiveSession, useSettings } from '@/data/hooks';
import { repository } from '@/data/repository';
import { refineProgram } from '@/ai/refineProgram';
import { createCatalog } from '@/parser/catalog';
import { sessionFromProgramDay } from '@/features/logger/lib';
import { ConfirmDialog } from '@/features/logger/ConfirmDialog';
import type { Program, ProgramDay } from '@/types/models';
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

export default function ProgramPage() {
  const program = useActiveProgram();
  const activeSession = useActiveSession();
  const settings = useSettings();
  const navigate = useNavigate();
  const catalog = useMemo(() => createCatalog(), []);

  const [showWizard, setShowWizard] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [startDay, setStartDay] = useState<ProgramDay | null>(null);
  const [refining, setRefining] = useState(false);

  const hasAiKey = Boolean(settings.aiApiKey?.trim());

  async function doStartDay(day: ProgramDay) {
    await repository.saveActiveSession(sessionFromProgramDay(day));
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
        {program.days.map((day) => (
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
                  {day.exercises.map((ex) => (
                    <li
                      key={ex.exerciseId}
                      className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-foreground">{ex.rawName}</span>
                      <span className="tnum shrink-0 text-xs text-muted-foreground">
                        {exerciseLine(ex)}
                      </span>
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
    </div>
  );
}