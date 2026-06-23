import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppSettings, Workout } from '@/types/models';

const workoutsMock = vi.fn<() => Workout[]>(() => []);
const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
};
const settingsMock = vi.fn<() => AppSettings>(() => DEFAULT_SETTINGS);

vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useSettings: () => settingsMock(),
}));

async function renderHistory() {
  const HistoryPage = (await import('./HistoryPage')).default;
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  );
}

const seeded: Workout[] = [
  {
    id: 'w1',
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
        sets: [
          { weightKg: 60, reps: 5, raw: '60x5', isWarmup: true },
          { weightKg: 140, reps: 3, raw: '140x3' },
        ],
      },
    ],
  },
];

beforeEach(() => {
  workoutsMock.mockReturnValue([]);
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HistoryPage', { timeout: 20000 }, () => {
  it('shows an empty state with log + import CTAs when there are no workouts', async () => {
    await renderHistory();
    expect(screen.getByRole('heading', { name: /no workouts yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a workout/i })).toHaveAttribute(
      'href',
      '/log',
    );
    expect(screen.getByRole('link', { name: /import your notes/i })).toHaveAttribute(
      'href',
      '/import',
    );
  });

  it('lists a seeded workout grouped by month with its split + counts', async () => {
    workoutsMock.mockReturnValue(seeded);
    await renderHistory();

    // Month heading + a row button labelled with the date.
    expect(screen.getByRole('heading', { name: /july 2023/i })).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /10 Jul 2023/i });
    expect(row).toBeInTheDocument();
    expect(row).toHaveTextContent(/push/i);
    // 1 exercise, 1 working set (warm-up excluded).
    expect(row).toHaveTextContent(/1 exercise/i);
    expect(row).toHaveTextContent(/1 set/i);
  });

  it('opens the workout detail with per-set rows when a row is tapped', async () => {
    workoutsMock.mockReturnValue(seeded);
    await renderHistory();

    fireEvent.click(screen.getByRole('button', { name: /10 Jul 2023/i }));

    // Detail header + the resolved exercise name + a working set + the warm-up tag.
    expect(
      screen.getByRole('heading', { name: /10 Jul 2023/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /barbell bench press/i })).toBeInTheDocument();
    expect(screen.getByText(/140 kg × 3/)).toBeInTheDocument();
    // Warm-up sets now carry the lime "W" logo-style badge (aria-labelled).
    expect(screen.getByRole('img', { name: /warm-up set/i })).toBeInTheDocument();
    // Deep-link into the exercise progress page.
    expect(screen.getByRole('link', { name: /progress/i })).toHaveAttribute(
      'href',
      '/exercise/barbell-bench-press',
    );
  });
});
