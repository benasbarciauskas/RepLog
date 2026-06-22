import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AppSettings, ExerciseBest, Workout } from '@/types/models';

const workoutsMock = vi.fn<() => Workout[]>(() => []);
const bestsMock = vi.fn<() => ExerciseBest[]>(() => []);
const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
};
const settingsMock = vi.fn<() => AppSettings>(() => DEFAULT_SETTINGS);

vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useBests: () => bestsMock(),
  useSettings: () => settingsMock(),
}));

async function renderExercise(id: string) {
  const ExercisePage = (await import('./ExercisePage')).default;
  return render(
    <MemoryRouter initialEntries={[`/exercise/${id}`]}>
      <Routes>
        <Route path="/exercise/:id" element={<ExercisePage />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const benchBest: ExerciseBest = {
  exerciseId: 'barbell-bench-press',
  maxWeightKg: 140,
  maxWeightDate: '2023-07-10',
  bestE1rmKg: 164.7,
  bestE1rmDate: '2023-09-13',
  repPRs: [
    { reps: 5, weightKg: 105, date: '2023-06-19' },
    { reps: 3, weightKg: 140, date: '2023-07-10' },
  ],
};

const benchWorkouts: Workout[] = [
  {
    id: 'w1',
    date: '2023-06-19',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2023-06-19T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench',
        unit: 'kg',
        sets: [{ weightKg: 105, reps: 5, raw: '105x5' }],
      },
    ],
  },
  {
    id: 'w2',
    date: '2023-07-10',
    dateConfidence: 'high',
    bodyweightKg: null,
    splitCanonical: 'push',
    splitRaw: 'Push',
    blockId: null,
    sourceNoteId: 'n1',
    createdAt: '2023-07-10T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        rawName: 'Bench',
        unit: 'kg',
        sets: [{ weightKg: 140, reps: 3, raw: '140x3' }],
      },
    ],
  },
];

beforeEach(() => {
  workoutsMock.mockReturnValue([]);
  bestsMock.mockReturnValue([]);
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Generous timeout: charts (recharts) + motion are heavy to transform on a cold
// cache, and parallel workers can blow the 5s default on slower machines/CI.
describe('ExercisePage', { timeout: 20000 }, () => {
  it('resolves the canonical name + muscles from the catalog', async () => {
    workoutsMock.mockReturnValue(benchWorkouts);
    bestsMock.mockReturnValue([benchBest]);

    await renderExercise('barbell-bench-press');

    expect(
      screen.getByRole('heading', { name: 'Barbell Bench Press', level: 1 }),
    ).toBeInTheDocument();
    // muscle list in the description
    expect(screen.getByText(/works .*chest/i)).toBeInTheDocument();
  });

  it('renders the progression chart, session history, and PR history for a lift with data', async () => {
    workoutsMock.mockReturnValue(benchWorkouts);
    bestsMock.mockReturnValue([benchBest]);

    await renderExercise('barbell-bench-press');

    expect(screen.getByRole('heading', { name: /progression/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /session history/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pr history/i })).toBeInTheDocument();
    // PR rows render their rep counts.
    expect(screen.getByText(/× 3 reps/)).toBeInTheDocument();
    expect(screen.getByText(/× 5 reps/)).toBeInTheDocument();
    // Default metric is Est. 1RM → chart card titled accordingly.
    expect(screen.getByText('Estimated 1RM')).toBeInTheDocument();
  });

  it('switches the charted series when the metric toggle changes', async () => {
    workoutsMock.mockReturnValue(benchWorkouts);
    bestsMock.mockReturnValue([benchBest]);

    await renderExercise('barbell-bench-press');

    // Default chart card shows the Est. 1RM metric.
    expect(screen.getByText('Estimated 1RM')).toBeInTheDocument();

    // Pick "Heaviest" from the metric toggle → chart card retitles.
    fireEvent.click(screen.getByRole('tab', { name: 'Heaviest' }));
    expect(screen.getByText('Heaviest weight')).toBeInTheDocument();
  });

  it('handles an unknown id gracefully (no data state, no crash)', async () => {
    workoutsMock.mockReturnValue([]);
    bestsMock.mockReturnValue([]);

    await renderExercise('unknown:cable-bicep-isos');

    // De-slugged title still renders.
    expect(
      screen.getByRole('heading', { name: /cable bicep isos/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no data for this lift yet/i })).toBeInTheDocument();
  });
});
