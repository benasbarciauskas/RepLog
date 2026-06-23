import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ActiveSession, Routine } from '@/types/models';

const routinesMock = vi.fn<() => Routine[]>(() => []);
let activeSession: ActiveSession | undefined;

vi.mock('@/data/hooks', () => ({
  useRoutines: () => routinesMock(),
  useActiveSession: () => activeSession,
}));

const saveRoutine = vi.fn<(r: Routine) => Promise<void>>(async () => {});
const deleteRoutine = vi.fn<(id: string) => Promise<void>>(async () => {});
const saveActiveSession = vi.fn<(s: ActiveSession) => Promise<void>>(async () => {});

vi.mock('@/data/repository', async () => {
  const actual = await vi.importActual<typeof import('@/data/repository')>('@/data/repository');
  return {
    ...actual,
    repository: { saveRoutine, deleteRoutine, saveActiveSession },
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

async function renderRoutines() {
  const RoutinesPage = (await import('./RoutinesPage')).default;
  return render(
    <MemoryRouter initialEntries={['/routines']}>
      <RoutinesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  routinesMock.mockReturnValue([]);
  activeSession = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoutinesPage', () => {
  it('renders the empty state with a create CTA', async () => {
    await renderRoutines();
    expect(screen.getByRole('heading', { name: 'Routines', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your first routine/i })).toBeInTheDocument();
  });

  it('creates a routine: name + an exercise, then saves', async () => {
    await renderRoutines();

    fireEvent.click(screen.getByRole('button', { name: /create your first routine/i }));

    // Editor dialog opens.
    const nameInput = await screen.findByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Push Day A' } });

    // Add an exercise via the catalog search.
    fireEvent.click(screen.getByRole('button', { name: /^add exercise$/i }));
    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'overhead press' } });
    const option = await screen.findByRole('button', { name: /overhead press/i });
    fireEvent.click(option);

    // The exercise row appears in the editor.
    await waitFor(() => expect(screen.getByLabelText('Sets')).toBeInTheDocument());

    // Create.
    fireEvent.click(screen.getByRole('button', { name: /create routine/i }));

    await waitFor(() => expect(saveRoutine).toHaveBeenCalledTimes(1));
    const saved = saveRoutine.mock.calls[0][0];
    expect(saved.name).toBe('Push Day A');
    expect(saved.exercises).toHaveLength(1);
    expect(saved.exercises[0].exerciseId).toBe('overhead-press');
    expect(saved.exercises[0].targetSets).toBe(3);
  });

  it('lists existing routines and can delete one', async () => {
    routinesMock.mockReturnValue([
      {
        id: 'r1',
        name: 'Pull Day',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        exercises: [{ exerciseId: 'deadlift', rawName: 'Deadlift', targetSets: 1, targetReps: 5 }],
      },
    ]);
    await renderRoutines();

    expect(screen.getByRole('heading', { name: 'Pull Day', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Deadlift 1×5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete pull day/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith('r1'));
  });

  it('starting a routine seeds a session and navigates to /log', async () => {
    routinesMock.mockReturnValue([
      {
        id: 'r1',
        name: 'Legs',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        exercises: [{ exerciseId: 'back-squat', rawName: 'Squat', targetSets: 3, targetReps: 5 }],
      },
    ]);
    await renderRoutines();

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    await waitFor(() => expect(saveActiveSession).toHaveBeenCalledTimes(1));
    const seeded = saveActiveSession.mock.calls[0][0];
    expect(seeded.routineId).toBe('r1');
    expect(seeded.exercises[0].exerciseId).toBe('back-squat');
    expect(seeded.exercises[0].sets).toHaveLength(3);
  });
});
