import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ActiveSession, Program } from '@/types/models';

let activeProgram: Program | undefined;
let activeSession: ActiveSession | undefined;

vi.mock('@/data/hooks', () => ({
  useActiveProgram: () => activeProgram,
  useActiveSession: () => activeSession,
  useWorkouts: () => [],
  useSettings: () => ({ unit: 'kg', barWeightKg: 20, availablePlatesKg: [20], defaultRestSeconds: 120 }),
  useCustomExercises: () => [],
}));

const saveProgram = vi.fn<(p: Program) => Promise<void>>(async () => {});
const deleteProgram = vi.fn<(id: string) => Promise<void>>(async () => {});
const saveActiveSession = vi.fn<(s: ActiveSession) => Promise<void>>(async () => {});

vi.mock('@/data/repository', async () => {
  const actual = await vi.importActual<typeof import('@/data/repository')>('@/data/repository');
  return {
    ...actual,
    repository: { saveProgram, deleteProgram, saveActiveSession },
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

async function renderProgram() {
  const ProgramPage = (await import('./ProgramPage')).default;
  return render(
    <MemoryRouter initialEntries={['/program']}>
      <ProgramPage />
    </MemoryRouter>,
  );
}

const SAMPLE_PROGRAM: Program = {
  id: 'prog-1',
  name: 'Hypertrophy · 3-day Full Body',
  config: {
    goal: 'hypertrophy',
    experience: 'beginner',
    daysPerWeek: 3,
    split: 'auto',
    minutesPerSession: 60,
  },
  days: [
    {
      name: 'Full Body 1',
      splitCanonical: 'full-body',
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          rawName: 'Barbell Bench Press',
          targetSets: 3,
          repRange: [8, 12],
          rir: 2,
          restSeconds: 150,
        },
      ],
    },
  ],
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => {
  activeProgram = undefined;
  activeSession = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProgramPage', () => {
  it('renders the wizard CTA when no program exists', async () => {
    await renderProgram();
    expect(screen.getByRole('heading', { name: 'Program', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('shows the wizard after clicking get started', async () => {
    await renderProgram();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByRole('button', { name: /generate program/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Split')).toBeInTheDocument();
  });

  it('renders day cards and start buttons when a program exists', async () => {
    activeProgram = SAMPLE_PROGRAM;
    await renderProgram();

    expect(screen.getByRole('heading', { name: SAMPLE_PROGRAM.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Full Body 1', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Barbell Bench Press/)).toBeInTheDocument();
    expect(screen.getByText(/3×8–12 @ RIR 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start this day/i })).toBeInTheDocument();
  });

  it('seeds a session when starting a program day', async () => {
    activeProgram = SAMPLE_PROGRAM;
    await renderProgram();

    fireEvent.click(screen.getByRole('button', { name: /start this day/i }));
    await waitFor(() => expect(saveActiveSession).toHaveBeenCalledTimes(1));
    const seeded = saveActiveSession.mock.calls[0][0];
    expect(seeded.splitCanonical).toBe('full-body');
    expect(seeded.exercises[0].exerciseId).toBe('barbell-bench-press');
    expect(seeded.exercises[0].sets).toHaveLength(3);
    expect(seeded.exercises[0].sets[0].weightKg).toBeNull();
    expect(seeded.exercises[0].sets[0].reps).toBe(8);
  });

  it('opens swap dialog and persists a substituted exercise', async () => {
    activeProgram = SAMPLE_PROGRAM;
    await renderProgram();

    fireEvent.click(screen.getByRole('button', { name: /swap barbell bench press/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Swap exercise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dumbbell bench press/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dumbbell bench press/i }));
    await waitFor(() => expect(saveProgram).toHaveBeenCalledTimes(1));

    const updated = saveProgram.mock.calls[0][0];
    const swapped = updated.days[0].exercises[0];
    expect(swapped.exerciseId).toBe('dumbbell-bench-press');
    expect(swapped.rawName).toBe('Dumbbell Bench Press');
    expect(swapped.targetSets).toBe(3);
    expect(swapped.repRange).toEqual([8, 12]);
    expect(swapped.rir).toBe(2);
    expect(swapped.restSeconds).toBe(150);
  });
});