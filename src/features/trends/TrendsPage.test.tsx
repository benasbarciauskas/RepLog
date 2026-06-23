import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppSettings, Workout } from '@/types/models';
import { SAMPLE_WORKOUTS } from '@/data/sampleData';

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

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

async function renderTrends() {
  const TrendsPage = (await import('./TrendsPage')).default;
  return render(
    <MemoryRouter>
      <TrendsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  workoutsMock.mockReturnValue([]);
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrendsPage', { timeout: 20000 }, () => {
  it('shows empty state when fewer than two workouts', async () => {
    workoutsMock.mockReturnValue([SAMPLE_WORKOUTS[0]]);
    await renderTrends();
    expect(screen.getByRole('heading', { name: /not enough data yet/i })).toBeInTheDocument();
    expect(screen.getByText(/import or log a few workouts to see trends/i)).toBeInTheDocument();
  });

  it('renders PR timeline and block compare with sample data', async () => {
    workoutsMock.mockReturnValue(SAMPLE_WORKOUTS);
    await renderTrends();
    expect(screen.getByRole('heading', { name: /^trends$/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pr timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /block compare/i })).toBeInTheDocument();
  });
});