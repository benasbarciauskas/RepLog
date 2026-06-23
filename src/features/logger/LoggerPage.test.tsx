import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ActiveSession, AppSettings, Routine, Workout } from '@/types/models';
import { DEFAULT_SETTINGS } from '@/data/repository';

// --- mocks ------------------------------------------------------------------

// A mutable fake active session the mocked hook + repository share, so the page
// flows realistically (start → mutate → reads reflect writes).
let activeSession: ActiveSession | undefined;
const routinesMock = vi.fn<() => Routine[]>(() => []);
const workoutsMock = vi.fn<() => Workout[]>(() => []);
const settingsMock = vi.fn<() => AppSettings>(() => DEFAULT_SETTINGS);

vi.mock('@/data/hooks', () => ({
  useActiveSession: () => activeSession,
  useRoutines: () => routinesMock(),
  useWorkouts: () => workoutsMock(),
  useSettings: () => settingsMock(),
}));

vi.mock('@/data/repository', async () => {
  const actual = await vi.importActual<typeof import('@/data/repository')>('@/data/repository');
  return {
    ...actual,
    repository: {
      saveActiveSession: vi.fn(async (s: ActiveSession) => {
        activeSession = { ...s, id: 'current' };
      }),
      clearActiveSession: vi.fn(async () => {
        activeSession = undefined;
      }),
      finishActiveSession: vi.fn(async () => undefined),
      saveRoutine: vi.fn(async () => {}),
    },
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

async function renderLogger() {
  const LoggerPage = (await import('./LoggerPage')).default;
  return render(
    <MemoryRouter initialEntries={['/log']}>
      <LoggerPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  activeSession = undefined;
  routinesMock.mockReturnValue([]);
  workoutsMock.mockReturnValue([]);
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LoggerPage — start view', () => {
  it('shows the start-empty action and a no-routines empty state', async () => {
    await renderLogger();
    expect(screen.getByRole('heading', { name: 'Log', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start empty workout/i })).toBeInTheDocument();
    expect(screen.getByText(/no routines yet/i)).toBeInTheDocument();
  });

  it('lists routines to start from', async () => {
    routinesMock.mockReturnValue([
      {
        id: 'r1',
        name: 'Push Day',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        exercises: [{ exerciseId: 'barbell-bench-press', rawName: 'Bench', targetSets: 3 }],
      },
    ]);
    await renderLogger();
    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText(/1 exercise/)).toBeInTheDocument();
  });
});

describe('LoggerPage — active workout flow', () => {
  it('start empty → add exercise → add set → mark done', async () => {
    const { rerender } = await renderLogger();

    // Start empty workout — the mocked repo updates the shared session.
    fireEvent.click(screen.getByRole('button', { name: /start empty workout/i }));

    // The component sets local state immediately; the elapsed timer appears.
    expect(await screen.findByLabelText('Elapsed time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();

    // Empty active workout prompts to add the first exercise.
    const addButtons = screen.getAllByRole('button', { name: /add exercise/i });
    fireEvent.click(addButtons[0]);

    // Catalog search dialog opens; search + pick bench.
    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'bench press' } });
    const listbox = await screen.findByRole('listbox', { name: /exercise results/i });
    // The exact-name hit ("Barbell Bench Press") sorts first as a startsWith match.
    const option = within(listbox)
      .getAllByRole('button', { name: /barbell bench press/i })
      .find((b) => within(b).queryByText('Barbell Bench Press'))!;
    fireEvent.click(option);

    // Exercise card renders with its name + a first set row.
    expect(await screen.findByRole('heading', { name: /barbell bench press/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();

    // Add a second set.
    fireEvent.click(screen.getByRole('button', { name: /add set/i }));
    await waitFor(() => expect(screen.getAllByLabelText('Weight')).toHaveLength(2));

    // Add an exercise note.
    fireEvent.click(screen.getByRole('button', { name: /add note/i }));
    const note = await screen.findByLabelText(/note for barbell bench press/i);
    fireEvent.change(note, { target: { value: 'Pause at chest' } });

    // Mark the first set done.
    const doneButtons = screen.getAllByRole('button', { name: /mark set done/i });
    fireEvent.click(doneButtons[0]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /mark set not done/i }).length).toBeGreaterThan(0),
    );

    // Keep rerender referenced (router stays mounted).
    rerender(
      <MemoryRouter initialEntries={['/log']}>
        <div />
      </MemoryRouter>,
    );
  });

  it('resumes an existing active session on mount', async () => {
    activeSession = {
      id: 'current',
      startedAt: new Date().toISOString(),
      routineId: null,
      bodyweightKg: null,
      splitCanonical: 'push',
      exercises: [
        {
          id: 'ae1',
          exerciseId: 'barbell-bench-press',
          rawName: 'Barbell Bench Press',
          unit: 'kg',
          sets: [{ id: 's1', weightKg: 100, reps: 5, rpe: null, isWarmup: false, done: true }],
        },
      ],
    };
    await renderLogger();
    // Active view, not the start view.
    expect(screen.getByLabelText('Elapsed time')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /barbell bench press/i })).toBeInTheDocument();
    // The done set shows as such.
    expect(within(document.body).getAllByRole('button', { name: /mark set not done/i }).length).toBeGreaterThan(0);
  });
});
