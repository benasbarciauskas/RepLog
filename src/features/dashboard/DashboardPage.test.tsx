import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ExerciseBest, TrainingBlock, Workout } from '@/types/models';

// --- mocked data layer -----------------------------------------------------
const workoutsMock = vi.fn<() => Workout[]>(() => []);
const bestsMock = vi.fn<() => ExerciseBest[]>(() => []);
const blocksMock = vi.fn<() => TrainingBlock[]>(() => []);
const bodyweightMock = vi.fn<() => { date: string; kg: number }[]>(() => []);

vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useBests: () => bestsMock(),
  useBlocks: () => blocksMock(),
  useBodyweightSeries: () => bodyweightMock(),
}));

async function renderDashboard() {
  const DashboardPage = (await import('./DashboardPage')).default;
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

const benchBest: ExerciseBest = {
  exerciseId: 'barbell-bench-press',
  maxWeightKg: 140,
  maxWeightDate: '2023-07-10',
  bestE1rmKg: 164.7,
  bestE1rmDate: '2023-09-13',
  repPRs: [{ reps: 3, weightKg: 140, date: '2023-07-10' }],
};

const seededWorkouts: Workout[] = [
  {
    id: 'w1',
    date: '2023-06-19',
    dateConfidence: 'high',
    bodyweightKg: 87,
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
    bodyweightKg: 88,
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
  blocksMock.mockReturnValue([]);
  bodyweightMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Generous timeout: charts (recharts) + motion are heavy to transform on a cold
// cache, and parallel workers can blow the 5s default on slower machines/CI.
describe('DashboardPage', { timeout: 20000 }, () => {
  it('renders an empty state with an import CTA when there are no workouts', async () => {
    await renderDashboard();
    expect(
      screen.getByRole('heading', { name: /no workouts yet/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import your notes/i })).toHaveAttribute(
      'href',
      '/import',
    );
  });

  it('renders the all-time bests grid with seeded data', async () => {
    workoutsMock.mockReturnValue(seededWorkouts);
    bestsMock.mockReturnValue([benchBest]);

    await renderDashboard();

    // Section appears, and the resolved lift name renders as a clickable card.
    expect(screen.getByRole('heading', { name: /all-time bests/i })).toBeInTheDocument();
    // The bests card is a button (links to the exercise detail page on click).
    const card = screen.getByRole('button', { name: /barbell bench press/i });
    expect(card).toBeInTheDocument();
    // Est-1RM hint is spelled out.
    expect(screen.getByText(/Est\. 1RM/i)).toBeInTheDocument();
  });

  it('shows the PR timeline chart when a lift has >= 2 sessions', async () => {
    workoutsMock.mockReturnValue(seededWorkouts);
    bestsMock.mockReturnValue([benchBest]);

    await renderDashboard();
    expect(screen.getByRole('heading', { name: /pr timeline/i })).toBeInTheDocument();
  });

  it('renders the split-history strip when blocks exist', async () => {
    workoutsMock.mockReturnValue(seededWorkouts);
    bestsMock.mockReturnValue([benchBest]);
    blocksMock.mockReturnValue([
      {
        id: 'block-1',
        startDate: '2023-06-19',
        endDate: '2023-07-10',
        splitCanonical: 'push',
        label: '19 Jun – 10 Jul 2023 · Push',
      },
    ]);

    await renderDashboard();
    expect(screen.getByRole('heading', { name: /split history/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /training blocks/i })).toBeInTheDocument();
  });
});
